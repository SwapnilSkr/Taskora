import clsx from "clsx";
import { startOfDay } from "date-fns";
import { CheckIcon } from "lucide-react";
import type React from "react";
import type { Matcher } from "react-day-picker";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  deferContextMenuAction,
  listRowPortaledOverlayHandlers,
  useTaskRowClick,
} from "../utils/listTaskRowOpen";

export type GroupMode = "section" | "assignee" | "due" | "status" | "priority";
export type SortMode = "sortOrder" | "dueDate" | "priority" | "name";

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
  onRequestRenameTask: (taskId: string, currentTitle: string) => void;
  onRequestRenameSection: (sectionId: string, currentName: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onMoveTask: (taskId: string, patch: TaskMovePatch) => void;
};

/** Controlled popover + shadcn Calendar; closes on pick (native date input remounted the tree and broke dismiss). */
function ListRowDatePopover({
  label,
  value,
  onCommit,
  onOverlayClosed,
  ariaLabel,
  triggerClassName,
  calendarDisabled,
  children,
}: {
  label: string;
  value: Date | null;
  onCommit: (ymd: string | null) => void;
  onOverlayClosed: () => void;
  ariaLabel: string;
  triggerClassName: string;
  /** When set, grey out days outside the allowed range (pair with the opposite date). */
  calendarDisabled?: Matcher | Matcher[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onOverlayClosed();
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          data-row-action
          className={triggerClassName}
          aria-label={ariaLabel}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        {...listRowPortaledOverlayHandlers}
        align="end"
        sideOffset={4}
        collisionPadding={8}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          requestAnimationFrame(() => {
            triggerRef.current?.focus({ preventScroll: true });
          });
        }}
        className="w-auto max-w-[min(320px,calc(100vw-1.5rem))] gap-2 p-2"
      >
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(d) => {
            if (d) onCommit(dateToInputValue(d));
            setOpen(false);
            onOverlayClosed();
          }}
          disabled={calendarDisabled}
          initialFocus
        />
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent p-0 text-left text-[12px] text-share hover:underline"
          onClick={() => {
            onCommit(null);
            setOpen(false);
            onOverlayClosed();
          }}
        >
          Clear {label.toLowerCase()}
        </button>
      </PopoverContent>
    </Popover>
  );
}

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
      <span className="inline-block size-2.5 rounded-full bg-border-subtle" />
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
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() =>
            deferContextMenuAction(() => onAddTask(section.id))
          }
        >
          Add task
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() =>
            deferContextMenuAction(() =>
              onRequestRenameSection(section.id, section.name),
            )
          }
        >
          Rename section…
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onSelect={() =>
            deferContextMenuAction(() => void onDeleteSection(section.id))
          }
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
  onRequestRenameTask,
  onDeleteTask,
  children,
}: {
  task: TaskDoc;
  allowAddSubtask: boolean;
  onTaskClick: (t: TaskDoc) => void;
  onOpenSubtask: () => void;
  onRequestRenameTask: (taskId: string, currentTitle: string) => void;
  onDeleteTask: (taskId: string) => void;
  children: React.ReactElement;
}) {
  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() =>
            deferContextMenuAction(() => onTaskClick(task))
          }
        >
          Open details
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() =>
            deferContextMenuAction(() =>
              onRequestRenameTask(task.id, task.title),
            )
          }
        >
          Rename…
        </ContextMenuItem>
        {allowAddSubtask ? (
          <ContextMenuItem
            onSelect={() =>
              deferContextMenuAction(() => onOpenSubtask())
            }
          >
            Add subtask
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onSelect={() =>
            deferContextMenuAction(() => void onDeleteTask(task.id))
          }
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
      className="size-4 shrink-0 cursor-pointer rounded-full border-[1.5px] border-placeholder bg-app accent-share"
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
          data-row-action
          className={clsx(
            "grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-row-hover hover:text-fg active:cursor-grabbing",
            isDragging && "opacity-40",
          )}
          title="Drag to a section header to move or promote; drag to a task name to nest under it"
          {...listeners}
          {...attributes}
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
  onKeyDown,
  children,
}: {
  task: TaskDoc;
  isRoot: boolean;
  onKeyDown: (e: React.KeyboardEvent) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: parentTaskDropId(task.id),
    disabled: !isRoot,
  });
  return (
    <td
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ verticalAlign: "middle" }}
      className={clsx(
        "min-w-0 align-middle outline-none focus-visible:ring-2 focus-visible:ring-share/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
  onRequestRenameTask,
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
  const [inlineSub, setInlineSub] = useState<{
    parentId: string;
    sectionId: string;
  } | null>(null);
  const subInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inlineSub) subInputRef.current?.focus({ preventScroll: true });
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
                      <DropdownMenu modal={false}>
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
                    onToggleSelect={onToggleSelect}
                    onTaskClick={onTaskClick}
                    onStatusChange={onStatusChange}
                    onAssign={onAssign}
                    onStartChange={onStartChange}
                    onDueChange={onDueChange}
                    onPriorityChange={onPriorityChange}
                    onDeleteTask={onDeleteTask}
                    onRequestRenameTask={onRequestRenameTask}
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
                    onToggleSelect={onToggleSelect}
                    onTaskClick={onTaskClick}
                    onStatusChange={onStatusChange}
                    onAssign={onAssign}
                    onStartChange={onStartChange}
                    onDueChange={onDueChange}
                    onPriorityChange={onPriorityChange}
                    onDeleteTask={onDeleteTask}
                    onRequestRenameTask={onRequestRenameTask}
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
        <div className="overflow-x-auto px-3 pt-3 [-ms-overflow-style:auto] sm:px-5 md:px-7">
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
  subtaskQuickAdd,
  onAssign,
  onStartChange,
  onDueChange,
  onPriorityChange,
  onDeleteTask,
  onTaskClick,
  onOpenSubtask,
  onOverlayClosed,
  statuses,
}: {
  t: TaskDoc;
  uid: string;
  subtaskQuickAdd: { count: number; onAdd: () => void } | null;
  onAssign: (taskId: string, assigneeId: string | null) => void;
  onStartChange: (taskId: string, ymd: string | null) => void;
  onDueChange: (taskId: string, ymd: string | null) => void;
  onPriorityChange: (taskId: string, priority: TaskDoc["priority"]) => void;
  onDeleteTask: (taskId: string) => void;
  onTaskClick: (t: TaskDoc) => void;
  onOpenSubtask: () => void;
  onOverlayClosed: () => void;
  statuses: StatusDoc[];
}) {
  const start = tsToDate(t.startDate);
  const due = tsToDate(t.dueDate);
  const dueState = dueBadgeState(due, t.completed);
  const assigneeLabel =
    t.assigneeId === uid ? "You" : t.assigneeId ? "Member" : "Assign";
  const prios: TaskDoc["priority"][] = ["low", "medium", "high", "urgent"];

  return (
    <>
      <td className="align-middle">
        <div className="flex min-h-9 items-center">
          <StatusTag sid={t.statusId} statuses={statuses} />
        </div>
      </td>
      {subtaskQuickAdd ? (
        <td className="align-middle">
          <div className="flex min-h-9 items-center">
            <button
              type="button"
              data-row-action
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
      <td className="align-middle">
        <div className="flex min-h-9 min-w-0 items-center">
          <DropdownMenu
            modal={false}
            onOpenChange={(open) => {
              if (!open) onOverlayClosed();
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-row-action
                className={clsx(
                  "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12px] leading-none text-muted-foreground transition-colors duration-120 outline-none hover:bg-hover-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-share/40 [&.is-set]:border-border-subtle [&.is-set]:text-fg",
                  t.assigneeId && "is-set",
                )}
                aria-label="Assign task"
              >
                <IconUser width={14} height={14} className="shrink-0" />
                <span className="truncate">{assigneeLabel}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              {...listRowPortaledOverlayHandlers}
              align="start"
              sideOffset={4}
              collisionPadding={8}
              className="min-w-[180px] max-w-[min(320px,calc(100vw-1.5rem))]"
            >
              <DropdownMenuItem
                className="text-[13px]"
                onSelect={() => onAssign(t.id, uid)}
              >
                Assign to me
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-[13px]"
                onSelect={() => onAssign(t.id, null)}
              >
                Unassigned
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
      <td className="align-middle">
        <div className="flex min-h-9 min-w-0 items-center">
          <ListRowDatePopover
            label="Start date"
            value={start}
            onCommit={(ymd) => onStartChange(t.id, ymd)}
            onOverlayClosed={onOverlayClosed}
            ariaLabel="Start date"
            calendarDisabled={
              due ? { after: startOfDay(due) } : undefined
            }
            triggerClassName={clsx(
              "start-cell-btn inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12px] leading-none text-muted-foreground outline-none transition-colors duration-120 hover:bg-hover-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-share/40 [&.is-set]:border-border-subtle [&.is-set]:text-fg",
              start && "is-set",
            )}
          >
            <IconCalendar width={14} height={14} className="shrink-0" />
            <span className="truncate">{fmtDate(start)}</span>
          </ListRowDatePopover>
        </div>
      </td>
      <td className="align-middle">
        <div className="flex min-h-9 min-w-0 items-center">
          <ListRowDatePopover
            label="Due date"
            value={due}
            onCommit={(ymd) => onDueChange(t.id, ymd)}
            onOverlayClosed={onOverlayClosed}
            ariaLabel="Due date"
            calendarDisabled={
              start ? { before: startOfDay(start) } : undefined
            }
            triggerClassName={clsx(
              "due-cell-btn inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12px] leading-none text-muted-foreground outline-none transition-colors duration-120 hover:bg-hover-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-share/40 [&.is-set]:border-border-subtle [&.is-set]:text-fg",
              due && "is-set",
            )}
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
          </ListRowDatePopover>
        </div>
      </td>
      <td className="align-middle">
        <div className="flex min-h-9 min-w-0 items-center">
          <DropdownMenu
            modal={false}
            onOpenChange={(open) => {
              if (!open) onOverlayClosed();
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-row-action
                className="cursor-pointer rounded-pill border border-border-subtle bg-app px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-wide text-fg outline-none focus-visible:ring-2 focus-visible:ring-share/40 data-[p=low]:border-transparent data-[p=low]:bg-prio-low-bg data-[p=low]:text-prio-low-fg data-[p=medium]:border-transparent data-[p=medium]:bg-prio-med-bg data-[p=medium]:text-prio-med-fg data-[p=high]:border-transparent data-[p=high]:bg-prio-high-bg data-[p=high]:text-prio-high-fg data-[p=urgent]:border-transparent data-[p=urgent]:bg-prio-urgent-bg data-[p=urgent]:text-prio-urgent-fg"
                data-p={t.priority}
                aria-label="Priority"
              >
                {t.priority}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              {...listRowPortaledOverlayHandlers}
              align="end"
              sideOffset={4}
              collisionPadding={8}
              className="min-w-[180px] max-w-[min(320px,calc(100vw-1.5rem))]"
            >
              {prios.map((p) => (
                <DropdownMenuItem
                  key={p}
                  className="text-[13px] capitalize"
                  onSelect={() => onPriorityChange(t.id, p)}
                >
                  {p}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
      <td className="align-middle">
        <div className="flex min-h-9 items-center justify-end">
          <DropdownMenu
            modal={false}
            onOpenChange={(open) => {
              if (!open) onOverlayClosed();
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-row-action
                className="grid size-8 shrink-0 place-items-center rounded-card font-black tracking-wide text-muted-foreground transition-colors hover:bg-hover-surface hover:text-fg data-[state=open]:bg-hover-surface data-[state=open]:text-fg"
                aria-label="Task actions"
              >
                ···
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              {...listRowPortaledOverlayHandlers}
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
  onStatusChange,
  onOverlayClosed,
}: {
  t: TaskDoc;
  statuses: StatusDoc[];
  onStatusChange: (taskId: string, statusId: string | null) => void;
  onOverlayClosed: () => void;
}) {
  const ordered = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <td className="align-middle">
      <div className="flex min-h-9 items-center justify-center">
        <DropdownMenu
          modal={false}
          onOpenChange={(open) => {
            if (!open) onOverlayClosed();
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-row-action
              className="relative grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-placeholder bg-app shadow-[inset_0_0_0_2px_var(--color-app)] outline-none focus-visible:ring-2 focus-visible:ring-share/40 data-[done=true]:border-primary data-[done=true]:bg-primary data-[done=true]:text-primary-foreground data-[done=true]:shadow-none"
              data-done={t.completed ? "true" : "false"}
              title="Change status"
              aria-label="Change task status"
            >
              {t.completed ? (
                <CheckIcon
                  className="size-2.5 text-primary-foreground"
                  strokeWidth={2.75}
                  aria-hidden
                />
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            {...listRowPortaledOverlayHandlers}
            align="start"
            sideOffset={4}
            collisionPadding={8}
            className="max-h-[min(320px,70vh)] min-w-[200px] max-w-[min(320px,calc(100vw-1.5rem))] overflow-y-auto"
          >
            <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Status
            </DropdownMenuLabel>
            <DropdownMenuItem
              className="cursor-pointer text-[13px]"
              onSelect={() => onStatusChange(t.id, null)}
            >
              <span className="inline-block size-2.5 shrink-0 rounded-full bg-border-subtle" />
              No status
            </DropdownMenuItem>
            {ordered.map((s) => (
              <DropdownMenuItem
                key={s.id}
                className="cursor-pointer text-[13px]"
                onSelect={() => onStatusChange(t.id, s.id)}
              >
                <span
                  className="inline-block size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                {s.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </td>
  );
}

function TaskRow({
  task: t,
  subtasks,
  uid,
  multiSelectMode,
  selectedIds,
  onToggleSelect,
  onTaskClick,
  onStatusChange,
  onAssign,
  onStartChange,
  onDueChange,
  onPriorityChange,
  onDeleteTask,
  onRequestRenameTask,
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
  onToggleSelect: (taskId: string) => void;
  onTaskClick: (t: TaskDoc) => void;
  onStatusChange: (taskId: string, statusId: string | null) => void;
  onAssign: (taskId: string, assigneeId: string | null) => void;
  onStartChange: (taskId: string, ymd: string | null) => void;
  onDueChange: (taskId: string, ymd: string | null) => void;
  onPriorityChange: (taskId: string, priority: TaskDoc["priority"]) => void;
  onDeleteTask: (taskId: string) => void;
  onRequestRenameTask: (taskId: string, currentTitle: string) => void;
  onOpenSubtask: () => void;
  sort: SortMode;
  subtaskComposerOpen: boolean;
  statuses: StatusDoc[];
}) {
  const orderedSubtasks = sortTasks(subtasks, sort);

  const { rowClick, onOverlayClosed } = useTaskRowClick(onTaskClick);

  const handleTaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
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
        onRequestRenameTask={onRequestRenameTask}
        onDeleteTask={onDeleteTask}
      >
        <tr
          className="group/task cursor-pointer [&>td]:border-b [&>td]:border-border-subtle [&>td]:align-middle [&>td]:px-3 [&>td]:py-2 hover:[&>td]:bg-row-hover"
          onClick={rowClick(t)}
        >
          {multiSelectMode ? (
            <td className="align-middle">
              <input
                type="checkbox"
                data-row-action
                className="size-4 shrink-0 cursor-pointer rounded-full border-[1.5px] border-placeholder bg-app accent-share"
                title="Select for bulk actions"
                checked={selectedIds.has(t.id)}
                onChange={() => onToggleSelect(t.id)}
              />
            </td>
          ) : null}
          <ListDragHandleCell taskId={t.id} />
          <TaskStatusPickCell
            t={t}
            statuses={statuses}
            onStatusChange={onStatusChange}
            onOverlayClosed={onOverlayClosed}
          />
          <TaskTitleDropCell
            task={t}
            isRoot={!t.parentTaskId}
            onKeyDown={handleTaskKeyDown}
          >
            {t.title}
          </TaskTitleDropCell>
          <TaskRowMetaColumns
            t={t}
            uid={uid}
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
            onOverlayClosed={onOverlayClosed}
            statuses={statuses}
          />
        </tr>
      </ListTaskContextMenu>
      {orderedSubtasks.map((st, si) => {
        const isLastSubInTree =
          si === orderedSubtasks.length - 1 && !subtaskComposerOpen;
        const handleSubKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
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
            onRequestRenameTask={onRequestRenameTask}
            onDeleteTask={onDeleteTask}
          >
            <tr
              className="group/task cursor-pointer [&>td]:border-b [&>td]:border-border-subtle [&>td]:align-middle [&>td]:px-3 [&>td]:py-2 hover:[&>td]:bg-row-hover"
              onClick={rowClick(st)}
            >
              {multiSelectMode ? (
                <td className="align-middle">
                  <input
                    type="checkbox"
                    data-row-action
                    className="size-4 shrink-0 cursor-pointer rounded-full border-[1.5px] border-placeholder bg-app accent-share"
                    checked={selectedIds.has(st.id)}
                    onChange={() => onToggleSelect(st.id)}
                  />
                </td>
              ) : null}
              <ListDragHandleCell taskId={st.id} />
              <TaskStatusPickCell
                t={st}
                statuses={statuses}
                onStatusChange={onStatusChange}
                onOverlayClosed={onOverlayClosed}
              />
              <td
                className="align-middle outline-none focus-visible:ring-2 focus-visible:ring-share/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                tabIndex={0}
                onKeyDown={handleSubKeyDown}
                style={{ verticalAlign: "middle" }}
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
                subtaskQuickAdd={null}
                onAssign={onAssign}
                onStartChange={onStartChange}
                onDueChange={onDueChange}
                onPriorityChange={onPriorityChange}
                onDeleteTask={onDeleteTask}
                onTaskClick={onTaskClick}
                onOpenSubtask={onOpenSubtask}
                onOverlayClosed={onOverlayClosed}
                statuses={statuses}
              />
            </tr>
          </ListTaskContextMenu>
        );
      })}
    </>
  );
}
