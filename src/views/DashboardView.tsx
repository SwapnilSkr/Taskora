import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { StatusDoc, TaskDoc } from '../types/models'
import { dueBadgeState, tsToDate } from '../utils/format'

function formatMinutes(m: number) {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export function DashboardView({
  tasks,
  statuses,
}: {
  tasks: TaskDoc[]
  statuses: StatusDoc[]
}) {
  const roots = tasks.filter((t) => !t.parentTaskId)
  const completed = roots.filter((t) => t.completed).length
  const open = roots.length - completed
  const completionPct = roots.length ? Math.round((completed / roots.length) * 100) : 0

  const overdue = roots.filter((t) =>
    dueBadgeState(tsToDate(t.dueDate), t.completed) === 'overdue',
  ).length

  const statusCounts: Record<string, number> = {}
  for (const s of statuses) statusCounts[s.id] = 0
  for (const t of roots) {
    if (t.statusId) {
      statusCounts[t.statusId] = (statusCounts[t.statusId] || 0) + 1
    }
  }

  const totalTracked = roots.reduce((n, t) => n + (t.trackedMinutes ?? 0), 0)
  const totalEst = roots.reduce((n, t) => n + (t.estimatedMinutes ?? 0), 0)
  const timeUtilPct = totalEst
    ? Math.min(100, Math.round((totalTracked / totalEst) * 100))
    : totalTracked > 0
      ? 100
      : 0

  const sortedStatuses = [...statuses].sort((a, b)=> a.sortOrder - b.sortOrder)

  return (
    <div className="space-y-6 px-7 pt-6 pb-10">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          className={cn(
            'relative overflow-hidden border-0 bg-linear-to-br from-card via-card to-chart-2/10 shadow-none ring-1 ring-foreground/10',
            'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(900px_circle_at_0%_0%,rgba(124,92,255,0.14),transparent_55%)]',
          )}
        >
          <CardHeader className="relative z-10 pb-2">
            <CardDescription className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Portfolio breadth
            </CardDescription>
            <CardTitle className="mt-1 font-heading text-3xl font-semibold tabular-nums tracking-tight">
              {roots.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            <p className="text-sm text-muted-foreground">
              Top-level work items in this project lens
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="font-normal">
                {open} open
              </Badge>
              <Badge variant="outline" className="border-primary/25 font-normal text-primary">
                {completed} done
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'relative overflow-hidden border-0 bg-linear-to-br from-card via-card to-primary/10 shadow-none ring-1 ring-foreground/10',
            'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(760px_circle_at_100%_0%,rgba(224,109,94,0.12),transparent_50%)]',
          )}
        >
          <CardHeader className="relative z-10 pb-2">
            <CardDescription className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Completion cadence
            </CardDescription>
            <CardTitle className="mt-1 font-heading text-3xl font-semibold tabular-nums tracking-tight">
              {completionPct}
              <span className="text-lg font-medium text-muted-foreground">%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/6"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-linear-to-r from-primary via-create-hover to-chart-1 shadow-[0_0_20px_-4px_rgba(224,109,94,0.65)]"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Rolling ratio across all root tasks in view
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'relative overflow-hidden border-0 bg-linear-to-br from-card via-card to-chart-5/12 shadow-none ring-1 ring-foreground/10',
            'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(700px_circle_at_0%_100%,rgba(69,115,210,0.12),transparent_52%)]',
          )}
        >
          <CardHeader className="relative z-10 pb-2">
            <CardDescription className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Delivery risk
            </CardDescription>
            <CardTitle className="mt-1 font-heading text-3xl font-semibold tabular-nums tracking-tight text-destructive">
              {overdue}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            <p className="text-sm text-muted-foreground">
              Open tasks past due — surfaced for triage, not blame
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'relative overflow-hidden border-0 bg-linear-to-br from-card via-card to-chart-4/15 shadow-none ring-1 ring-foreground/10',
            'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(680px_circle_at_100%_100%,rgba(200,169,109,0.14),transparent_48%)]',
          )}
        >
          <CardHeader className="relative z-10 pb-2">
            <CardDescription className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Time realization
            </CardDescription>
            <CardTitle className="mt-1 font-heading text-3xl font-semibold tabular-nums tracking-tight">
              {timeUtilPct}
              <span className="text-lg font-medium text-muted-foreground">%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{formatMinutes(totalTracked)}</span>
              {' logged '}
              <span className="text-muted-foreground/80">·</span>
              {' '}
              <span className="font-medium text-foreground">{formatMinutes(totalEst)}</span>
              {' estimated'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-none ring-1 ring-foreground/10">
          <CardHeader className="border-b border-border/80 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Status composition</CardTitle>
                <CardDescription className="mt-1 text-[13px]">
                  How work is distributed across your workflow columns
                </CardDescription>
              </div>
              <Badge variant="outline" className="shrink-0 font-normal">
                {roots.length} tasks
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {sortedStatuses.map((s) => {
              const v = statusCounts[s.id] || 0
              const pct = roots.length ? (v / roots.length) * 100 : 0
              return (
                <div key={s.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <span
                        className="size-2 shrink-0 rounded-full ring-2 ring-foreground/10"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="truncate capitalize">{s.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {v}
                      <span className="text-muted-foreground/70"> ({Math.round(pct)}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted/80 ring-1 ring-foreground/5">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: s.color,
                        boxShadow: `0 0 18px -3px ${s.color}`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-none ring-1 ring-foreground/10">
          <CardHeader className="border-b border-border/80 pb-4">
            <CardTitle className="text-base">Time intelligence</CardTitle>
            <CardDescription className="mt-1 text-[13px]">
              Estimate versus actuals aggregated from every task in view
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Utilization
                </p>
                <p className="mt-1 font-heading text-4xl font-semibold tabular-nums tracking-tight text-foreground">
                  {timeUtilPct}
                  <span className="text-2xl font-medium text-muted-foreground">%</span>
                </p>
              </div>
              <div className="text-right text-[13px] text-muted-foreground">
                <div>
                  <span className="text-foreground">{formatMinutes(totalEst)}</span> planned
                </div>
                <div className="mt-0.5">
                  <span className="text-foreground">{formatMinutes(totalTracked)}</span> logged
                </div>
              </div>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/6">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-chart-4 via-upgrade to-chart-1"
                style={{
                  width: `${totalEst ? Math.min(100, (totalTracked / totalEst) * 100) : totalTracked > 0 ? 100 : 0}%`,
                }}
              />
            </div>
            <Separator className="bg-border/60" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Fields mirror advanced time tracking — refine per task to tighten forecast accuracy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
