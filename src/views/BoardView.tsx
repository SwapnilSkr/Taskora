import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type React from "react";
import { useCallback, useState } from "react";
import type { SectionDoc, StatusDoc, TaskDoc } from "../types/models";
import {
  parseTaskDragId,
  parentTaskDropId,
  resolveTaskDrop,
  sectionDropId,
  taskDragId,
  taskDropCollisionDetection,
  type TaskMovePatch,
} from "../utils/taskDnD";
import clsx from "clsx";

type Props = {
  sections: SectionDoc[];
  statuses: StatusDoc[];
  tasks: TaskDoc[];
  tasksForMove: TaskDoc[];
  onTaskClick: (t: TaskDoc) => void;
  onMoveTask: (taskId: string, patch: TaskMovePatch) => void;
};

export function BoardView({
  sections,
  statuses,
  tasks,
  tasksForMove,
  onTaskClick,
  onMoveTask,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const roots = tasks.filter((t) => !t.parentTaskId);
  const activeTask = activeId
    ? (tasksForMove.find((t) => t.id === activeId) ?? null)
    : null;

  const onDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const draggedId = parseTaskDragId(e.active.id);
      const overRaw = e.over?.id != null ? String(e.over.id) : null;
      setActiveId(null);
      if (!draggedId || !overRaw) return;
      const patch = resolveTaskDrop(tasksForMove, draggedId, overRaw);
      if (!patch) return;
      onMoveTask(draggedId, patch);
    },
    [tasksForMove, onMoveTask],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={taskDropCollisionDetection}
      onDragStart={(e) => {
        const id = parseTaskDragId(e.active.id);
        if (id) setActiveId(id);
      }}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={(e) => void onDragEnd(e)}
    >
      <div className="flex items-start gap-3.5 overflow-x-auto px-7 pt-3 pb-10">
        {sections.map((s) => (
          <Column
            key={s.id}
            section={s}
            roots={roots
              .filter((t) => t.sectionId === s.id)
              .sort((a, b) => a.sortOrder - b.sortOrder)}
            allTasks={tasks}
            onTaskClick={onTaskClick}
            statuses={statuses}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-sidebar cursor-grabbing rounded-lg border border-border-subtle bg-raised px-2.5 py-2.5 text-[13px] font-semibold shadow-lg">
            {activeTask.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  section,
  roots,
  allTasks,
  onTaskClick,
  statuses,
}: {
  section: SectionDoc;
  roots: TaskDoc[];
  allTasks: TaskDoc[];
  onTaskClick: (t: TaskDoc) => void;
  statuses: StatusDoc[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: sectionDropId(section.id) });
  return (
    <div
      className="w-[280px] shrink-0 rounded-modal border border-border-subtle bg-board p-2.5 data-[over=true]:outline data-[over=true]:outline-dashed data-[over=true]:outline-share"
      ref={setNodeRef}
      data-over={isOver ? "true" : "false"}
    >
      <h3 className="mb-2.5 mt-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {section.name}
      </h3>
      <p className="mb-2 text-[10px] leading-snug text-muted-foreground">
        Drag main tasks between columns. Drop on a card to nest as a subtask
        (section updates with the parent). Drop on the column / header area to
        turn a subtask into a main task in that section.
      </p>
      {roots.map((t) => (
        <RootTaskCard
          key={t.id}
          task={t}
          subtasks={allTasks
            .filter((x) => x.parentTaskId === t.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)}
          onTaskClick={onTaskClick}
          statuses={statuses}
        />
      ))}
    </div>
  );
}

function RootTaskCard({
  task,
  subtasks,
  onTaskClick,
  statuses,
}: {
  task: TaskDoc;
  subtasks: TaskDoc[];
  onTaskClick: (t: TaskDoc) => void;
  statuses: StatusDoc[];
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: parentTaskDropId(task.id),
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: taskDragId(task.id) });

  const setRefs = (node: HTMLDivElement | null) => {
    setDropRef(node);
    setDragRef(node);
  };

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.45 : 1,
      }
    : undefined;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") onTaskClick(task);
  };

  return (
    <div className="mb-2">
      <div
        ref={setRefs}
        style={style}
        {...listeners}
        {...attributes}
        className={clsx(
          "cursor-grab rounded-lg border border-border-subtle bg-raised px-2.5 py-2.5 text-[13px] font-semibold active:cursor-grabbing",
          isOver &&
            "outline-2 outline-dashed outline-share outline-offset-2",
        )}
        onDoubleClick={() => onTaskClick(task)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        title="Drag to move or nest. Double-click to open."
      >
        <div className="flex flex-col gap-1.5">
          {task.statusId ? (
            <StatusTag sid={task.statusId} statuses={statuses} />
          ) : null}
          <span>{task.title}</span>
        </div>
      </div>
      {subtasks.length > 0 ? (
        <div className="relative mt-1.5 space-y-1 border-l-2 border-border-subtle pl-2.5">
          {subtasks.map((st) => (
            <SubtaskCard
              key={st.id}
              task={st}
              onTaskClick={onTaskClick}
              statuses={statuses}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SubtaskCard({
  task,
  onTaskClick,
  statuses,
}: {
  task: TaskDoc;
  onTaskClick: (t: TaskDoc) => void;
  statuses: StatusDoc[];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: taskDragId(task.id) });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.45 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-md border border-border-subtle/80 bg-app px-2 py-2 text-[12px] font-medium active:cursor-grabbing"
      onDoubleClick={() => onTaskClick(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onTaskClick(task);
      }}
      title="Drag onto another card or section."
    >
      <div className="flex flex-col gap-1">
        {task.statusId ? (
          <StatusTag sid={task.statusId} statuses={statuses} />
        ) : null}
        <span>{task.title}</span>
      </div>
    </div>
  );
}

function StatusTag({
  sid,
  statuses,
}: {
  sid: string | null;
  statuses: StatusDoc[];
}) {
  if (!sid) return null;
  const s = statuses.find((x) => x.id === sid);
  if (!s) return null;
  return (
    <span
      className="inline-block rounded-pill border border-transparent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
      style={{
        backgroundColor: s.color,
      }}
    >
      {s.name}
    </span>
  );
}
