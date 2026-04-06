import clsx from "clsx";
import type React from "react";
import { Fragment, useEffect, useRef, useState } from "react";
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
import {
  parseTaskDragId,
  parentTaskDropId,
  resolveTaskDrop,
  sectionDropId,
  taskDragId,
  taskDropCollisionDetection,
  type TaskMovePatch,
} from "../utils/taskDnD";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  IconCalendar,
  IconChevronDown,
  IconPlus,
  IconUser,
} from "../components/icons";
import type { SectionDoc, StatusDoc, TaskDoc } from "../types/models";
import {
  dateToInputValue,
  dueBadgeState,
  fmtDate,
  tsToDate,
} from "../utils/format";

export type GroupMode = "section" | "assignee" | "due" | "status" | "priority";
export type SortMode = "sortOrder" | "dueDate" | "priority" | "name";

type Pop =
  | null
  | { k: "assign"; taskId: string }
  | { k: "start"; taskId: string }
  | { k: "due"; taskId: string }
  | { k: "prio"; taskId: string }
  | { k: "statuspick"; taskId: string };

type Props = {
  sections: SectionDoc[];
  statuses: StatusDoc[];
  tasks: TaskDoc[];
  /** All project tasks (unfiltered) — used to compute sort order when dragging. */
  tasksForMove: TaskDoc[];
  group: GroupMode;
  sort: SortMode;
  uid: string;
  multiSelectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (taskId: string) => void;
  onSetManySelected: (taskIds: string[], selected: boolean) => void;
  onTaskClick: (t: TaskDoc) => void;
  onStatusChange: (taskId: string, statusId: string | null) => void;
  onAddTask: (sectionId: string) => void;
  onAssign: (taskId: string, assigneeId: string | null) => void;
  onStartChange: (taskId: string, ymd: string | null) => void;
  onDueChange: (taskId: string, ymd: string | null) => void;
  onPriorityChange: (taskId: string, priority: TaskDoc["priority"]) => void;
  onAddSubtask: (parentId: string, sectionId: string, title: string) => void;
  onDeleteTask: (taskId: string) => void;
  onRequestRenameSection: (sectionId: string, currentName: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onMoveTask: (taskId: string, patch: TaskMovePatch) => void;
};

function groupKey(
  t: TaskDoc,
  mode: GroupMode,
  sections: SectionDoc[],
  statuses: StatusDoc[],
  uid: string,
): string {
  switch (mode) {
    case "section":
      return sections.find((s) => s.id === t.sectionId)?.name ?? "Section";
    case "assignee":
      return t.assigneeId === uid
        ? "Me"
        : t.assigneeId
          ? "Assigned"
          : "Unassigned";
    case "due": {
      const d = tsToDate(t.dueDate);
      if (!d) return "No due date";
      return `Due ${d.toISOString().slice(0, 10)}`;
    }
    case "status": {
      const s = statuses.find((x) => x.id === t.statusId);
      return s?.name ?? "No status";
    }
    case "priority":
      return t.priority;
    default:
      return "";
  }
}

function StatusTag({
  sid,
  statuses,
}: {
  sid: string | null;
  statuses: StatusDoc[];
}) {
  const s = statuses.find((x) => x.id === sid);
  if (!s)
    return (
      <span className="inline-block h-0.5 w-3 rounded-sm bg-border-subtle" />
    );
  return (
    <span
      className="inline-block rounded-pill border border-transparent px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
      style={{ backgroundColor: s.color }}
    >
      {s.name}
    </span>
  );
}

function sortTasks(list: TaskDoc[], mode: SortMode): TaskDoc[] {
  const out = [...list];
  if (mode === "name") {
    out.sort((a, b) => a.title.localeCompare(b.title));
  } else if (mode === "dueDate") {
    out.sort((a, b) => {
      const da = tsToDate(a.dueDate)?.getTime() ?? Infinity;
      const db = tsToDate(b.dueDate)?.getTime() ?? Infinity;
      return da - db;
    });
  } else if (mode === "priority") {
    const rank: Record<TaskDoc["priority"], number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    out.sort((a, b) => rank[a.priority] - rank[b.priority]);
  } else {
    out.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return out;
}

function ListSectionContextMenu({
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

function ListTaskContextMenu({
  task,
  allowAddSubtask,
  onTaskClick,
  onOpenSubtask,
  onDeleteTask,
  children,
}: {
  task: TaskDoc;
  allowAddSubtask: boolean;
  onTaskClick: (t: TaskDoc) => void;
  onOpenSubtask: () => void;
  onDeleteTask: (taskId: string) => void;
  children: React.ReactElement;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onTaskClick(task)}>
          Open details
        </ContextMenuItem>
        {allowAddSubtask ? (
          <ContextMenuItem onSelect={() => onOpenSubtask()}>
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

function GroupSelectCheckbox({
  taskIds,
  selectedIds,
  onSetManySelected,
}: {
  taskIds: string[];
  selectedIds: Set<string>;
  onSetManySelected: (ids: string[], selected: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const picked = taskIds.filter((id) => selectedIds.has(id)).length;
  const all = taskIds.length > 0 && picked === taskIds.length;
  const some = picked > 0 && !all;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="size-4 shrink-0 cursor-pointer rounded border-[1.5px] border-placeholder bg-app accent-share"
      title="Select all in group"
      checked={all}
      onChange={() => onSetManySelected(taskIds, !all)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function ListDragHandleCell({ taskId }: { taskId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: taskDragId(taskId),
  });
  return (
    <td
      className="px-0! align-middle first:pl-0"
      style={{ width: 32, verticalAlign: "middle" }}
    >
      <div className="flex min-h-9 items-center justify-center px-0.5">
        <button
          ref={setNodeRef}
          type="button"
          className={clsx(
            "grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-row-hover hover:text-fg active:cursor-grabbing",
            isDragging && "opacity-40",
          )}
          title="Drag to a section header to move or promote; drag to a task name to nest under it"
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="select-none text-[11px] leading-none opacity-60" aria-hidden>
            ⠿
          </span>
        </button>
      </div>
    </td>
  );
}

function TaskTitleDropCell({
  task,
  isRoot,
  onClick,
  onKeyDown,
  children,
}: {
  task: TaskDoc;
  isRoot: boolean;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: parentTaskDropId(task.id),
    disabled: !isRoot,
  });
  return (
    <td
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={{ cursor: "pointer", verticalAlign: "middle" }}
      className={clsx(
        "min-w-0 align-middle",
        isOver && isRoot && "bg-muted/25 ring-1 ring-inset ring-share/35",
      )}
    >
      <div
        ref={setNodeRef}
        className="flex min-h-9 w-full max-w-full items-center pr-1"
      >
        <div className="min-w-0 flex-1 truncate font-semibold text-[13px] leading-snug text-foreground">
          {children}
        </div>
      </div>
    </td>
  );
}

function ListSectionTitleCell({
  sectionId,
  group,
  colSpan,
  className,
  children,
}: {
  sectionId: string;
  group: GroupMode;
  colSpan: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: sectionDropId(sectionId),
    disabled: group !== "section",
  });
  return (
    <td colSpan={colSpan} className={clsx(className, "p-0 align-middle")}>
      <div
        ref={setNodeRef}
        className={clsx(
          "min-h-11 w-full px-3 py-2",
          isOver &&
            group === "section" &&
            "bg-muted/40 ring-1 ring-inset ring-share/30",
        )}
      >
        {children}
      </div>
    </td>
  );
}

export function ListView({
  sections,
  statuses,
  tasks,
  tasksForMove,
  group,
  sort,
  uid,
  multiSelectMode,
  selectedIds,
  onToggleSelect,
  onSetManySelected,
  onTaskClick,
  onStatusChange,
  onAddTask,
  onAssign,
  onStartChange,
  onDueChange,
  onPriorityChange,
  onAddSubtask,
  onDeleteTask,
  onRequestRenameSection,
  onDeleteSection,
  onMoveTask,
}: Props) {
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function onDragEndList(e: DragEndEvent) {
    const draggedId = parseTaskDragId(e.active.id);
    const overRaw = e.over?.id != null ? String(e.over.id) : null;
    setDragTaskId(null);
    if (!draggedId || !overRaw) return;
    const patch = resolveTaskDrop(tasksForMove, draggedId, overRaw);
    if (patch) onMoveTask(draggedId, patch);
  }
  const [pop, setPop] = useState<Pop>(null);
  const [inlineSub, setInlineSub] = useState<{
    parentId: string;
    sectionId: string;
  } | null>(null);
  const subInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pop) return;
    function close(e: MouseEvent) {
      const el = e.target as HTMLElement;
      if (el.closest("[data-popover-root]")) return;
      setPop(null);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pop]);

  useEffect(() => {
    if (inlineSub) subInputRef.current?.focus();
  }, [inlineSub]);

  const roots = tasks.filter((x) => !x.parentTaskId);

  const sectionBody =
    group === "section"
      ? sections.map((s) => {
          const rowTasks = sortTasks(
            roots.filter((t) => t.sectionId === s.id),
            sort,
          );
          const ids = rowTasks.map((t) => t.id);
          return (
            <Fragment key={s.id}>
              <ListSectionContextMenu
                section={s}
                onAddTask={onAddTask}
                onRequestRenameSection={onRequestRenameSection}
                onDeleteSection={onDeleteSection}
              >
                <tr className="hover:[&>td]:bg-transparent">
                  {multiSelectMode ? (
                    <td style={{ width: 36, verticalAlign: "middle" }}>
                      {ids.length > 0 ? (
                        <GroupSelectCheckbox
                          taskIds={ids}
                          selectedIds={selectedIds}
                          onSetManySelected={onSetManySelected}
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td
                    className="w-8 border-b-0 pb-2 pt-[22px]"
                    aria-hidden
                  />
                  <ListSectionTitleCell
                    sectionId={s.id}
                    group={group}
                    colSpan={9}
                    className="border-b-0 pb-2 pt-[22px] text-[13px] font-bold"
                  >
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="text-[13px] font-bold">{s.name}</span>
                      <button
                        type="button"
                        className="rounded-pill border border-transparent px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-hover-surface hover:text-fg data-[open=true]:border-border data-[open=true]:bg-hover-surface data-[open=true]:text-fg"
                        onClick={() => onAddTask(s.id)}
                      >
                        + Add task
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="group grid place-items-center rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-hover-surface hover:text-fg data-[state=open]:bg-hover-surface data-[state=open]:text-fg"
                            aria-label="Section options"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconChevronDown className="size-[18px] transition-transform group-data-[state=open]:rotate-180" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          sideOffset={4}
                          collisionPadding={8}
                          className="min-w-[180px] max-w-[min(320px,calc(100vw-1.5rem))]"
                        >
                          <DropdownMenuItem
                            className="text-[13px]"
                            onSelect={() => onAddTask(s.id)}
                          >
                            Add task
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-[13px]"
                            onSelect={() =>
                              onRequestRenameSection(s.id, s.name)
                            }
                          >
                            Rename section…
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            className="text-[13px]"
                            onSelect={() => void onDeleteSection(s.id)}
                          >
                            Delete section…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </span>
                  </ListSectionTitleCell>
                </tr>
              </ListSectionContextMenu>
              {rowTasks.map((t) => (
                <Fragment key={t.id}>
                  <TaskRow
                    task={t}
                    subtasks={tasks.filter((x) => x.parentTaskId === t.id)}
                    uid={uid}
                    multiSelectMode={multiSelectMode}
                    selectedIds={selectedIds}
                    pop={pop}
                    setPop={setPop}
                    onToggleSelect={onToggleSelect}
                    onTaskClick={onTaskClick}
                    onStatusChange={onStatusChange}
                    onAssign={onAssign}
                    onStartChange={onStartChange}
                    onDueChange={onDueChange}
                    onPriorityChange={onPriorityChange}
                    onDeleteTask={onDeleteTask}
                    onOpenSubtask={() =>
                      setInlineSub({ parentId: t.id, sectionId: t.sectionId })
                    }
                    sort={sort}
                    subtaskComposerOpen={inlineSub?.parentId === t.id}
                    statuses={statuses}
                  />
                  {inlineSub?.parentId === t.id ? (
                    <tr>
                      <td
                        className="border-b! border-border-subtle! bg-subtask-composer-bg! p-2!"
                        colSpan={multiSelectMode ? 11 : 10}
                      >
                        <div className="subtask-composer flex items-center gap-2.5 pl-[58px]">
                          <span
                            className="mb-px ml-1 mr-1 h-[22px] w-3 shrink-0 rounded-bl-lg border-b-2 border-l-2 border-[rgba(111,113,119,0.55)]"
                            aria-hidden
                          />
                          <input
                            ref={subInputRef}
                            className="min-w-0 flex-1 rounded-card border border-border bg-app px-3 py-2 text-[13px]"
                            placeholder="Subtask name — Enter to save, Esc to cancel"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setInlineSub(null);
                                return;
                              }
                              if (e.key !== "Enter") return;
                              const v = (
                                e.target as HTMLInputElement
                              ).value.trim();
                              if (!v) return;
                              onAddSubtask(
                                inlineSub.parentId,
                                inlineSub.sectionId,
                                v,
                              );
                              setInlineSub(null);
                            }}
                          />
                          <button
                            type="button"
                            className="rounded-pill border border-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-hover-surface hover:text-fg data-[open=true]:border-border data-[open=true]:bg-hover-surface data-[open=true]:text-fg"
                            onClick={() => setInlineSub(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </Fragment>
          );
        })
      : Array.from(
          (() => {
            const gmap = new Map<string, TaskDoc[]>();
            for (const t of roots) {
              const k = groupKey(t, group, sections, statuses, uid);
              const arr = gmap.get(k) ?? [];
              arr.push(t);
              gmap.set(k, arr);
            }
            return gmap;
          })().entries(),
        ).map(([key, rowTasks]) => {
          const sorted = sortTasks(rowTasks, sort);
          const ids = sorted.map((t) => t.id);
          return (
            <Fragment key={key}>
              <tr className="hover:[&>td]:bg-transparent">
                {multiSelectMode ? (
                  <td style={{ width: 36, verticalAlign: "middle" }}>
                    {ids.length > 0 ? (
                      <GroupSelectCheckbox
                        taskIds={ids}
                        selectedIds={selectedIds}
                        onSetManySelected={onSetManySelected}
                      />
                    ) : null}
                  </td>
                ) : null}
                <td
                  className="w-8 border-b-0 pb-2 pt-[22px]"
                  aria-hidden
                />
                <td
                  className="border-b-0 pb-2 pt-[22px] text-[13px] font-bold"
                  colSpan={9}
                >
                  <span className="text-[13px] font-bold">{key}</span>
                </td>
              </tr>
              {sorted.map((t) => (
                <Fragment key={t.id}>
                  <TaskRow
                    task={t}
                    subtasks={tasks.filter((x) => x.parentTaskId === t.id)}
                    uid={uid}
                    multiSelectMode={multiSelectMode}
                    selectedIds={selectedIds}
                    pop={pop}
                    setPop={setPop}
                    onToggleSelect={onToggleSelect}
                    onTaskClick={onTaskClick}
                    onStatusChange={onStatusChange}
                    onAssign={onAssign}
                    onStartChange={onStartChange}
                    onDueChange={onDueChange}
                    onPriorityChange={onPriorityChange}
                    onDeleteTask={onDeleteTask}
                    onOpenSubtask={() =>
                      setInlineSub({ parentId: t.id, sectionId: t.sectionId })
                    }
                    sort={sort}
                    subtaskComposerOpen={inlineSub?.parentId === t.id}
                    statuses={statuses}
                  />
                  {inlineSub?.parentId === t.id ? (
                    <tr>
                      <td
                        className="border-b! border-border-subtle! bg-subtask-composer-bg! p-2!"
                        colSpan={multiSelectMode ? 11 : 10}
                      >
                        <div className="subtask-composer flex items-center gap-2.5 pl-[58px]">
                          <span
                            className="mb-px ml-1 mr-1 h-[22px] w-3 shrink-0 rounded-bl-lg border-b-2 border-l-2 border-[rgba(111,113,119,0.55)]"
                            aria-hidden
                          />
                          <input
                            ref={subInputRef}
                            className="min-w-0 flex-1 rounded-card border border-border bg-app px-3 py-2 text-[13px]"
                            placeholder="Subtask name — Enter to save"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setInlineSub(null);
                                return;
                              }
                              if (e.key !== "Enter") return;
                              const v = (
                                e.target as HTMLInputElement
                              ).value.trim();
                              if (!v || !inlineSub) return;
                              onAddSubtask(
                                inlineSub.parentId,
                                inlineSub.sectionId,
                                v,
                              );
                              setInlineSub(null);
                            }}
                          />
                          <button
                            type="button"
                            className="rounded-pill border border-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-hover-surface hover:text-fg data-[open=true]:border-border data-[open=true]:bg-hover-surface data-[open=true]:text-fg"
                            onClick={() => setInlineSub(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </Fragment>
          );
        });

  const draggedTask = dragTaskId
    ? (tasksForMove.find((x) => x.id === dragTaskId) ?? null)
    : null;

  return (
    <DndContext
      sensors={dndSensors}
      collisionDetection={taskDropCollisionDetection}
      onDragStart={(e) => {
        setDragTaskId(parseTaskDragId(e.active.id));
      }}
      onDragCancel={() => setDragTaskId(null)}
      onDragEnd={onDragEndList}
    >
      <div className="min-w-0 max-w-full pb-12">
        <div className="overflow-x-auto px-7 pt-3 [-ms-overflow-style:auto]">
          <table
            className={clsx(
              "table-fixed w-full min-w-[680px] border-separate border-spacing-0",
              multiSelectMode && "[&_.subtask-composer]:pl-[122px]!",
            )}
          >
        <thead>
          <tr>
            {multiSelectMode ? (
              <th
                className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                style={{ width: 36 }}
                aria-label="Select for bulk"
              />
            ) : null}
            <th
              className="sticky top-0 z-1 w-8 border-b border-border bg-app px-0 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              aria-label="Drag to reorder"
              title="Drag tasks using the handle in each row"
            />
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              style={{ width: 44 }}
              title="Done"
            >
              ✓
            </th>
            <th
              className="sticky top-0 z-1 min-w-0 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              style={{ width: "26%" }}
            >
              Task
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              style={{ width: "11%" }}
            >
              Status
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              style={{ width: "10%" }}
              title="Add subtasks"
            >
              Subtasks
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              style={{ width: "14%" }}
            >
              Assignee
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              style={{ width: "11%" }}
            >
              Start
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              style={{ width: "11%" }}
            >
              Due
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              style={{ width: "10%" }}
            >
              Priority
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              style={{ width: 44 }}
              aria-label="Actions"
            />
          </tr>
        </thead>
        <tbody>{sectionBody}</tbody>
      </table>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {draggedTask ? (
          <div className="box-border w-max max-w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-raised px-3 py-2 shadow-lg">
            <div className="flex max-w-full min-w-0 flex-col gap-1.5">
              {draggedTask.statusId ? (
                <StatusTag
                  sid={draggedTask.statusId}
                  statuses={statuses}
                />
              ) : null}
              <p
                className="min-w-0 text-[13px] font-semibold leading-snug text-foreground truncate"
                title={draggedTask.title || undefined}
              >
                {draggedTask.title.trim() || "Untitled task"}
              </p>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function TaskRowMetaColumns({
  t,
  uid,
  pop,
  setPop,
  subtaskQuickAdd,
  onAssign,
  onStartChange,
  onDueChange,
  onPriorityChange,
  onDeleteTask,
  onTaskClick,
  onOpenSubtask,
  statuses,
}: {
  t: TaskDoc;
  uid: string;
  pop: Pop;
  setPop: (p: Pop) => void;
  subtaskQuickAdd: { count: number; onAdd: () => void } | null;
  onAssign: (taskId: string, assigneeId: string | null) => void;
  onStartChange: (taskId: string, ymd: string | null) => void;
  onDueChange: (taskId: string, ymd: string | null) => void;
  onPriorityChange: (taskId: string, priority: TaskDoc["priority"]) => void;
  onDeleteTask: (taskId: string) => void;
  onTaskClick: (t: TaskDoc) => void;
  onOpenSubtask: () => void;
  statuses: StatusDoc[];
}) {
  const start = tsToDate(t.startDate);
  const due = tsToDate(t.dueDate);
  const dueState = dueBadgeState(due, t.completed);
  const assigneeLabel =
    t.assigneeId === uid ? "You" : t.assigneeId ? "Member" : "Assign";
  const prios: TaskDoc["priority"][] = ["low", "medium", "high", "urgent"];

  const stopProp = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <td className="align-middle">
        <div className="flex min-h-9 items-center">
          <StatusTag sid={t.statusId} statuses={statuses} />
        </div>
      </td>
      {subtaskQuickAdd ? (
        <td
          className="align-middle"
          data-popover-root
          onClick={stopProp}
          onKeyDown={stopProp}
        >
          <div className="flex min-h-9 items-center">
            <button
              type="button"
              className={clsx(
                "subtask-quick-btn inline-flex max-w-full shrink-0 cursor-pointer flex-nowrap items-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12px] leading-none text-muted-foreground transition-colors duration-120 hover:bg-hover-surface hover:text-fg [&.is-set]:border-border-subtle [&.is-set]:text-fg",
                subtaskQuickAdd.count > 0 && "is-set",
              )}
              title={
                subtaskQuickAdd.count > 0 ? "Add another subtask" : "Add subtask"
              }
              onClick={() => subtaskQuickAdd.onAdd()}
            >
              <IconPlus width={14} height={14} className="shrink-0" />
              <span className="truncate">
                {subtaskQuickAdd.count > 0
                  ? `${subtaskQuickAdd.count} subtasks`
                  : "Add subtask"}
              </span>
            </button>
          </div>
        </td>
      ) : (
        <td
          className="select-none align-middle text-center text-[13px] text-muted-foreground"
          title="Nested subtasks are not supported. Add subtasks from the parent task in the list."
        >
          <div className="flex min-h-9 items-center justify-center">
            <span className="opacity-45" aria-hidden>
              —
            </span>
          </div>
        </td>
      )}
      <td
        className="align-middle"
        style={{ position: "relative" }}
        data-popover-root
        onClick={stopProp}
        onKeyDown={stopProp}
      >
        <div className="flex min-h-9 items-center">
          <button
            type="button"
            className={clsx(
              "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12px] leading-none text-muted-foreground transition-colors duration-120 hover:bg-hover-surface hover:text-fg [&.is-set]:border-border-subtle [&.is-set]:text-fg",
              t.assigneeId && "is-set",
            )}
          onClick={() =>
            setPop(
              pop?.k === "assign" && pop.taskId === t.id
                ? null
                : { k: "assign", taskId: t.id },
            )
          }
        >
            <IconUser width={14} height={14} className="shrink-0" />
            <span className="truncate">{assigneeLabel}</span>
          </button>
        </div>
        {pop?.k === "assign" && pop.taskId === t.id ? (
          <div
            className="absolute left-0 top-[calc(100%+4px)] z-50 flex min-w-[180px] max-w-[min(320px,calc(100vw-1.5rem))] flex-col gap-0.5 rounded-modal border border-border-subtle bg-sidebar p-1.5 shadow-inline-popover"
            data-popover-root
          >
            <button
              type="button"
              className="w-full rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[13px] text-fg hover:bg-hover-surface"
              onClick={() => {
                onAssign(t.id, uid);
                setPop(null);
              }}
            >
              Assign to me
            </button>
            <button
              type="button"
              className="w-full rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[13px] text-fg hover:bg-hover-surface"
              onClick={() => {
                onAssign(t.id, null);
                setPop(null);
              }}
            >
              Unassigned
            </button>
          </div>
        ) : null}
      </td>
      <td
        className="align-middle"
        style={{ position: "relative" }}
        data-popover-root
        onClick={stopProp}
        onKeyDown={stopProp}
      >
        <div className="flex min-h-9 items-center">
          <button
            type="button"
            className={clsx(
              "start-cell-btn inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12px] leading-none text-muted-foreground transition-colors duration-120 hover:bg-hover-surface hover:text-fg [&.is-set]:border-border-subtle [&.is-set]:text-fg",
              start && "is-set",
            )}
          onClick={() =>
            setPop(
              pop?.k === "start" && pop.taskId === t.id
                ? null
                : { k: "start", taskId: t.id },
            )
          }
        >
            <IconCalendar width={14} height={14} className="shrink-0" />
            <span className="truncate">{fmtDate(start)}</span>
          </button>
        </div>
        {pop?.k === "start" && pop.taskId === t.id ? (
          <div
            className="absolute right-0 top-[calc(100%+4px)] z-50 flex min-w-[220px] max-w-[min(320px,calc(100vw-1.5rem))] flex-col gap-0.5 rounded-modal border border-border-subtle bg-sidebar p-1.5 shadow-inline-popover"
            data-popover-root
          >
            <div className="px-0.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Start date
            </div>
            <input
              type="date"
              className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
              defaultValue={dateToInputValue(start)}
              onChange={(e) => onStartChange(t.id, e.target.value || null)}
            />
            <button
              type="button"
              className="mt-1.5 cursor-pointer border-none bg-transparent p-0 text-left text-[12px] text-share hover:underline"
              onClick={() => {
                onStartChange(t.id, null);
                setPop(null);
              }}
            >
              Clear start date
            </button>
          </div>
        ) : null}
      </td>
      <td
        className="align-middle"
        style={{ position: "relative" }}
        data-popover-root
        onClick={stopProp}
        onKeyDown={stopProp}
      >
        <div className="flex min-h-9 items-center">
          <button
            type="button"
            className={clsx(
              "due-cell-btn inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12px] leading-none text-muted-foreground transition-colors duration-120 hover:bg-hover-surface hover:text-fg [&.is-set]:border-border-subtle [&.is-set]:text-fg",
              due && "is-set",
            )}
          onClick={() =>
            setPop(
              pop?.k === "due" && pop.taskId === t.id
                ? null
                : { k: "due", taskId: t.id },
            )
          }
        >
            <IconCalendar width={14} height={14} className="shrink-0" />
            <span
              className={clsx(
                "truncate",
                dueState !== "none" && "font-medium normal-case",
                dueState === "overdue" && "text-soft-danger",
                dueState === "soon" && "text-prio-med-fg",
              )}
            >
              {fmtDate(due)}
            </span>
          </button>
        </div>
        {pop?.k === "due" && pop.taskId === t.id ? (
          <div
            className="absolute right-0 top-[calc(100%+4px)] z-50 flex min-w-[220px] max-w-[min(320px,calc(100vw-1.5rem))] flex-col gap-0.5 rounded-modal border border-border-subtle bg-sidebar p-1.5 shadow-inline-popover"
            data-popover-root
          >
            <div className="px-0.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Due date
            </div>
            <input
              type="date"
              className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
              defaultValue={dateToInputValue(due)}
              onChange={(e) => onDueChange(t.id, e.target.value || null)}
            />
            <button
              type="button"
              className="mt-1.5 cursor-pointer border-none bg-transparent p-0 text-left text-[12px] text-share hover:underline"
              onClick={() => {
                onDueChange(t.id, null);
                setPop(null);
              }}
            >
              Clear due date
            </button>
          </div>
        ) : null}
      </td>
      <td
        className="align-middle"
        style={{ position: "relative" }}
        data-popover-root
        onClick={stopProp}
        onKeyDown={stopProp}
      >
        <div className="flex min-h-9 items-center">
          <button
            type="button"
            className="cursor-pointer rounded-pill border border-border-subtle bg-app px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-wide text-fg data-[p=low]:border-transparent data-[p=low]:bg-prio-low-bg data-[p=low]:text-prio-low-fg data-[p=medium]:border-transparent data-[p=medium]:bg-prio-med-bg data-[p=medium]:text-prio-med-fg data-[p=high]:border-transparent data-[p=high]:bg-prio-high-bg data-[p=high]:text-prio-high-fg data-[p=urgent]:border-transparent data-[p=urgent]:bg-prio-urgent-bg data-[p=urgent]:text-prio-urgent-fg"
            data-p={t.priority}
          onClick={() =>
            setPop(
              pop?.k === "prio" && pop.taskId === t.id
                ? null
                : { k: "prio", taskId: t.id },
            )
          }
          >
            {t.priority}
          </button>
        </div>
        {pop?.k === "prio" && pop.taskId === t.id ? (
          <div
            className="absolute right-0 top-[calc(100%+4px)] z-50 flex min-w-[180px] max-w-[min(320px,calc(100vw-1.5rem))] flex-col gap-0.5 rounded-modal border border-border-subtle bg-sidebar p-1.5 shadow-inline-popover"
            data-popover-root
          >
            {prios.map((p) => (
              <button
                key={p}
                type="button"
                className="w-full rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[13px] text-fg hover:bg-hover-surface"
                onClick={() => {
                  onPriorityChange(t.id, p);
                  setPop(null);
                }}
              >
                {p}
              </button>
            ))}
          </div>
        ) : null}
      </td>
      <td
        className="align-middle"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-9 items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid size-8 shrink-0 place-items-center rounded-card font-black tracking-wide text-muted-foreground transition-colors hover:bg-hover-surface hover:text-fg data-[state=open]:bg-hover-surface data-[state=open]:text-fg"
                aria-label="Task actions"
              >
                ···
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              collisionPadding={8}
              className="min-w-[180px] max-w-[min(320px,calc(100vw-1.5rem))]"
            >
              <DropdownMenuItem
                className="text-[13px]"
                onSelect={() => onTaskClick(t)}
              >
                Open details
              </DropdownMenuItem>
              {subtaskQuickAdd ? (
                <DropdownMenuItem
                  className="text-[13px]"
                  onSelect={() => onOpenSubtask()}
                >
                  <IconPlus width={14} height={14} />
                  Add subtask
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="text-[13px]"
                onSelect={() => void onDeleteTask(t.id)}
              >
                Delete task…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </>
  );
}

function TaskStatusPickCell({
  t,
  statuses,
  pop,
  setPop,
  onStatusChange,
}: {
  t: TaskDoc;
  statuses: StatusDoc[];
  pop: Pop;
  setPop: (p: Pop) => void;
  onStatusChange: (taskId: string, statusId: string | null) => void;
}) {
  const open = pop?.k === "statuspick" && pop.taskId === t.id;
  const ordered = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <td
      className="align-middle"
      style={{ position: "relative" }}
      data-popover-root
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex min-h-9 items-center justify-center">
        <button
          type="button"
          className="size-4 shrink-0 rounded border-[1.5px] border-placeholder shadow-[inset_0_0_0_2px_var(--color-app)] data-[done=true]:border-tick-done data-[done=true]:bg-tick-done"
          data-done={t.completed ? "true" : "false"}
          title="Change status"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            setPop(open ? null : { k: "statuspick", taskId: t.id });
          }}
        />
      </div>
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)] z-50 flex max-h-[min(320px,70vh)] min-w-[200px] max-w-[min(320px,calc(100vw-1.5rem))] flex-col gap-0.5 overflow-y-auto rounded-modal border border-border-subtle bg-sidebar p-1.5 shadow-inline-popover"
          data-popover-root
          role="listbox"
          aria-label="Task status"
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Status
          </div>
          <button
            type="button"
            role="option"
            aria-selected={t.statusId === null}
            className="flex w-full items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[13px] text-fg hover:bg-hover-surface"
            onClick={() => {
              onStatusChange(t.id, null);
              setPop(null);
            }}
          >
            <span className="inline-block size-2.5 shrink-0 rounded-sm bg-border-subtle" />
            No status
          </button>
          {ordered.map((s) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={t.statusId === s.id}
              className="flex w-full items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[13px] text-fg hover:bg-hover-surface"
              onClick={() => {
                onStatusChange(t.id, s.id);
                setPop(null);
              }}
            >
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
    </td>
  );
}

function TaskRow({
  task: t,
  subtasks,
  uid,
  multiSelectMode,
  selectedIds,
  pop,
  setPop,
  onToggleSelect,
  onTaskClick,
  onStatusChange,
  onAssign,
  onStartChange,
  onDueChange,
  onPriorityChange,
  onDeleteTask,
  onOpenSubtask,
  sort,
  subtaskComposerOpen,
  statuses,
}: {
  task: TaskDoc;
  subtasks: TaskDoc[];
  uid: string;
  multiSelectMode: boolean;
  selectedIds: Set<string>;
  pop: Pop;
  setPop: (p: Pop) => void;
  onToggleSelect: (taskId: string) => void;
  onTaskClick: (t: TaskDoc) => void;
  onStatusChange: (taskId: string, statusId: string | null) => void;
  onAssign: (taskId: string, assigneeId: string | null) => void;
  onStartChange: (taskId: string, ymd: string | null) => void;
  onDueChange: (taskId: string, ymd: string | null) => void;
  onPriorityChange: (taskId: string, priority: TaskDoc["priority"]) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenSubtask: () => void;
  sort: SortMode;
  subtaskComposerOpen: boolean;
  statuses: StatusDoc[];
}) {
  const orderedSubtasks = sortTasks(subtasks, sort);

  const handleTaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      onTaskClick(t);
    }
  };

  return (
    <>
      <ListTaskContextMenu
        task={t}
        allowAddSubtask
        onTaskClick={onTaskClick}
        onOpenSubtask={onOpenSubtask}
        onDeleteTask={onDeleteTask}
      >
        <tr className="group/task [&>td]:border-b [&>td]:border-border-subtle [&>td]:align-middle [&>td]:px-3 [&>td]:py-2 hover:[&>td]:bg-row-hover">
          {multiSelectMode ? (
            <td className="align-middle">
              <input
                type="checkbox"
                className="size-4 shrink-0 cursor-pointer rounded border-[1.5px] border-placeholder bg-app accent-share"
                title="Select for bulk actions"
                checked={selectedIds.has(t.id)}
                onChange={() => onToggleSelect(t.id)}
                onClick={(e) => e.stopPropagation()}
              />
            </td>
          ) : null}
          <ListDragHandleCell taskId={t.id} />
          <TaskStatusPickCell
            t={t}
            statuses={statuses}
            pop={pop}
            setPop={setPop}
            onStatusChange={onStatusChange}
          />
          <TaskTitleDropCell
            task={t}
            isRoot={!t.parentTaskId}
            onClick={() => onTaskClick(t)}
            onKeyDown={handleTaskKeyDown}
          >
            {t.title}
          </TaskTitleDropCell>
          <TaskRowMetaColumns
            t={t}
            uid={uid}
            pop={pop}
            setPop={setPop}
            subtaskQuickAdd={{
              count: subtasks.length,
              onAdd: onOpenSubtask,
            }}
            onAssign={onAssign}
            onStartChange={onStartChange}
            onDueChange={onDueChange}
            onPriorityChange={onPriorityChange}
            onDeleteTask={onDeleteTask}
            onTaskClick={onTaskClick}
            onOpenSubtask={onOpenSubtask}
            statuses={statuses}
          />
        </tr>
      </ListTaskContextMenu>
      {orderedSubtasks.map((st, si) => {
        const isLastSubInTree =
          si === orderedSubtasks.length - 1 && !subtaskComposerOpen;
        const handleSubKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            onTaskClick(st);
          }
        };
        return (
          <ListTaskContextMenu
            key={st.id}
            task={st}
            allowAddSubtask={false}
            onTaskClick={onTaskClick}
            onOpenSubtask={onOpenSubtask}
            onDeleteTask={onDeleteTask}
          >
            <tr className="group/task [&>td]:border-b [&>td]:border-border-subtle [&>td]:align-middle [&>td]:px-3 [&>td]:py-2 hover:[&>td]:bg-row-hover">
              {multiSelectMode ? (
                <td className="align-middle">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 cursor-pointer rounded border-[1.5px] border-placeholder bg-app accent-share"
                    checked={selectedIds.has(st.id)}
                    onChange={() => onToggleSelect(st.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
              ) : null}
              <ListDragHandleCell taskId={st.id} />
              <TaskStatusPickCell
                t={st}
                statuses={statuses}
                pop={pop}
                setPop={setPop}
                onStatusChange={onStatusChange}
              />
              <td
                className="align-middle"
                onClick={() => onTaskClick(st)}
                onKeyDown={handleSubKeyDown}
                style={{ cursor: "pointer", verticalAlign: "middle" }}
              >
                <div className="flex min-h-9 items-center gap-1.5">
                  <span
                    className={clsx(
                      "relative min-h-9 w-[22px] shrink-0 self-stretch before:pointer-events-none after:pointer-events-none before:absolute before:left-2.5 before:top-0 before:border-l-2 before:border-[rgba(111,113,119,0.55)] after:absolute after:left-2.5 after:top-1/2 after:h-0 after:w-3 after:-translate-y-px after:border-t-2 after:border-[rgba(111,113,119,0.55)]",
                      isLastSubInTree ? "before:bottom-1/2" : "before:bottom-0",
                    )}
                    aria-hidden
                  />
                  <span className="text-[13px] font-semibold">{st.title}</span>
                </div>
              </td>
              <TaskRowMetaColumns
                t={st}
                uid={uid}
                pop={pop}
                setPop={setPop}
                subtaskQuickAdd={null}
                onAssign={onAssign}
                onStartChange={onStartChange}
                onDueChange={onDueChange}
                onPriorityChange={onPriorityChange}
                onDeleteTask={onDeleteTask}
                onTaskClick={onTaskClick}
                onOpenSubtask={onOpenSubtask}
                statuses={statuses}
              />
            </tr>
          </ListTaskContextMenu>
        );
      })}
    </>
  );
}
