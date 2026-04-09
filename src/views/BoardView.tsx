import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDndMonitor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { IconPlus } from "../components/icons";
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

/** Ignore the click that sometimes follows a drag on this task (whole-card drag + click to open). */
function useSuppressClickAfterOwnDrag(taskId: string) {
  const suppressRef = useRef(false);
  const dragId = taskDragId(taskId);
  useDndMonitor({
    onDragEnd(event) {
      if (String(event.active.id) !== dragId) return;
      suppressRef.current = true;
      window.setTimeout(() => {
        suppressRef.current = false;
      }, 0);
    },
    onDragCancel(event) {
      if (String(event.active.id) !== dragId) return;
      suppressRef.current = true;
      window.setTimeout(() => {
        suppressRef.current = false;
      }, 0);
    },
  });
  return suppressRef;
}

const COLUMN_WIDTH = "min-w-[288px] w-[288px]";

const COLUMN_HELP =
  "Drag cards between columns. Drop on a card to nest as a subtask; drop on the column to promote to a top-level task in this section.";

type Props = {
  sections: SectionDoc[];
  statuses: StatusDoc[];
  tasks: TaskDoc[];
  tasksForMove: TaskDoc[];
  onTaskClick: (t: TaskDoc) => void;
  onMoveTask: (taskId: string, patch: TaskMovePatch) => void;
  /** When set, an “add column” panel is shown as the last board column (board view). */
  onAddSection?: () => void;
};

