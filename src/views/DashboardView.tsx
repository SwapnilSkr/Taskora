import '../components/layout/layout.css'
import type { TaskDoc } from '../types/models'

export function DashboardView({ tasks }: { tasks: TaskDoc[] }) {
  const roots = tasks.filter((t) => !t.parentTaskId)
  const statusCounts: Record<TaskDoc['status'], number> = {
    not_started: 0,
    in_progress: 0,
    completed: 0,
    blocked: 0,
  }
  for (const t of roots) statusCounts[t.status]++

  const totalTracked = roots.reduce((n, t) => n + (t.trackedMinutes ?? 0), 0)
  const totalEst = roots.reduce((n, t) => n + (t.estimatedMinutes ?? 0), 0)

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <h3>Status mix</h3>
        {(
          Object.entries(statusCounts) as [TaskDoc['status'], number][]
        ).map(([k, v]) => (
          <div key={k} className="bar-row">
            <span style={{ width: 110, textTransform: 'capitalize' }}>
              {k.replace('_', ' ')}
            </span>
            <div className="bar">
              <i
                style={{
                  width: `${(v / Math.max(roots.length, 1)) * 100}%`,
                }}
              />
            </div>
            <span style={{ width: 28, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
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
