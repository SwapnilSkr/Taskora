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
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { IconPlus } from "../components/icons";
import { useModals } from "../context/ModalContext";
import type { SectionDoc, StatusDoc, TaskDoc } from "../types/models";
import {
  gapSectionDropId,
  gapTaskDropId,
  parseTaskDragId,
  parseSectionDragId,
  appendLastRootDropId,
  appendLastSubtaskDropId,
  resolveTaskAppendSubtaskChain,
  resolveTaskDrop,
  resolveTaskGapSectionMove,
  resolveTaskReorder,
  resolveSectionReorder,
  sectionDragId,
  sectionDropId,
  taskDragId,
  taskDropCollisionDetectionForTasks,
  type TaskMovePatch,
} from "../utils/taskDnD";
import clsx from "clsx";

/** Suppress the click that fires right after releasing a drag on this card. */
function useSuppressClickAfterOwnDrag(taskId: string) {
  const suppressRef = useRef(false);
  const dragId = taskDragId(taskId);
  useDndMonitor({
    onDragEnd(event) {
      if (String(event.active.id) !== dragId) return;
      suppressRef.current = true;
      window.setTimeout(() => { suppressRef.current = false; }, 0);
    },
    onDragCancel(event) {
      if (String(event.active.id) !== dragId) return;
      suppressRef.current = true;
      window.setTimeout(() => { suppressRef.current = false; }, 0);
    },
  });
  return suppressRef;
}

const COLUMN_WIDTH = "min-w-[288px] w-[288px]";
const BOARD_CARD_FALLBACK_WIDTH = 288 - 24;

// ─── Context menus ───────────────────────────────────────────────────────────

