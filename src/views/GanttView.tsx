import { addDays, differenceInCalendarDays, min as minDate } from 'date-fns'
import '../components/layout/layout.css'
import type { TaskDoc } from '../types/models'
import { tsToDate } from '../utils/format'

export function GanttView({ tasks }: { tasks: TaskDoc[] }) {
  const roots = tasks.filter((t) => !t.parentTaskId)
  const dated = roots
    .map((t) => {
      const start = tsToDate(t.startDate) ?? tsToDate(t.dueDate)
      const end = tsToDate(t.dueDate) ?? tsToDate(t.startDate) ?? start
      return { t, start, end }
    })
    .filter((x) => x.start && x.end) as {
    t: TaskDoc
    start: Date
    end: Date
  }[]

  const minD =
    dated.length > 0
      ? minDate(dated.map((x) => x.start))
      : new Date()
  const span = Math.max(
    14,
    ...dated.map((x) => Math.abs(differenceInCalendarDays(x.end, minD)) + 1),
  )
  const days = Array.from({ length: Math.min(span, 21) }, (_, i) =>
    addDays(minD, i),
  )

  return (
    <div className="timeline" style={{ paddingBottom: 40 }}>
      <div style={{ padding: '0 28px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
        Dependency-aware scheduling like Asana Timeline/Gantt: dependencies are stored per task; bars visualize start/due window.
      </div>
      <div className="timeline-rail" style={{ margin: '0 28px' }}>
        <div
          className="timeline-row header"
          style={{ gridTemplateColumns: `200px repeat(${days.length}, minmax(28px, 1fr))` }}
        >
          <div>Task</div>
          {days.map((d) => (
            <div key={d.toISOString()} style={{ textAlign: 'center' }}>
              {d.getDate()}
            </div>
          ))}
        </div>
        {dated.map(({ t, start, end }) => {
          const offset = Math.max(0, differenceInCalendarDays(start, minD))
          const len =
            Math.max(1, differenceInCalendarDays(end, start) + 1)
          return (
            <div
              key={t.id}
              className="timeline-row"
              style={{
                gridTemplateColumns: `200px repeat(${days.length}, minmax(28px, 1fr))`,
              }}
            >
              <div style={{ fontWeight: 600 }}>{t.title}</div>
              <div
                className="timeline-bar-wrap"
                style={{
                  gridColumn: `2 / -1`,
                }}
              >
                <div
                  className="timeline-bar"
                  style={{
                    left: `${(offset / days.length) * 100}%`,
                    width: `${(len / days.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
