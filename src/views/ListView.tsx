import { Fragment, useEffect, useRef } from 'react'
import { IconCalendar, IconUser } from '../components/icons'
import '../components/layout/layout.css'
import type { SectionDoc, TaskDoc } from '../types/models'
import { dueBadgeState, fmtDate, tsToDate } from '../utils/format'

export type GroupMode = 'section' | 'assignee' | 'due' | 'status' | 'priority'
export type SortMode = 'sortOrder' | 'dueDate' | 'priority' | 'name'

type Props = {
  sections: SectionDoc[]
  tasks: TaskDoc[]
  group: GroupMode
  sort: SortMode
  uid: string
  selectedIds: Set<string>
  onToggleSelect: (taskId: string) => void
  onSetManySelected: (taskIds: string[], selected: boolean) => void
  onTaskClick: (t: TaskDoc) => void
  onToggleComplete: (t: TaskDoc) => void
  onAddTask: (sectionId: string) => void
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
      title="Select group"
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
  selectedIds,
  onToggleSelect,
  onSetManySelected,
  onTaskClick,
  onToggleComplete,
  onAddTask,
}: Props) {
  const roots = tasks.filter((x) => !x.parentTaskId)

  const body =
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
                <td style={{ width: 40, verticalAlign: 'middle' }}>
                  {ids.length > 0 ? (
                    <GroupSelectCheckbox
                      taskIds={ids}
                      selectedIds={selectedIds}
                      onSetManySelected={onSetManySelected}
                    />
                  ) : null}
                </td>
                <td colSpan={4}>
                  {s.name}
                  <button
                    type="button"
                    className="chip-btn"
                    style={{ marginLeft: 10, fontSize: 11 }}
                    onClick={() => onAddTask(s.id)}
                  >
                    + Add task
                  </button>
                </td>
              </tr>
              {rowTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  subtasks={tasks.filter((x) => x.parentTaskId === t.id)}
                  uid={uid}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                  onTaskClick={onTaskClick}
                  onToggleComplete={onToggleComplete}
                />
              ))}
            </Fragment>
          )
        })
      : (() => {
          const gmap = new Map<string, TaskDoc[]>()
          for (const t of roots) {
            const k = groupKey(t, group, sections, uid)
            const arr = gmap.get(k) ?? []
            arr.push(t)
            gmap.set(k, arr)
          }
          return Array.from(gmap.entries()).map(([key, rowTasks]) => {
            const sorted = sortTasks(rowTasks, sort)
            const ids = sorted.map((t) => t.id)
            return (
              <Fragment key={key}>
                <tr className="section-label-row">
                  <td style={{ width: 40, verticalAlign: 'middle' }}>
                    {ids.length > 0 ? (
                      <GroupSelectCheckbox
                        taskIds={ids}
                        selectedIds={selectedIds}
                        onSetManySelected={onSetManySelected}
                      />
                    ) : null}
                  </td>
                  <td colSpan={4}>{key}</td>
                </tr>
                {sorted.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    subtasks={tasks.filter((x) => x.parentTaskId === t.id)}
                    uid={uid}
                    selectedIds={selectedIds}
                    onToggleSelect={onToggleSelect}
                    onTaskClick={onTaskClick}
                    onToggleComplete={onToggleComplete}
                  />
                ))}
              </Fragment>
            )
          })
        })()

  return (
    <div className="table-wrap">
      <table className="task-table">
        <thead>
          <tr>
            <th style={{ width: 40 }} aria-label="Select" />
            <th style={{ width: '42%' }}>Name</th>
            <th style={{ width: '18%' }}>Assignee</th>
            <th style={{ width: '18%' }}>Due date</th>
            <th style={{ width: '18%' }}>Priority</th>
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  )
}

function TaskRow({
  task: t,
  subtasks,
  uid,
  selectedIds,
  onToggleSelect,
  onTaskClick,
  onToggleComplete,
}: {
  task: TaskDoc
  subtasks: TaskDoc[]
  uid: string
  selectedIds: Set<string>
  onToggleSelect: (taskId: string) => void
  onTaskClick: (t: TaskDoc) => void
  onToggleComplete: (t: TaskDoc) => void
}) {
  const due = tsToDate(t.dueDate)
  const dueState = dueBadgeState(due, t.completed)
  const assigneeLabel =
    t.assigneeId === uid ? 'You' : t.assigneeId ? 'Member' : '—'

  return (
    <>
      <tr className="task-row">
        <td
          onClick={(e) => e.stopPropagation()}
          style={{ verticalAlign: 'middle' }}
        >
          <input
            type="checkbox"
            className="select-checkbox"
            title="Select task"
            checked={selectedIds.has(t.id)}
            onChange={() => onToggleSelect(t.id)}
            onClick={(e) => e.stopPropagation()}
          />
        </td>
        <td onClick={() => onTaskClick(t)} style={{ cursor: 'pointer' }}>
          <div className="task-title-cell">
            <button
              type="button"
              className="checkbox"
              data-done={t.completed ? 'true' : 'false'}
              title="Mark complete"
              onClick={(e) => {
                e.stopPropagation()
                onToggleComplete(t)
              }}
            />
            <span style={{ fontWeight: 600 }}>{t.title}</span>
          </div>
        </td>
        <td onClick={() => onTaskClick(t)} style={{ cursor: 'pointer' }}>
          <span className="due-pill">
            <IconUser width={14} height={14} />
            {assigneeLabel}
          </span>
        </td>
        <td onClick={() => onTaskClick(t)} style={{ cursor: 'pointer' }}>
          <span className="due-pill" data-state={dueState}>
            <IconCalendar width={14} height={14} />
            {fmtDate(due)}
          </span>
        </td>
        <td onClick={() => onTaskClick(t)} style={{ cursor: 'pointer' }}>
          <span className="pill-prio" data-p={t.priority}>
            {t.priority}
          </span>
        </td>
      </tr>
      {subtasks.map((st) => (
        <tr key={st.id} className="task-row">
          <td
            onClick={(e) => e.stopPropagation()}
            style={{ verticalAlign: 'middle' }}
          >
            <input
              type="checkbox"
              className="select-checkbox"
              title="Select subtask"
              checked={selectedIds.has(st.id)}
              onChange={() => onToggleSelect(st.id)}
              onClick={(e) => e.stopPropagation()}
            />
          </td>
          <td
            className="subtask-indent"
            onClick={() => onTaskClick(st)}
            style={{ cursor: 'pointer' }}
          >
            <div className="task-title-cell">
              <button
                type="button"
                className="checkbox"
                data-done={st.completed ? 'true' : 'false'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleComplete(st)
                }}
              />
              <span>{st.title}</span>
            </div>
          </td>
          <td />
          <td />
          <td />
        </tr>
      ))}
    </>
  )
}
