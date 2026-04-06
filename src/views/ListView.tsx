import { Fragment, useEffect, useRef, useState } from 'react'
import { IconCalendar, IconChevronDown, IconPlus, IconUser } from '../components/icons'
import '../components/layout/layout.css'
import type { SectionDoc, TaskDoc } from '../types/models'
import {
  dateToInputValue,
  dueBadgeState,
  fmtDate,
  tsToDate,
} from '../utils/format'

export type GroupMode = 'section' | 'assignee' | 'due' | 'status' | 'priority'
export type SortMode = 'sortOrder' | 'dueDate' | 'priority' | 'name'

type Pop =
  | null
  | { k: 'assign'; taskId: string }
  | { k: 'due'; taskId: string }
  | { k: 'prio'; taskId: string }
  | { k: 'taskmenu'; taskId: string }
  | { k: 'sectionmenu'; sectionId: string }

type Props = {
  sections: SectionDoc[]
  tasks: TaskDoc[]
  group: GroupMode
  sort: SortMode
  uid: string
  multiSelectMode: boolean
  selectedIds: Set<string>
  onToggleSelect: (taskId: string) => void
  onSetManySelected: (taskIds: string[], selected: boolean) => void
  onTaskClick: (t: TaskDoc) => void
  onToggleComplete: (t: TaskDoc) => void
  onAddTask: (sectionId: string) => void
  onAssign: (taskId: string, assigneeId: string | null) => void
  onDueChange: (taskId: string, ymd: string | null) => void
  onPriorityChange: (taskId: string, priority: TaskDoc['priority']) => void
  onAddSubtask: (parentId: string, sectionId: string, title: string) => void
  onDeleteTask: (taskId: string) => void
  onRequestRenameSection: (sectionId: string, currentName: string) => void
  onDeleteSection: (sectionId: string) => void
}

function groupKey(
  t: TaskDoc,
  mode: GroupMode,
  sections: SectionDoc[],
  uid: string,
): string {
  switch (mode) {
    case 'section':
      return sections.find((s) => s.id === t.sectionId)?.name ?? 'Section'
    case 'assignee':
      return t.assigneeId === uid
        ? 'Me'
        : t.assigneeId
          ? 'Assigned'
          : 'Unassigned'
    case 'due': {
      const d = tsToDate(t.dueDate)
      if (!d) return 'No due date'
      return `Due ${d.toISOString().slice(0, 10)}`
    }
    case 'status':
      return t.status.replace('_', ' ')
    case 'priority':
      return t.priority
    default:
      return ''
  }
}

function sortTasks(list: TaskDoc[], mode: SortMode): TaskDoc[] {
  const out = [...list]
  if (mode === 'name') {
    out.sort((a, b) => a.title.localeCompare(b.title))
  } else if (mode === 'dueDate') {
    out.sort((a, b) => {
      const da = tsToDate(a.dueDate)?.getTime() ?? Infinity
      const db = tsToDate(b.dueDate)?.getTime() ?? Infinity
      return da - db
    })
  } else if (mode === 'priority') {
    const rank: Record<TaskDoc['priority'], number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    }
    out.sort((a, b) => rank[a.priority] - rank[b.priority])
  } else {
    out.sort((a, b) => a.sortOrder - b.sortOrder)
  }
  return out
}