function BoardSectionContextMenu({
  section,
  onAddTask,
  onRequestRenameSection,
  onDeleteSection,
  children,
}: {
  section: SectionDoc;
  onAddTask: (sectionId: string) => void;
  onRequestRenameSection: (sectionId: string, currentName: string) => void;
  onDeleteSection: (sectionId: string) => void;
  children: React.ReactElement;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onAddTask(section.id)}>
          Add task
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => onRequestRenameSection(section.id, section.name)}
        >
          Rename section…
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onSelect={() => void onDeleteSection(section.id)}
        >
          Delete section…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function BoardTaskContextMenu({
  task,
  allowAddSubtask,
  onTaskClick,
  onAddSubtask,
  onDeleteTask,
  children,
}: {
  task: TaskDoc;
  allowAddSubtask: boolean;
  onTaskClick: (t: TaskDoc) => void;
  onAddSubtask: (parentId: string, sectionId: string, title: string) => void;
  onDeleteTask: (taskId: string) => void;
  children: React.ReactElement;
}) {
  const { prompt } = useModals();
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onTaskClick(task)}>
          Open details
        </ContextMenuItem>
        {allowAddSubtask ? (
          <ContextMenuItem
            onSelect={() => {
              void (async () => {
                const title = await prompt({
                  title: "New subtask",
                  message: "Name this subtask.",
                  label: "Subtask name",
                  defaultValue: "New subtask",
                  placeholder: "e.g. Draft outline",
                  confirmLabel: "Create",
                });
                if (title?.trim()) {
                  onAddSubtask(task.id, task.sectionId, title.trim());
                }
              })();
            }}
          >
            Add subtask
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onSelect={() => void onDeleteTask(task.id)}
        >
          Delete task…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ─── Drag preview ─────────────────────────────────────────────────────────────

function BoardDragPreview({
  task,
  statuses,
  widthPx,
}: {
  task: TaskDoc;
  statuses: StatusDoc[];
  widthPx: number;
}) {
  const isSubtask = Boolean(task.parentTaskId);
  const title = task.title.trim() || "Untitled task";
  return (
    <div
      style={{ width: widthPx, maxWidth: "min(calc(100vw - 2rem), 360px)", boxSizing: "border-box" }}
      className={clsx(
        "box-border cursor-grabbing overflow-hidden shadow-2xl will-change-transform",
        "origin-[50%_50%] scale-[1.02] border",
        "ring-2 ring-black/6 dark:ring-white/12 backdrop-saturate-150 backdrop-blur-md",
        isSubtask
          ? "rounded-lg border-border-subtle/80 bg-app/95 px-2.5 py-2 ring-inset"
          : "rounded-xl border-border-subtle bg-raised/98 px-3 py-3 ring-inset",
      )}
    >
      <div className={clsx(
        "flex min-w-0 flex-col",
        isSubtask ? "gap-1 text-[12px] font-medium tracking-tight text-foreground/95"
                  : "gap-2 text-[13px] font-semibold tracking-tight text-foreground",
      )}>
        {task.statusId ? <StatusTag sid={task.statusId} statuses={statuses} /> : null}
        <span className="min-w-0 leading-snug" title={title}>{title}</span>
      </div>
    </div>
  );
}

// ─── Prop types ───────────────────────────────────────────────────────────────

type Props = {
  sections: SectionDoc[];
  statuses: StatusDoc[];
  tasks: TaskDoc[];
  tasksForMove: TaskDoc[];
  onTaskClick: (t: TaskDoc) => void;
  onMoveTask: (taskId: string, patch: TaskMovePatch) => void;
  onMoveSection: (sectionId: string, sortOrder: number) => void;
  onAddTask: (sectionId: string) => void;
  onAddSubtask: (parentId: string, sectionId: string, title: string) => void;
  onDeleteTask: (taskId: string) => void;
  onRequestRenameSection: (sectionId: string, currentName: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddSection?: () => void;
};

// ─── Main board component ─────────────────────────────────────────────────────

export function BoardView({
  sections,
  statuses,
  tasks,
  tasksForMove,
  onTaskClick,
  onMoveTask,
  onMoveSection,
  onAddTask,
  onAddSubtask,
  onDeleteTask,
  onRequestRenameSection,
  onDeleteSection,
  onAddSection,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null);

  const roots = tasks.filter((t) => !t.parentTaskId);
  const activeTask = activeId ? (tasksForMove.find((t) => t.id === activeId) ?? null) : null;
  const activeSection = activeSectionId ? (sections.find((s) => s.id === activeSectionId) ?? null) : null;

  const isDraggingTask = activeId !== null;
  const isDraggingSection = activeSectionId !== null;

  const onDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const overRaw = e.over?.id != null ? String(e.over.id) : null;

      const draggedSectionId = parseSectionDragId(e.active.id);
      setActiveSectionId(null);
      if (draggedSectionId) {
        if (overRaw) {
          const patch = resolveSectionReorder(sections, draggedSectionId, overRaw);
          if (patch) onMoveSection(draggedSectionId, patch.sortOrder);
        }
        setActiveId(null);
        setOverlayWidth(null);
        return;
      }

      const draggedId = parseTaskDragId(e.active.id);
      setActiveId(null);
      setOverlayWidth(null);
      if (!draggedId || !overRaw) return;

      // Resolution pipeline: most-specific first
      const reorderPatch = resolveTaskReorder(tasksForMove, draggedId, overRaw);
      if (reorderPatch) { onMoveTask(draggedId, reorderPatch); return; }

      const appendSubPatch = resolveTaskAppendSubtaskChain(tasksForMove, draggedId, overRaw);
      if (appendSubPatch) { onMoveTask(draggedId, appendSubPatch); return; }

      const gapSectionPatch = resolveTaskGapSectionMove(tasksForMove, draggedId, overRaw);
      if (gapSectionPatch) { onMoveTask(draggedId, gapSectionPatch); return; }

      const movePatch = resolveTaskDrop(tasksForMove, draggedId, overRaw);
      if (movePatch) onMoveTask(draggedId, movePatch);
    },
    [tasksForMove, sections, onMoveTask, onMoveSection],
  );

  const boardCollisionDetection = useMemo(
    () => taskDropCollisionDetectionForTasks(),
    [],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      onDragStart={(e) => {
        setActiveId(parseTaskDragId(e.active.id));
        setActiveSectionId(parseSectionDragId(e.active.id));
        const initial = e.active.rect.current.initial;
        const w = initial?.width ?? 0;
        setOverlayWidth(w > 0 ? Math.round(w) : BOARD_CARD_FALLBACK_WIDTH);
      }}
      onDragCancel={() => {
        setActiveId(null);
        setActiveSectionId(null);
        setOverlayWidth(null);
      }}
      onDragEnd={(e) => void onDragEnd(e)}
    >
      <div className="min-h-[calc(100vh-12rem)] bg-linear-to-b from-muted/30 via-transparent to-transparent">
        <div
          className="flex items-stretch gap-4 overflow-x-auto px-4 pb-10 pt-4 [-webkit-overflow-scrolling:touch] sm:gap-5 sm:px-6 md:px-8"
          role="list"
          aria-label="Project board columns"
        >
          {sections.map((s) => (
            <div key={s.id} className="flex items-stretch">
              {isDraggingSection && <BoardColumnGap sectionId={s.id} />}
              <Column
                section={s}
                roots={roots
                  .filter((t) => t.sectionId === s.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder)}
                allTasks={tasks}
                statuses={statuses}
                onTaskClick={onTaskClick}
                onAddTask={onAddTask}
                onAddSubtask={onAddSubtask}
                onDeleteTask={onDeleteTask}
                onRequestRenameSection={onRequestRenameSection}
                onDeleteSection={onDeleteSection}
                isDraggingTask={isDraggingTask}
                isDraggingSection={isDraggingSection}
              />
            </div>
          ))}
          {onAddSection ? <AddSectionColumn onAddSection={onAddSection} /> : null}
        </div>
      </div>

      <DragOverlay dropAnimation={null} className="z-9999">
        {activeTask ? (
          <BoardDragPreview
            task={activeTask}
            statuses={statuses}
            widthPx={overlayWidth ?? BOARD_CARD_FALLBACK_WIDTH}
          />
        ) : activeSection ? (
          <div className={clsx(
            COLUMN_WIDTH,
            "shrink-0 rounded-2xl border border-border-subtle bg-board shadow-xl px-3.5 py-3 opacity-90",
          )}>
            <span className="text-[13px] font-semibold text-foreground">{activeSection.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function Column({
  section,
  roots,
  allTasks,
  statuses,
  onTaskClick,
  onAddTask,
  onAddSubtask,
  onDeleteTask,
  onRequestRenameSection,
  onDeleteSection,
  isDraggingTask,
  isDraggingSection,
}: {
  section: SectionDoc;
  roots: TaskDoc[];
  allTasks: TaskDoc[];
  statuses: StatusDoc[];
  onTaskClick: (t: TaskDoc) => void;
  onAddTask: (sectionId: string) => void;
  onAddSubtask: (parentId: string, sectionId: string, title: string) => void;
  onDeleteTask: (taskId: string) => void;
  onRequestRenameSection: (sectionId: string, currentName: string) => void;
  onDeleteSection: (sectionId: string) => void;
  isDraggingTask: boolean;
  isDraggingSection: boolean;
}) {
  // The column itself is a fallback drop zone (handles empty column drops + sec: fallback)
  const { setNodeRef, isOver } = useDroppable({ id: sectionDropId(section.id) });

  return (
    <BoardSectionContextMenu
      section={section}
      onAddTask={onAddTask}
      onRequestRenameSection={onRequestRenameSection}
      onDeleteSection={onDeleteSection}
    >
      <div
        className={clsx(
          COLUMN_WIDTH,
          "flex shrink-0 flex-col rounded-2xl border border-border-subtle bg-board shadow-sm ring-1 ring-black/4 transition-[box-shadow,outline] dark:ring-white/6",
          isOver && !isDraggingSection && "ring-2 ring-share/30",
        )}
        ref={setNodeRef}
        role="listitem"
      >
        {/* Column header */}
        <div className="border-b border-border-subtle/80 px-3.5 pb-3 pt-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <ColumnDragHandle sectionId={section.id} />
              <h3 className="min-w-0 text-[13px] font-semibold leading-tight tracking-tight text-foreground">
                <span className="line-clamp-2">{section.name}</span>
              </h3>
            </div>
            <span
              className="shrink-0 rounded-full bg-muted/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground"
              aria-label={`${roots.length} tasks`}
            >
              {roots.length}
            </span>
          </div>
        </div>

        {/* Card list */}
        <div className="flex flex-1 flex-col overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
          {roots.length === 0 ? (
            <ColumnEmptyDropZone sectionId={section.id} isDraggingTask={isDraggingTask} />
          ) : (
            <div className="flex flex-col gap-2">
              {roots.map((t) => (
                <RootTaskCard
                  key={t.id}
                  task={t}
                  subtasks={allTasks
                    .filter((x) => x.parentTaskId === t.id)
                    .sort((a, b) => a.sortOrder - b.sortOrder)}
                  statuses={statuses}
                  onTaskClick={onTaskClick}
                  onAddSubtask={onAddSubtask}
                  onDeleteTask={onDeleteTask}
                  isDraggingTask={isDraggingTask}
                />
              ))}
              <ColumnAppendZone sectionId={section.id} isDraggingTask={isDraggingTask} />
            </div>
          )}
        </div>
      </div>
    </BoardSectionContextMenu>
  );
}

/** Empty-column drop target — occupies the full column body when there are no cards. */
function ColumnEmptyDropZone({ sectionId, isDraggingTask }: { sectionId: string; isDraggingTask: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: appendLastRootDropId(sectionId) });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed transition-all",
        isDraggingTask
          ? isOver
            ? "border-share bg-share/10 py-12"
            : "border-border-subtle bg-muted/15 py-10"
          : "border-border-subtle/80 bg-muted/10 py-10",
      )}
    >
      <p className={clsx("text-[12px] font-medium", isOver ? "text-share" : "text-muted-foreground")}>
        {isDraggingTask && isOver ? "Drop here" : "No tasks yet"}
      </p>
      {!isDraggingTask && (
        <p className="mt-1 max-w-[200px] text-center text-[11px] leading-relaxed text-muted-foreground/80">
          Drop a card here or add tasks from the list.
        </p>
      )}
    </div>
  );
}

/** Append zone at the bottom of a non-empty column — "insert after last card". */
function ColumnAppendZone({ sectionId, isDraggingTask }: { sectionId: string; isDraggingTask: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: appendLastRootDropId(sectionId) });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex items-center justify-center rounded-lg border border-dashed transition-all",
        isDraggingTask
          ? isOver
            ? "min-h-10 border-share bg-share/10 py-2"
            : "min-h-8 border-border-subtle/60 bg-muted/15 py-1.5"
          : "min-h-6 border-border-subtle/30 bg-transparent py-1",
      )}
    >
      <span className={clsx(
        "text-[10px] font-semibold uppercase tracking-wide transition-opacity",
        isOver ? "text-share opacity-100" : "text-muted-foreground",
        !isDraggingTask && "opacity-40",
      )}>
        {isDraggingTask ? (isOver ? "Drop at end" : "End") : "End"}
      </span>
    </div>
  );
}

