import type { StatusDoc, TaskDoc } from '../types/models'

export function DashboardView({
  tasks,
  statuses,
}: {
  tasks: TaskDoc[]
  statuses: StatusDoc[]
}) {
  const roots = tasks.filter((t) => !t.parentTaskId)
  const statusCounts: Record<string, number> = {}
  for (const s of statuses) statusCounts[s.id] = 0
  for (const t of roots) {
    if (t.statusId) {
      statusCounts[t.statusId] = (statusCounts[t.statusId] || 0) + 1
    }
  }

  const totalTracked = roots.reduce((n, t) => n + (t.trackedMinutes ?? 0), 0)
  const totalEst = roots.reduce((n, t) => n + (t.estimatedMinutes ?? 0), 0)

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <h3>Status mix</h3>
        {statuses.map((s) => {
          const v = statusCounts[s.id] || 0
          return (
            <div key={s.id} className="bar-row">
              <span
                style={{
                  width: 110,
                  textTransform: 'capitalize',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                }}
              >
                {s.name}
              </span>
              <div className="bar">
                <i
                  style={{
                    width: `${(v / Math.max(roots.length, 1)) * 100}%`,
                    backgroundColor: s.color,
                  }}
                />
              </div>
              <span style={{ width: 28, textAlign: 'right', fontSize: 13 }}>
                {v}
              </span>
            </div>
          )
        })}
      </div>
      <div className="stat-card">
        <h3>Time tracking</h3>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Estimated {totalEst} min · Logged {totalTracked} min
        </div>
        <div className="bar" style={{ marginTop: 12 }}>
          <i
            style={{
              width: `${totalEst ? Math.min(100, (totalTracked / totalEst) * 100) : 0}%`,
              background: '#c8a96d',
            }}
          />
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          Modeled after Asana Advanced time tracking fields (estimate + actuals on each task).
        </div>
      </div>
    </div>
  )
}
