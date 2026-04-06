import {
  addDays,
  differenceInCalendarDays,
  format,
  max as maxDate,
  min as minDate,
} from 'date-fns'
import '../components/layout/layout.css'
import type { TaskDoc } from '../types/models'
import { tsToDate } from '../utils/format'

type Row = {
  task: TaskDoc
  start: Date
  end: Date
  inferred: boolean
}

function buildRows(tasks: TaskDoc[]): Row[] {
  const roots = tasks.filter((t) => !t.parentTaskId)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return roots.map((t) => {
    let start = tsToDate(t.startDate)
    let end = tsToDate(t.dueDate)
    let inferred = false
    if (start && end && end.getTime() < start.getTime()) {
      const x = start
      start = end
      end = x
    }
    if (!start && end) {
      start = addDays(end, -3)
      inferred = true
    } else if (start && !end) {
      end = addDays(start, 3)
      inferred = true
    } else if (!start && !end) {
      const created = tsToDate(t.createdAt) ?? today
      start = created
      end = addDays(created, 5)
      inferred = true
    }
    return { task: t, start: start!, end: end!, inferred }
  })
}

export function GanttView({
  tasks,
  onTaskClick,
}: {
  tasks: TaskDoc[]
  onTaskClick: (t: TaskDoc) => void
}) {
  const rows = buildRows(tasks)
  if (rows.length === 0) {
    return (
      <div style={{ padding: '24px 28px', color: 'var(--text-muted)' }}>
        No tasks in this project yet. Add tasks from the List tab.
      </div>
    )
  }

  const minD = minDate(rows.map((r) => r.start))
  const maxD = maxDate(rows.map((r) => r.end))
  const totalDays = Math.max(21, differenceInCalendarDays(maxD, minD) + 8)
  const days = Array.from({ length: totalDays }, (_, i) => addDays(minD, i))
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const todayOffset = Math.max(
    0,
    Math.min(totalDays - 1, differenceInCalendarDays(today, minD)),
  )
  const pctPerDay = 100 / totalDays

  return (
    <div className="timeline" style={{ paddingBottom: 40 }}>
      <div style={{ padding: '0 28px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
        Drag-friendly schedule: every task gets a bar from start/due dates, or from created date if unset.
        Click a bar or title to edit. Orange line is today.
      </div>
      <div className="gantt-scroll">
        <div className="gantt-grid">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `minmax(180px,220px) repeat(${days.length}, minmax(22px, 1fr))`,
              borderBottom: '1px solid var(--border-subtle)',
              background: '#1a1b1e',
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Task
            </div>
            {days.map((d, i) => (
              <div
                key={i}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  padding: '10px 2px',
                  borderLeft: '1px solid var(--border-subtle)',
                }}
              >
                {i % 3 === 0 || i === 0 || i === days.length - 1
                  ? format(d, 'd')
                  : ''}
              </div>
            ))}
          </div>
          {rows.map(({ task: t, start, end, inferred }) => {
            const offset = Math.max(0, differenceInCalendarDays(start, minD))
            const len = Math.max(
              1,
              differenceInCalendarDays(end, start) + 1,
            )
            return (
              <div
                key={t.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `minmax(180px,220px) repeat(${days.length}, minmax(22px, 1fr))`,
                  borderBottom: '1px solid var(--border-subtle)',
                  alignItems: 'stretch',
                  minHeight: 36,
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    borderRight: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 2,
                  }}
                >
                  <div className="gantt-row-label">
                    <button type="button" onClick={() => onTaskClick(t)}>
                      {t.title}
                    </button>
                  </div>
                  {inferred ? (
                    <span className="gantt-row-muted">Estimated window · set dates in details</span>
                  ) : null}
                </div>
                <div
                  style={{
                    gridColumn: `2 / -1`,
                    position: 'relative',
                    minHeight: 36,
                    borderLeft: '1px solid var(--border-subtle)',
                  }}
                >
                  <div
                    className="gantt-today"
                    style={{
                      left: `calc(${todayOffset * pctPerDay}% + ${pctPerDay / 2}%)`,
                    }}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    className="gantt-bar"
                    style={{
                      left: `${offset * pctPerDay}%`,
                      width: `${len * pctPerDay}%`,
                    }}
                    onClick={() => onTaskClick(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onTaskClick(t)
                      }
                    }}
                    title={`${format(start, 'MMM d')} → ${format(end, 'MMM d')}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
