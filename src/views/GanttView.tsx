import {
  addDays,
  differenceInCalendarDays,
  format,
  max as maxDate,
  min as minDate,
} from 'date-fns'
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
      <div className="px-7 py-6 text-muted">
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
    <div className="pb-10">
      <div className="px-7 pb-3 text-[13px] text-muted">
        Drag-friendly schedule: every task gets a bar from start/due dates, or from created date if unset.
        Click a bar or title to edit. Orange line is today.
      </div>
      <div className="mx-7 overflow-x-auto rounded-modal border border-border-subtle bg-gantt-grid-bg">
        <div className="min-w-[720px]">
          <div
            className="grid border-b border-border-subtle bg-[#1a1b1e]"
            style={{
              gridTemplateColumns: `minmax(180px,220px) repeat(${days.length}, minmax(22px, 1fr))`,
            }}
          >
            <div className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              Task
            </div>
            {days.map((d, i) => (
              <div
                key={i}
                className="border-l border-border-subtle px-0.5 py-2.5 text-center text-[10px] font-bold text-muted"
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
                className="grid min-h-9 items-stretch border-b border-border-subtle"
                style={{
                  gridTemplateColumns: `minmax(180px,220px) repeat(${days.length}, minmax(22px, 1fr))`,
                }}
              >
                <div className="flex flex-col justify-center gap-0.5 border-r border-border-subtle px-3 py-2">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-semibold">
                    <button
                      type="button"
                      className="block w-full cursor-pointer border-none bg-transparent p-0 text-left font-inherit text-inherit hover:text-share"
                      onClick={() => onTaskClick(t)}
                    >
                      {t.title}
                    </button>
                  </div>
                  {inferred ? (
                    <span className="text-[11px] font-medium text-muted">
                      Estimated window · set dates in details
                    </span>
                  ) : null}
                </div>
                <div
                  className="relative min-h-9 border-l border-border-subtle"
                  style={{
                    gridColumn: `2 / -1`,
                  }}
                >
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 z-2 w-0.5 bg-[rgba(224,109,94,0.85)]"
                    style={{
                      left: `calc(${todayOffset * pctPerDay}% + ${pctPerDay / 2}%)`,
                    }}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    className="absolute top-[5px] h-[22px] min-w-2 cursor-pointer rounded-md bg-linear-to-r from-share to-project opacity-90 transition-[opacity,filter] hover:opacity-100 hover:brightness-110"
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