export function BoardView({
  sections,
  statuses,
  tasks,
  tasksForMove,
  onTaskClick,
  onMoveTask,
  onAddSection,
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
        setActiveId(parseTaskDragId(e.active.id));
      }}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={(e) => void onDragEnd(e)}
    >
      <div
        className="min-h-[calc(100vh-12rem)] bg-linear-to-b from-muted/30 via-transparent to-transparent"
        title={COLUMN_HELP}
      >
        <div
          className="flex items-stretch gap-4 overflow-x-auto px-4 pb-10 pt-4 [-webkit-overflow-scrolling:touch] sm:gap-5 sm:px-6 md:px-8"
          role="list"
          aria-label="Project board columns"
        >
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
          {onAddSection ? (
            <AddSectionColumn onAddSection={onAddSection} />
          ) : null}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div
            className="box-border w-max max-w-[min(var(--spacing-sidebar),calc(100vw-2rem))] min-w-[200px] cursor-grabbing overflow-hidden rounded-xl border border-border-subtle bg-raised/95 px-3 py-3 shadow-xl ring-1 ring-black/5 backdrop-blur-sm dark:ring-white/10"
          >
            <div className="flex min-w-0 flex-col gap-2 text-[13px] font-semibold tracking-tight text-foreground">
              {activeTask.statusId ? (
                <StatusTag sid={activeTask.statusId} statuses={statuses} />
              ) : null}
              <span
                className="min-w-0 truncate leading-snug"
                title={activeTask.title || undefined}
              >
                {activeTask.title.trim() || "Untitled task"}
              </span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function AddSectionColumn({ onAddSection }: { onAddSection: () => void }) {
  return (
    <div
      className={clsx(
        COLUMN_WIDTH,
        "shrink-0 rounded-2xl border border-dashed border-border-subtle bg-muted/20 shadow-sm ring-1 ring-black/3 backdrop-blur-[2px] dark:bg-muted/10 dark:ring-white/4",
      )}
      role="listitem"
    >
      <div className="flex h-full min-h-[min(420px,calc(100vh-14rem))] flex-col p-3">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-border-subtle/70 pb-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            New column
          </span>
        </div>
        <button
          type="button"
          onClick={onAddSection}
          className="group flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-subtle/90 bg-background/40 px-4 py-8 text-center transition-colors hover:border-share/50 hover:bg-share/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-share focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border-subtle bg-raised shadow-sm transition-transform group-hover:scale-105 group-active:scale-100">
            <IconPlus
              width={22}
              height={22}
              className="text-muted-foreground transition-colors group-hover:text-share"
              aria-hidden
            />
          </span>
          <span className="max-w-[200px] text-[13px] font-semibold leading-snug text-foreground">
            Add workflow stage
          </span>
          <span className="max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
            Create another column for tasks—same as sections in list view.
          </span>
        </button>
      </div>
    </div>
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
  const count = roots.length;

  return (
    <div
      className={clsx(
        COLUMN_WIDTH,
        "flex shrink-0 flex-col rounded-2xl border border-border-subtle bg-board shadow-sm ring-1 ring-black/4 transition-[box-shadow,outline] dark:ring-white/6",
        isOver &&
          "ring-2 ring-share/40 outline-2 outline-dashed outline-share/60 outline-offset-0",
      )}
      ref={setNodeRef}
      data-over={isOver ? "true" : "false"}
      role="listitem"
      title={COLUMN_HELP}
    >
      <div className="border-b border-border-subtle/80 px-3.5 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-[13px] font-semibold leading-tight tracking-tight text-foreground">
            <span className="line-clamp-2">{section.name}</span>
          </h3>
          <span
            className="shrink-0 rounded-full bg-muted/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground"
            aria-label={`${count} tasks in this column`}
          >
            {count}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
        {roots.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle/80 bg-muted/10 px-3 py-10 text-center">
            <p className="text-[12px] font-medium text-muted-foreground">
              No tasks yet
            </p>
            <p className="mt-1 max-w-[200px] text-[11px] leading-relaxed text-muted-foreground/85">
              Drop a card here or add tasks from the list.
            </p>
          </div>
        ) : (
          roots.map((t) => (
            <RootTaskCard
              key={t.id}
              task={t}
              subtasks={allTasks
                .filter((x) => x.parentTaskId === t.id)
                .sort((a, b) => a.sortOrder - b.sortOrder)}
              onTaskClick={onTaskClick}
              statuses={statuses}
            />
          ))
        )}
      </div>
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
  const suppressOpenClickRef = useSuppressClickAfterOwnDrag(task.id);
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

  const handleOpenKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTaskClick(task);
    }
  };

  return (
    <div className="mb-0.5">
      <div
        ref={setRefs}
        style={style}
        {...listeners}
        {...attributes}
        className={clsx(
          "min-w-0 cursor-grab overflow-hidden rounded-xl border border-border-subtle bg-raised px-3 py-3 text-[13px] font-semibold tracking-tight shadow-sm transition-shadow active:cursor-grabbing",
          "hover:border-border-subtle hover:shadow-md",
          isOver &&
            "ring-2 ring-share/35 outline-2 outline-dashed outline-share/70 outline-offset-2",
        )}
        onClick={() => {
          if (suppressOpenClickRef.current) return;
          onTaskClick(task);
        }}
        onKeyDown={handleOpenKeyDown}
        role="button"
        tabIndex={0}
        title="Click to open. Drag to move or nest. Drop tasks here to nest."
      >
        <div className="flex min-w-0 flex-col gap-2">
          {task.statusId ? (
            <StatusTag sid={task.statusId} statuses={statuses} />
          ) : null}
          <span className="min-w-0 leading-snug text-foreground">
            {task.title.trim() || "Untitled task"}
          </span>
        </div>
      </div>
      {subtasks.length > 0 ? (
        <div className="relative mt-2 space-y-1.5 border-l-2 border-border-subtle/90 pl-3">
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
  const suppressOpenClickRef = useSuppressClickAfterOwnDrag(task.id);
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
      className={clsx(
        "min-w-0 cursor-grab overflow-hidden rounded-lg border border-border-subtle/70 bg-app/90 px-2.5 py-2 text-[12px] font-medium shadow-sm transition-shadow active:cursor-grabbing hover:shadow",
      )}
      onClick={() => {
        if (suppressOpenClickRef.current) return;
        onTaskClick(task);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTaskClick(task);
        }
      }}
      title="Click to open. Drag onto another card or section."
    >
      <div className="flex min-w-0 flex-col gap-1">
        {task.statusId ? (
          <StatusTag sid={task.statusId} statuses={statuses} />
        ) : null}
        <span className="min-w-0 truncate text-foreground/95">
          {task.title.trim() || "Untitled task"}
        </span>
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
      className="inline-flex w-fit max-w-full items-center rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
      style={{
        backgroundColor: s.color,
      }}
    >
      <span className="truncate">{s.name}</span>
    </span>
  );
}