function GroupSelectCheckbox({
  taskIds,
  selectedIds,
  onSetManySelected,
}: {
  taskIds: string[]
  selectedIds: Set<string>
  onSetManySelected: (ids: string[], selected: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const picked = taskIds.filter((id) => selectedIds.has(id)).length
  const all = taskIds.length > 0 && picked === taskIds.length
  const some = picked > 0 && !all

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some
  }, [some])

  return (
    <input
      ref={ref}
      type="checkbox"
      className="select-checkbox"
      title="Select all in group"
      checked={all}
      onChange={() => onSetManySelected(taskIds, !all)}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

export function ListView({
  sections,
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
  onDueChange,
  onPriorityChange,
  onAddSubtask,
  onDeleteTask,
  onRequestRenameSection,
  onDeleteSection,
}: Props) {
  const [pop, setPop] = useState<Pop>(null)
  const [inlineSub, setInlineSub] = useState<{
    parentId: string
    sectionId: string
  } | null>(null)
  const subInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!pop) return
    function close(e: MouseEvent) {
      const el = e.target as HTMLElement
      if (el.closest('[data-popover-root]')) return
      setPop(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [pop])

  useEffect(() => {
    if (inlineSub) subInputRef.current?.focus()
  }, [inlineSub])

  const roots = tasks.filter((x) => !x.parentTaskId)

  const sectionBody =
    group === 'section'
      ? sections.map((s) => {
          const rowTasks = sortTasks(
            roots.filter((t) => t.sectionId === s.id),
            sort,
          )
          const ids = rowTasks.map((t) => t.id)
          return (
            <Fragment key={s.id}>
              <tr className="section-label-row">
                {multiSelectMode ? (
                  <td style={{ width: 36, verticalAlign: 'middle' }}>
                    {ids.length > 0 ? (
                      <GroupSelectCheckbox
                        taskIds={ids}
                        selectedIds={selectedIds}
                        onSetManySelected={onSetManySelected}
                      />
                    ) : null}
                  </td>
                ) : null}
                <td colSpan={multiSelectMode ? 6 : 6}>
                  <span className="section-title-wrap">
                    <span className="section-title-text">{s.name}</span>
                    <button
                      type="button"
                      className="chip-btn section-add-inline"
                      onClick={() => onAddTask(s.id)}
                    >
                      + Add task
                    </button>
                    <div className="section-actions" data-popover-root>
                      <button
                        type="button"
                        className="icon-btn section-menu-btn"
                        aria-label="Section options"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPop(
                            pop?.k === 'sectionmenu' && pop.sectionId === s.id
                              ? null
                              : { k: 'sectionmenu', sectionId: s.id },
                          )
                        }}
                      >
                        <IconChevronDown
                          style={{
                            transform:
                              pop?.k === 'sectionmenu' && pop.sectionId === s.id
                                ? 'rotate(180deg)'
                                : undefined,
                          }}
                        />
                      </button>
                      {pop?.k === 'sectionmenu' && pop.sectionId === s.id ? (
                        <div className="inline-popover" data-popover-root>
                          <button
                            type="button"
                            onClick={() => {
                              setPop(null)
                              onRequestRenameSection(s.id, s.name)
                            }}
                          >
                            Rename section…
                          </button>
                          <button
                            type="button"
                            className="danger-option"
                            onClick={() => {
                              setPop(null)
                              void onDeleteSection(s.id)
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
                    onDueChange={onDueChange}
                    onPriorityChange={onPriorityChange}
                    onDeleteTask={onDeleteTask}
                    onOpenSubtask={() =>
                      setInlineSub({ parentId: t.id, sectionId: t.sectionId })
                    }
                  />
                  {inlineSub?.parentId === t.id ? (
                    <tr className="subtask-composer-row">
                      <td colSpan={multiSelectMode ? 7 : 6}>
                        <div className="subtask-composer">
                          <span className="subtask-composer-branch" aria-hidden />
                          <input
                            ref={subInputRef}
                            className="input subtask-composer-input"
                            placeholder="Subtask name — Enter to save, Esc to cancel"
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setInlineSub(null)
                                return
                              }
                              if (e.key !== 'Enter') return
                              const v = (e.target as HTMLInputElement).value.trim()
                              if (!v) return
                              onAddSubtask(inlineSub.parentId, inlineSub.sectionId, v)
                              setInlineSub(null)
                            }}
                          />
                          <button
                            type="button"
                            className="chip-btn"
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
          )
        })
      : Array.from(
          (() => {
            const gmap = new Map<string, TaskDoc[]>()
            for (const t of roots) {
              const k = groupKey(t, group, sections, uid)
              const arr = gmap.get(k) ?? []
              arr.push(t)
              gmap.set(k, arr)
            }
            return gmap
          })().entries(),
        ).map(([key, rowTasks]) => {
          const sorted = sortTasks(rowTasks, sort)
          const ids = sorted.map((t) => t.id)
          return (
            <Fragment key={key}>
              <tr className="section-label-row">
                {multiSelectMode ? (
                  <td style={{ width: 36, verticalAlign: 'middle' }}>
                    {ids.length > 0 ? (
                      <GroupSelectCheckbox
                        taskIds={ids}
                        selectedIds={selectedIds}
                        onSetManySelected={onSetManySelected}
                      />
                    ) : null}
                  </td>
                ) : null}
                <td colSpan={6}>
                  <span className="section-title-text">{key}</span>
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
                    onDueChange={onDueChange}
                    onPriorityChange={onPriorityChange}
                    onDeleteTask={onDeleteTask}
                    onOpenSubtask={() =>
                      setInlineSub({ parentId: t.id, sectionId: t.sectionId })
                    }
                  />
                  {inlineSub?.parentId === t.id ? (
                    <tr className="subtask-composer-row">
                      <td colSpan={multiSelectMode ? 7 : 6}>
                        <div className="subtask-composer">
                          <span className="subtask-composer-branch" aria-hidden />
                          <input
                            ref={subInputRef}
                            className="input subtask-composer-input"
                            placeholder="Subtask name — Enter to save"
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setInlineSub(null)
                                return
                              }
                              if (e.key !== 'Enter') return
                              const v = (e.target as HTMLInputElement).value.trim()
                              if (!v || !inlineSub) return
                              onAddSubtask(
                                inlineSub.parentId,
                                inlineSub.sectionId,
                                v,
                              )
                              setInlineSub(null)
                            }}
                          />
                          <button
                            type="button"
                            className="chip-btn"
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
          )
        })

  return (
    <div className="table-wrap">
      <table className="task-table">
        <thead>
          <tr>
            {multiSelectMode ? (
              <th style={{ width: 36 }} aria-label="Select for bulk" />
            ) : null}
            <th style={{ width: 44 }} title="Done">
              ✓
            </th>
            <th>Task</th>
            <th style={{ width: '16%' }}>Assignee</th>
            <th style={{ width: '16%' }}>Due</th>
            <th style={{ width: '14%' }}>Priority</th>
            <th style={{ width: 44 }} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>{sectionBody}</tbody>
      </table>
    </div>
  )
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
  onDueChange,
  onPriorityChange,
  onDeleteTask,
  onOpenSubtask,
}: {
  task: TaskDoc
  subtasks: TaskDoc[]
  uid: string
  multiSelectMode: boolean
  selectedIds: Set<string>
  pop: Pop
  setPop: (p: Pop) => void
  onToggleSelect: (taskId: string) => void
  onTaskClick: (t: TaskDoc) => void
  onToggleComplete: (t: TaskDoc) => void
  onAssign: (taskId: string, assigneeId: string | null) => void
  onDueChange: (taskId: string, ymd: string | null) => void
  onPriorityChange: (taskId: string, priority: TaskDoc['priority']) => void
  onDeleteTask: (taskId: string) => void
  onOpenSubtask: () => void
}) {
  const due = tsToDate(t.dueDate)
  const dueState = dueBadgeState(due, t.completed)
  const assigneeLabel =
    t.assigneeId === uid ? 'You' : t.assigneeId ? 'Member' : 'Assign'

  const prios: TaskDoc['priority'][] = ['low', 'medium', 'high', 'urgent']
  const subFillColSpan = 3

  return (
    <>
      <tr className="task-row">
        {multiSelectMode ? (
          <td style={{ verticalAlign: 'middle' }}>
            <input
              type="checkbox"
              className="select-checkbox"
              title="Select for bulk actions"
              checked={selectedIds.has(t.id)}
              onChange={() => onToggleSelect(t.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </td>
        ) : null}
        <td style={{ verticalAlign: 'middle' }}>
          <button
            type="button"
            className="checkbox todo-complete-btn"
            data-done={t.completed ? 'true' : 'false'}
            title={t.completed ? 'Mark incomplete' : 'Mark complete'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleComplete(t)
            }}
          />
        </td>
        <td onClick={() => onTaskClick(t)} style={{ cursor: 'pointer' }}>
          <span style={{ fontWeight: 600 }}>{t.title}</span>
          {subtasks.length > 0 ? (
            <span className="subtask-count-pill">{subtasks.length} subtasks</span>
          ) : null}
        </td>
        <td
          style={{ verticalAlign: 'middle', position: 'relative' }}
          data-popover-root
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`cell-quick-btn ${t.assigneeId ? 'is-set' : ''}`}
            onClick={() =>
              setPop(
                pop?.k === 'assign' && pop.taskId === t.id
                  ? null
                  : { k: 'assign', taskId: t.id },
              )
            }
          >
            <IconUser width={14} height={14} />
            <span>{assigneeLabel}</span>
          </button>
          {pop?.k === 'assign' && pop.taskId === t.id ? (
            <div className="inline-popover" data-popover-root>
              <button
                type="button"
                onClick={() => {
                  onAssign(t.id, uid)
                  setPop(null)
                }}
              >
                Assign to me
              </button>
              <button
                type="button"
                onClick={() => {
                  onAssign(t.id, null)
                  setPop(null)
                }}
              >
                Unassigned
              </button>
            </div>
          ) : null}
        </td>
        <td
          style={{ verticalAlign: 'middle', position: 'relative' }}
          data-popover-root
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`cell-quick-btn due-cell-btn ${due ? 'is-set' : ''}`}
            onClick={() =>
              setPop(
                pop?.k === 'due' && pop.taskId === t.id
                  ? null
                  : { k: 'due', taskId: t.id },
              )
            }
          >
            <IconCalendar width={14} height={14} />
            <span className={dueState !== 'none' ? `due-soft due-soft-${dueState}` : ''}>
              {fmtDate(due)}
            </span>
          </button>
          {pop?.k === 'due' && pop.taskId === t.id ? (
            <div className="inline-popover inline-popover-wide" data-popover-root>
              <div className="mini-label">Due date</div>
              <input
                type="date"
                className="input"
                defaultValue={dateToInputValue(due)}
                onChange={(e) => onDueChange(t.id, e.target.value || null)}
              />
              <button
                type="button"
                className="linkish-btn"
                onClick={() => {
                  onDueChange(t.id, null)
                  setPop(null)
                }}
              >
                Clear due date
              </button>
            </div>
          ) : null}
        </td>
        <td
          style={{ verticalAlign: 'middle', position: 'relative' }}
          data-popover-root
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="prio-quick"
            data-p={t.priority}
            onClick={() =>
              setPop(
                pop?.k === 'prio' && pop.taskId === t.id
                  ? null
                  : { k: 'prio', taskId: t.id },
              )
            }
          >
            {t.priority}
          </button>
          {pop?.k === 'prio' && pop.taskId === t.id ? (
            <div className="inline-popover" data-popover-root>
              {prios.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    onPriorityChange(t.id, p)
                    setPop(null)
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : null}
        </td>
        <td style={{ verticalAlign: 'middle', position: 'relative' }} data-popover-root>
          <button
            type="button"
            className="icon-btn row-more-btn"
            aria-label="Task actions"
            onClick={(e) => {
              e.stopPropagation()
              setPop(
                pop?.k === 'taskmenu' && pop.taskId === t.id
                  ? null
                  : { k: 'taskmenu', taskId: t.id },
              )
            }}
          >
            ···
          </button>
          {pop?.k === 'taskmenu' && pop.taskId === t.id ? (
            <div className="inline-popover" data-popover-root>
              <button
                type="button"
                onClick={() => {
                  setPop(null)
                  onTaskClick(t)
                }}
              >
                Open details
              </button>
              <button
                type="button"
                className="task-menu-with-icon"
                onClick={() => {
                  setPop(null)
                  onOpenSubtask()
                }}
              >
                <IconPlus width={14} height={14} />
                Add subtask
              </button>
              <button
                type="button"
                className="danger-option"
                onClick={() => {
                  setPop(null)
                  void onDeleteTask(t.id)
                }}
              >
                Delete task…
              </button>
            </div>
          ) : null}
        </td>
      </tr>
      {subtasks.map((st) => (
        <tr key={st.id} className="task-row task-row-sub">
          {multiSelectMode ? (
            <td style={{ verticalAlign: 'middle' }}>
              <input
                type="checkbox"
                className="select-checkbox"
                checked={selectedIds.has(st.id)}
                onChange={() => onToggleSelect(st.id)}
                onClick={(e) => e.stopPropagation()}
              />
            </td>
          ) : null}
          <td style={{ verticalAlign: 'middle' }}>
            <button
              type="button"
              className="checkbox todo-complete-btn"
              data-done={st.completed ? 'true' : 'false'}
              onClick={(e) => {
                e.stopPropagation()
                onToggleComplete(st)
              }}
            />
          </td>
          <td
            className="subtask-indent"
            onClick={() => onTaskClick(st)}
            style={{ cursor: 'pointer' }}
          >
            <span>{st.title}</span>
          </td>
          <td colSpan={subFillColSpan} style={{ background: 'transparent' }} />
          <td />
        </tr>
      ))}
    </>
  )
}
