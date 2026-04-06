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
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5 px-7 pb-10">
      <div className="col-span-full rounded-[10px] border border-border-subtle bg-board p-4">
        <h3 className="mb-2 mt-0 text-xs font-bold uppercase tracking-wider text-muted">
          Workload by assignee
        </h3>
        <div className="mb-3 text-[13px] text-muted">
          Mirrors Asana Workload: open task counts per bucket. Pair with estimates on each task for staffing views.
        </div>
        {Array.from(buckets.entries()).map(([k, arr]) => (
          <div key={k} className="mt-2 flex items-center gap-2 text-xs text-muted">
            <span className="w-40 font-semibold text-fg">{k}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-pill bg-bar-track">
              <i
                className="block h-full rounded-[inherit] bg-share"
                style={{ width: `${Math.min(100, arr.length * 10)}%` }}
              />
            </div>
            <span className="w-10 text-right text-fg">{arr.length}</span>
          </div>
        ))}
        {buckets.size === 0 ? (
          <div className="mt-2 text-muted">No open tasks.</div>
        ) : null}
      </div>
    </div>
  )
}
