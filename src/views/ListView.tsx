import clsx from "clsx";
import type React from "react";
import { Fragment, useEffect, useRef, useState } from "react";
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
  | { k: "taskmenu"; taskId: string }
  | { k: "sectionmenu"; sectionId: string };

type Props = {
  sections: SectionDoc[];
  statuses: StatusDoc[];
  tasks: TaskDoc[];
  group: GroupMode;
  sort: SortMode;
  uid: string;
  multiSelectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (taskId: string) => void;
  onSetManySelected: (taskIds: string[], selected: boolean) => void;
  onTaskClick: (t: TaskDoc) => void;
  onToggleComplete: (t: TaskDoc) => void;
  onAddTask: (sectionId: string) => void;
  onAssign: (taskId: string, assigneeId: string | null) => void;
  onStartChange: (taskId: string, ymd: string | null) => void;
  onDueChange: (taskId: string, ymd: string | null) => void;
  onPriorityChange: (taskId: string, priority: TaskDoc["priority"]) => void;
  onAddSubtask: (parentId: string, sectionId: string, title: string) => void;
  onDeleteTask: (taskId: string) => void;
  onRequestRenameSection: (sectionId: string, currentName: string) => void;
  onDeleteSection: (sectionId: string) => void;
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

export function ListView({
  sections,
  statuses,
  tasks,
  group,
  sort,
  uid,
  multiSelectMode,
  selectedIds,
  onToggleSelect,
  onSetManySelected,
  onTaskClick,
  onToggleComplete,
  onAddTask,
  onAssign,
  onStartChange,
  onDueChange,
  onPriorityChange,
  onAddSubtask,
  onDeleteTask,
  onRequestRenameSection,
  onDeleteSection,
}: Props) {
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
                  className="border-b-0 pb-2 pt-[22px] text-[13px] font-bold"
                  colSpan={8}
                >
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-[13px] font-bold">{s.name}</span>
                    <button
                      type="button"
                      className="rounded-pill border border-transparent px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-hover-surface hover:text-fg data-[open=true]:border-border data-[open=true]:bg-hover-surface data-[open=true]:text-fg"
                      onClick={() => onAddTask(s.id)}
                    >
                      + Add task
                    </button>
                    <div className="relative inline-flex items-center" data-popover-root>
                      <button
                        type="button"
                        className="grid place-items-center rounded-md px-1.5 py-1 text-muted transition-colors hover:bg-hover-surface hover:text-fg [&_svg]:size-[18px]"
                        aria-label="Section options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPop(
                            pop?.k === "sectionmenu" && pop.sectionId === s.id
                              ? null
                              : { k: "sectionmenu", sectionId: s.id },
                          );
                        }}
                      >
                        <IconChevronDown
                          style={{
                            transform:
                              pop?.k === "sectionmenu" && pop.sectionId === s.id
                                ? "rotate(180deg)"
                                : undefined,
                          }}
                        />
                      </button>
                      {pop?.k === "sectionmenu" && pop.sectionId === s.id ? (
                        <div
                          className="absolute left-0 top-[calc(100%+4px)] z-40 flex min-w-[180px] flex-col gap-0.5 rounded-modal border border-border-subtle bg-sidebar p-1.5 shadow-inline-popover"
                          data-popover-root
                        >
                          <button
                            type="button"
                            className="w-full rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[13px] text-fg hover:bg-hover-surface"
                            onClick={() => {
                              setPop(null);
                              onRequestRenameSection(s.id, s.name);
                            }}
                          >
                            Rename section…
                          </button>
                          <button
                            type="button"
                            className="w-full rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[13px] text-soft-danger hover:bg-hover-surface"
                            onClick={() => {
                              setPop(null);
                              void onDeleteSection(s.id);
                            }}
                          >
                            Delete section…
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </span>
                </td>
              </tr>
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
                    onToggleComplete={onToggleComplete}
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
                        colSpan={multiSelectMode ? 9 : 8}
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
                            className="rounded-pill border border-transparent px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-hover-surface hover:text-fg data-[open=true]:border-border data-[open=true]:bg-hover-surface data-[open=true]:text-fg"
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
                  className="border-b-0 pb-2 pt-[22px] text-[13px] font-bold"
                  colSpan={8}
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
                    onToggleComplete={onToggleComplete}
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
                        colSpan={multiSelectMode ? 9 : 8}
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
                            className="rounded-pill border border-transparent px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-hover-surface hover:text-fg data-[open=true]:border-border data-[open=true]:bg-hover-surface data-[open=true]:text-fg"
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

  return (
    <div className="px-7 pb-12">
      <table
        className={clsx(
          "w-full border-separate border-spacing-0",
          multiSelectMode && "[&_.subtask-composer]:pl-[94px]!",
        )}
      >
        <thead>
          <tr>
            {multiSelectMode ? (
              <th
                className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted"
                style={{ width: 36 }}
                aria-label="Select for bulk"
              />
            ) : null}
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted"
              style={{ width: 44 }}
              title="Done"
            >
              ✓
            </th>
            <th className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted">
              Task
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted"
              style={{ width: "11%" }}
            >
              Status
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted"
              style={{ width: "10%" }}
              title="Add subtasks"
            >
              Subtasks
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted"
              style={{ width: "14%" }}
            >
              Assignee
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted"
              style={{ width: "11%" }}
            >
              Start
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted"
              style={{ width: "11%" }}
            >
              Due
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted"
              style={{ width: "10%" }}
            >
              Priority
            </th>
            <th
              className="sticky top-0 z-1 border-b border-border bg-app px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted"
              style={{ width: 44 }}
              aria-label="Actions"
            />
          </tr>
        </thead>
        <tbody>{sectionBody}</tbody>
      </table>
    </div>
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
      <td style={{ verticalAlign: "middle" }}>
        <StatusTag sid={t.statusId} statuses={statuses} />
      </td>
      {subtaskQuickAdd ? (
        <td
          style={{ verticalAlign: "middle" }}
          data-popover-root
          onClick={stopProp}
          onKeyDown={stopProp}
        >
          <button
            type="button"
            className={clsx(
              "subtask-quick-btn inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-[12px] text-muted transition-colors duration-120 hover:bg-hover-surface hover:text-fg [&.is-set]:border-border-subtle [&.is-set]:text-fg",
              subtaskQuickAdd.count > 0 && "is-set",
            )}
            title={
              subtaskQuickAdd.count > 0 ? "Add another subtask" : "Add subtask"
            }
            onClick={() => subtaskQuickAdd.onAdd()}
          >
            <IconPlus width={14} height={14} />
            <span>
              {subtaskQuickAdd.count > 0
                ? `${subtaskQuickAdd.count} subtasks`
                : "Add subtask"}
            </span>
          </button>
        </td>
      ) : (
        <td
          className="select-none text-center text-[13px] text-muted"
          style={{ verticalAlign: "middle" }}
          title="Nested subtasks are not supported. Add subtasks from the parent task in the list."
        >
          <span className="opacity-45" aria-hidden>
            —
          </span>
        </td>
      )}
      <td
        style={{ verticalAlign: "middle", position: "relative" }}
        data-popover-root
        onClick={stopProp}
        onKeyDown={stopProp}
      >
        <button
          type="button"
          className={clsx(
            "inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-[12px] text-muted transition-colors duration-120 hover:bg-hover-surface hover:text-fg [&.is-set]:border-border-subtle [&.is-set]:text-fg",
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
          <IconUser width={14} height={14} />
          <span>{assigneeLabel}</span>
        </button>
        {pop?.k === "assign" && pop.taskId === t.id ? (
          <div
            className="absolute left-0 top-[calc(100%+4px)] z-40 flex min-w-[180px] flex-col gap-0.5 rounded-modal border border-border-subtle bg-sidebar p-1.5 shadow-inline-popover"
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
        style={{ verticalAlign: "middle", position: "relative" }}
        data-popover-root
        onClick={stopProp}
        onKeyDown={stopProp}
      >
        <button
          type="button"
          className={clsx(
            "start-cell-btn inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-[12px] text-muted transition-colors duration-120 hover:bg-hover-surface hover:text-fg [&.is-set]:border-border-subtle [&.is-set]:text-fg",
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
          <IconCalendar width={14} height={14} />
          <span>{fmtDate(start)}</span>
        </button>
        {pop?.k === "start" && pop.taskId === t.id ? (
          <div
            className="absolute left-0 top-[calc(100%+4px)] z-40 flex min-w-[220px] flex-col gap-0.5 rounded-modal border border-border-subtle bg-sidebar p-1.5 shadow-inline-popover"
            data-popover-root
          >
            <div className="px-0.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted">
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
        style={{ verticalAlign: "middle", position: "relative" }}
        data-popover-root
        onClick={stopProp}
        onKeyDown={stopProp}
      >
        <button
          type="button"
          className={clsx(
            "due-cell-btn inline-flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 text-[12px] text-muted transition-colors duration-120 hover:bg-hover-surface hover:text-fg [&.is-set]:border-border-subtle [&.is-set]:text-fg",
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
          <IconCalendar width={14} height={14} />
          <span
            className={clsx(
              dueState !== "none" && "font-medium normal-case",
              dueState === "overdue" && "text-soft-danger",
              dueState === "soon" && "text-prio-med-fg",
            )}
          >
            {fmtDate(due)}
          </span>
        </button>
        {pop?.k === "due" && pop.taskId === t.id ? (
          <div
            className="absolute left-0 top-[calc(100%+4px)] z-40 flex min-w-[220px] flex-col gap-0.5 rounded-modal border border-border-subtle bg-sidebar p-1.5 shadow-inline-popover"
            data-popover-root
          >
            <div className="px-0.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted">
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
        style={{ verticalAlign: "middle", position: "relative" }}
        data-popover-root
        onClick={stopProp}
        onKeyDown={stopProp}
      >
        <button
          type="button"
          className="cursor-pointer rounded-pill border border-border-subtle bg-app px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-fg data-[p=low]:border-transparent data-[p=low]:bg-prio-low-bg data-[p=low]:text-prio-low-fg data-[p=medium]:border-transparent data-[p=medium]:bg-prio-med-bg data-[p=medium]:text-prio-med-fg data-[p=high]:border-transparent data-[p=high]:bg-prio-high-bg data-[p=high]:text-prio-high-fg data-[p=urgent]:border-transparent data-[p=urgent]:bg-prio-urgent-bg data-[p=urgent]:text-prio-urgent-fg"
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
        {pop?.k === "prio" && pop.taskId === t.id ? (
          <div
            className="absolute left-0 top-[calc(100%+4px)] z-40 flex min-w-[180px] flex-col gap-0.5 rounded-modal border border-border-subtle bg-sidebar p-1.5 shadow-inline-popover"
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
        style={{ verticalAlign: "middle", position: "relative" }}
        data-popover-root
      >
        <button
          type="button"
          className="grid size-8 place-items-center rounded-card font-black tracking-wide text-muted transition-colors hover:bg-hover-surface hover:text-fg"
          aria-label="Task actions"
          onClick={(e) => {
            e.stopPropagation();
            setPop(
              pop?.k === "taskmenu" && pop.taskId === t.id
                ? null
                : { k: "taskmenu", taskId: t.id },
            );
          }}
        >
          ···
        </button>
        {pop?.k === "taskmenu" && pop.taskId === t.id ? (
          <div
            className="absolute left-0 top-[calc(100%+4px)] z-40 flex min-w-[180px] flex-col gap-0.5 rounded-modal border border-border-subtle bg-sidebar p-1.5 shadow-inline-popover"
            data-popover-root
          >
            <button
              type="button"
              className="w-full rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[13px] text-fg hover:bg-hover-surface"
              onClick={() => {
                setPop(null);
                onTaskClick(t);
              }}
            >
              Open details
            </button>
            {subtaskQuickAdd ? (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[13px] text-fg hover:bg-hover-surface"
                onClick={() => {
                  setPop(null);
                  onOpenSubtask();
                }}
              >
                <IconPlus width={14} height={14} />
                Add subtask
              </button>
            ) : null}
            <button
              type="button"
              className="w-full rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-[13px] text-soft-danger hover:bg-hover-surface"
              onClick={() => {
                setPop(null);
                void onDeleteTask(t.id);
              }}
            >
              Delete task…
            </button>
          </div>
        ) : null}
      </td>
    </>
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
  onToggleComplete,
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
  onToggleComplete: (t: TaskDoc) => void;
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
      <tr className="group/task [&>td]:border-b [&>td]:border-border-subtle [&>td]:px-3 [&>td]:py-1.5 hover:[&>td]:bg-row-hover">
        {multiSelectMode ? (
          <td style={{ verticalAlign: "middle" }}>
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
        <td style={{ verticalAlign: "middle" }}>
          <button
            type="button"
            className="mx-auto block size-4 shrink-0 rounded border-[1.5px] border-placeholder shadow-[inset_0_0_0_2px_var(--color-app)] data-[done=true]:border-tick-done data-[done=true]:bg-tick-done"
            data-done={t.completed ? "true" : "false"}
            title={t.completed ? "Mark incomplete" : "Mark complete"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(t);
            }}
          />
        </td>
        <td
          onClick={() => onTaskClick(t)}
          onKeyDown={handleTaskKeyDown}
          style={{ cursor: "pointer" }}
        >
          <span style={{ fontWeight: 600 }}>{t.title}</span>
        </td>
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
      {orderedSubtasks.map((st, si) => {
        const isLastSubInTree =
          si === orderedSubtasks.length - 1 && !subtaskComposerOpen;
        const handleSubKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            onTaskClick(st);
          }
        };
        return (
          <tr
            key={st.id}
            className="group/task [&>td]:border-b [&>td]:border-border-subtle [&>td]:px-3 [&>td]:py-1.5 hover:[&>td]:bg-row-hover"
          >
            {multiSelectMode ? (
             <td style={{ verticalAlign: "middle" }}>
                <input
                  type="checkbox"
                  className="size-4 shrink-0 cursor-pointer rounded border-[1.5px] border-placeholder bg-app accent-share"
                  checked={selectedIds.has(st.id)}
                  onChange={() => onToggleSelect(st.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
            ) : null}
            <td style={{ verticalAlign: "middle" }}>
              <button
                type="button"
                className="mx-auto block size-4 shrink-0 rounded border-[1.5px] border-placeholder shadow-[inset_0_0_0_2px_var(--color-app)] data-[done=true]:border-tick-done data-[done=true]:bg-tick-done"
                data-done={st.completed ? "true" : "false"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleComplete(st);
                }}
              />
            </td>
            <td
              onClick={() => onTaskClick(st)}
              onKeyDown={handleSubKeyDown}
              style={{ cursor: "pointer" }}
            >
              <div className="flex min-h-7 items-center gap-1.5">
                <span
                  className={clsx(
                    "relative h-7 min-h-7 w-[22px] shrink-0 self-stretch before:pointer-events-none after:pointer-events-none before:absolute before:left-2.5 before:top-0 before:border-l-2 before:border-[rgba(111,113,119,0.55)] after:absolute after:left-2.5 after:top-1/2 after:h-0 after:w-3 after:-translate-y-px after:border-t-2 after:border-[rgba(111,113,119,0.55)]",
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
        );
      })}
    </>
  );
}