/** Subtask append zone — "insert after last subtask under parent". */
function SubtaskAppendZone({ parentTaskId, isDraggingTask }: { parentTaskId: string; isDraggingTask: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: appendLastSubtaskDropId(parentTaskId) });
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        "flex items-center justify-center rounded-md transition-all",
        isDraggingTask
          ? isOver
            ? "min-h-7 bg-share/10 ring-1 ring-inset ring-share/35 py-1"
            : "min-h-5 bg-muted/10 py-0.5"
          : "min-h-3 py-0",
      )}
    >
      <span className={clsx(
        "text-[9px] font-semibold uppercase tracking-wide transition-opacity",
        isOver ? "text-share opacity-100" : "text-muted-foreground",
        !isDraggingTask && "opacity-0",
        isDraggingTask && !isOver && "opacity-50",
      )}>
        {isDraggingTask ? (isOver ? "End of subtasks" : "Sub end") : ""}
      </span>
    </div>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function RootTaskCard({
  task,
  subtasks,
  statuses,
  onTaskClick,
  onAddSubtask,
  onDeleteTask,
  isDraggingTask,
}: {
  task: TaskDoc;
  subtasks: TaskDoc[];
  statuses: StatusDoc[];
  onTaskClick: (t: TaskDoc) => void;
  onAddSubtask: (parentId: string, sectionId: string, title: string) => void;
  onDeleteTask: (taskId: string) => void;
  isDraggingTask: boolean;
}) {
  const suppressOpenClickRef = useSuppressClickAfterOwnDrag(task.id);

  // Draggable
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: taskDragId(task.id) });

  // Droppable — "insert before this card"
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: gapTaskDropId(task.id) });

  // Merge refs
  const setRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.35 : 1 }
    : undefined;

  return (
    <div>
      {/* Insertion indicator — appears above the card when it is the drop target */}
      <div
        className={clsx(
          "h-0.5 w-full rounded-full transition-all duration-100",
          isOver && isDraggingTask ? "bg-share scale-x-100 opacity-100 mb-1" : "scale-x-0 opacity-0 mb-0",
        )}
        aria-hidden
      />

      <BoardTaskContextMenu
        task={task}
        allowAddSubtask
        onTaskClick={onTaskClick}
        onAddSubtask={onAddSubtask}
        onDeleteTask={onDeleteTask}
      >
        <div
          ref={setRef}
          style={style}
          {...listeners}
          {...attributes}
          className={clsx(
            "min-w-0 cursor-grab overflow-hidden rounded-xl border bg-raised px-3 py-3 text-[13px] font-semibold tracking-tight shadow-sm transition-all active:cursor-grabbing",
            isOver && isDraggingTask
              ? "border-share/60 ring-2 ring-share/25"
              : "border-border-subtle hover:border-border-subtle hover:shadow-md",
          )}
          onClick={() => {
            if (suppressOpenClickRef.current) return;
            onTaskClick(task);
          }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onTaskClick(task);
            }
          }}
          role="button"
          tabIndex={0}
          title="Drag to reorder or move to another column. Click to open."
        >
          <div className="flex min-w-0 flex-col gap-2">
            {task.statusId ? <StatusTag sid={task.statusId} statuses={statuses} /> : null}
            <span className="min-w-0 leading-snug text-foreground">
              {task.title.trim() || "Untitled task"}
            </span>
          </div>
        </div>
      </BoardTaskContextMenu>

      {/* Subtasks */}
      {subtasks.length > 0 ? (
        <div className="relative mt-2 flex flex-col border-l-2 border-border-subtle/70 pl-3">
          {subtasks.map((st) => (
            <SubtaskCard
              key={st.id}
              task={st}
              statuses={statuses}
              onTaskClick={onTaskClick}
              onAddSubtask={onAddSubtask}
              onDeleteTask={onDeleteTask}
              isDraggingTask={isDraggingTask}
            />
          ))}
          <SubtaskAppendZone parentTaskId={task.id} isDraggingTask={isDraggingTask} />
        </div>
      ) : null}
    </div>
  );
}

