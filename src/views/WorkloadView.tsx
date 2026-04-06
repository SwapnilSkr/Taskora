import '../components/layout/layout.css'
import type { TaskDoc } from '../types/models'

export function WorkloadView({
  tasks,
  uid,
}: {
  tasks: TaskDoc[]
  uid: string
}) {
  const roots = tasks.filter((t) => !t.parentTaskId && !t.completed)
  const buckets = new Map<string, TaskDoc[]>()
  for (const t of roots) {
    const k =
      t.assigneeId === uid ? 'You' : t.assigneeId ? 'Other assignees' : 'Unassigned'
    const arr = buckets.get(k) ?? []
    arr.push(t)
    buckets.set(k, arr)
  }

  return (
    <div className="stats-grid">
      <div className="stat-card" style={{ gridColumn: '1 / -1' }}>
        <h3>Workload by assignee</h3>
        <div style={{ color: 'var(--text-muted)', marginBottom: 12, fontSize: 13 }}>
          Mirrors Asana Workload: open task counts per bucket. Pair with estimates on each task for staffing views.
        </div>
        {Array.from(buckets.entries()).map(([k, arr]) => (
          <div key={k} className="bar-row" style={{ marginTop: 8 }}>
            <span style={{ width: 160, fontWeight: 600 }}>{k}</span>
            <div className="bar">
              <i style={{ width: `${Math.min(100, arr.length * 10)}%` }} />
            </div>
            <span style={{ width: 40, textAlign: 'right' }}>{arr.length}</span>
          </div>
        ))}
        {buckets.size === 0 ? (
          <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>No open tasks.</div>
        ) : null}
      </div>
    </div>
  )
}
