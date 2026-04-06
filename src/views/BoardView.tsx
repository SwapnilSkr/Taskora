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
import { useState } from "react";
import { updateTask } from "../services/db";
import type { SectionDoc, StatusDoc, TaskDoc } from "../types/models";

type Props = {
  uid: string;
  projectId: string;
  sections: SectionDoc[];
  statuses: StatusDoc[];
  tasks: TaskDoc[];
  onTaskClick: (t: TaskDoc) => void;
};

export function BoardView({
  uid,
  projectId,
  sections,
  statuses,
  tasks,
  onTaskClick,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const roots = tasks.filter((t) => !t.parentTaskId);
  const activeTask = activeId
    ? (tasks.find((t) => t.id === activeId) ?? null)
    : null;

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const taskId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const section = sections.find((s) => s.id === overId);
    if (!section) return;
    const inSection = roots.filter((t) => t.sectionId === section.id);
    const nextOrder =
      inSection.length > 0
        ? Math.max(...inSection.map((t) => t.sortOrder)) + 1
        : 0;
    await updateTask(uid, projectId, taskId, {
      sectionId: section.id,
      sortOrder: nextOrder,
    });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={(e) => void onDragEnd(e)}
    >
      <div className="flex items-start gap-3.5 overflow-x-auto px-7 pb-10">
        {sections.map((s) => (
          <Column
            key={s.id}
            section={s}
            tasks={roots.filter((t) => t.sectionId === s.id)}
            onTaskClick={onTaskClick}
            statuses={statuses}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div
            className="w-sidebar cursor-grabbing rounded-lg border border-border-subtle bg-raised px-2.5 py-2.5 text-[13px] font-semibold"
          >
            {activeTask.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  section,
  tasks,
  onTaskClick,
  statuses,
}: {
  section: SectionDoc;
  tasks: TaskDoc[];
  onTaskClick: (t: TaskDoc) => void;
  statuses: StatusDoc[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: section.id });
  return (
    <div
      className="w-[280px] shrink-0 rounded-modal border border-border-subtle bg-board p-2.5 data-[over=true]:outline data-[over=true]:outline-dashed data-[over=true]:outline-share"
      ref={setNodeRef}
      data-over={isOver ? "true" : "false"}
    >
      <h3 className="mb-2.5 mt-0 text-xs font-bold uppercase tracking-wider text-muted">
        {section.name}
      </h3>
      {tasks.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          onTaskClick={onTaskClick}
          statuses={statuses}
        />
      ))}
    </div>
  );
}

function TaskCard({
  task,
  onTaskClick,
  statuses,
}: {
  task: TaskDoc;
  onTaskClick: (t: TaskDoc) => void;
  statuses: StatusDoc[];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
    });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.35 : 1,
      }
    : undefined;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      onTaskClick(task);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="mb-2 cursor-grab rounded-lg border border-border-subtle bg-raised px-2.5 py-2.5 text-[13px] font-semibold active:cursor-grabbing"
      onDoubleClick={() => onTaskClick(task)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      title="Double-click to open"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {task.statusId && <StatusTag sid={task.statusId} statuses={statuses} />}
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
