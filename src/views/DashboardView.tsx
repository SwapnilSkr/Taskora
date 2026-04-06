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
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5 px-7 pb-10">
      <div className="rounded-modal border border-border-subtle bg-board p-4">
        <h3 className="mb-2 mt-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Status mix
        </h3>
        {statuses.map((s) => {
          const v = statusCounts[s.id] || 0
          return (
            <div key={s.id} className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="w-[110px] text-[13px] capitalize text-muted-foreground"
              >
                {s.name}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-pill bg-bar-track">
                <i
                  className="block h-full rounded-[inherit]"
                  style={{
                    width: `${(v / Math.max(roots.length, 1)) * 100}%`,
                    backgroundColor: s.color,
                  }}
                />
              </div>
              <span className="w-7 text-right text-[13px] text-fg">{v}</span>
            </div>
          )
        })}
      </div>
      <div className="rounded-modal border border-border-subtle bg-board p-4">
        <h3 className="mb-2 mt-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Time tracking
        </h3>
        <div className="text-sm text-muted-foreground">
          Estimated {totalEst} min · Logged {totalTracked} min
        </div>
        <div className="mt-3 h-2 flex-1 overflow-hidden rounded-pill bg-bar-track">
          <i
            className="block h-full rounded-[inherit] bg-upgrade"
            style={{
              width: `${totalEst ? Math.min(100, (totalTracked / totalEst) * 100) : 0}%`,
            }}
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Modeled after Asana Advanced time tracking fields (estimate + actuals on each task).
        </div>
      </div>
    </div>
  )
}