function SubtaskCard({
  task,
  statuses,
  onTaskClick,
  onAddSubtask,
  onDeleteTask,
  isDraggingTask,
}: {
  task: TaskDoc;
  statuses: StatusDoc[];
  onTaskClick: (t: TaskDoc) => void;
  onAddSubtask: (parentId: string, sectionId: string, title: string) => void;
  onDeleteTask: (taskId: string) => void;
  isDraggingTask: boolean;
}) {
  const suppressOpenClickRef = useSuppressClickAfterOwnDrag(task.id);

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: taskDragId(task.id) });

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: gapTaskDropId(task.id) });

  const setRef = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.35 : 1 }
    : undefined;

  return (
    <div className="mt-1.5">
      {/* Insertion indicator */}
      <div
        className={clsx(
          "h-px w-full rounded-full transition-all duration-100",
          isOver && isDraggingTask ? "bg-share scale-x-100 opacity-100 mb-1" : "scale-x-0 opacity-0 mb-0",
        )}
        aria-hidden
      />

      <BoardTaskContextMenu
        task={task}
        allowAddSubtask={false}
        onTaskClick={onTaskClick}
        onAddSubtask={onAddSubtask}
        onDeleteTask={onDeleteTask}
      >
        <div
          ref={setRef}
          style={style}
          {...listeners}
          {...attributes}
          className={clsx(
            "min-w-0 cursor-grab overflow-hidden rounded-lg border bg-app/90 px-2.5 py-2 text-[12px] font-medium shadow-sm transition-all active:cursor-grabbing hover:shadow",
            isOver && isDraggingTask
              ? "border-share/50 ring-1 ring-share/20"
              : "border-border-subtle/70",
          )}
          onClick={() => {
            if (suppressOpenClickRef.current) return;
            onTaskClick(task);
          }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onTaskClick(task);
            }
          }}
          role="button"
          tabIndex={0}
          title="Drag to reorder. Click to open."
        >
          <div className="flex min-w-0 flex-col gap-1">
            {task.statusId ? <StatusTag sid={task.statusId} statuses={statuses} /> : null}
            <span className="min-w-0 truncate text-foreground/95">
              {task.title.trim() || "Untitled task"}
            </span>
          </div>
        </div>
      </BoardTaskContextMenu>
    </div>
  );
}

// ─── Section drag helpers ─────────────────────────────────────────────────────

/** Vertical gap between columns — accepts section reorder drops. */
function BoardColumnGap({ sectionId }: { sectionId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: gapSectionDropId(sectionId) });
  return (
    <div ref={setNodeRef} className="flex w-3 shrink-0 items-stretch py-2" aria-hidden>
      <div className={clsx(
        "w-0.5 flex-1 rounded-full transition-colors duration-75",
        isOver ? "bg-share" : "bg-transparent",
      )} />
    </div>
  );
}

/** Drag handle on a column header. */
function ColumnDragHandle({ sectionId }: { sectionId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: sectionDragId(sectionId),
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      data-row-action
      className={clsx(
        "grid size-6 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-fg active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      title="Drag to reorder column"
      {...listeners}
      {...attributes}
    >
      <span className="select-none text-[11px] leading-none opacity-60" aria-hidden>⠿</span>
    </button>
  );
}

// ─── Add section column ───────────────────────────────────────────────────────

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
            <IconPlus width={22} height={22} className="text-muted-foreground transition-colors group-hover:text-share" aria-hidden />
          </span>
          <span className="max-w-[200px] text-[13px] font-semibold leading-snug text-foreground">
            Add workflow stage
          </span>
          <span className="max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
            Create another column for tasks — same as sections in list view.
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusTag({ sid, statuses }: { sid: string | null; statuses: StatusDoc[] }) {
  if (!sid) return null;
  const s = statuses.find((x) => x.id === sid);
  if (!s) return null;
  return (
    <span
      className="inline-flex w-fit max-w-full items-center rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
      style={{ backgroundColor: s.color }}
    >
      <span className="truncate">{s.name}</span>
    </span>
  );
}
