import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { TaskDoc } from '../types/models'

function formatMinutes(m: number) {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

type BucketTheme = {
  label: string
  hint: string
  gradient: string
  radial: string
}

const bucketMeta: Record<string, BucketTheme> = {
  You: {
    label: 'Your queue',
    hint: 'Commitments assigned to you in this filter',
    gradient: 'from-chart-5/20 via-transparent to-primary/10',
    radial:
      'before:bg-[radial-gradient(640px_circle_at_80%_0%,rgba(69,115,210,0.18),transparent_50%)]',
  },
  'Other assignees': {
    label: 'Collaborators',
    hint: 'Distributed ownership across the team',
    gradient: 'from-chart-2/15 via-transparent to-chart-1/10',
    radial:
      'before:bg-[radial-gradient(600px_circle_at_0%_0%,rgba(124,92,255,0.16),transparent_48%)]',
  },
  Unassigned: {
    label: 'Triage pool',
    hint: 'Ready for routing before execution stress builds',
    gradient: 'from-muted/40 via-transparent to-chart-4/12',
    radial:
      'before:bg-[radial-gradient(560px_circle_at_100%_100%,rgba(200,169,109,0.14),transparent_45%)]',
  },
}

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

  const order = ['You', 'Other assignees', 'Unassigned'] as const
  const entries = order
    .filter((k) => buckets.has(k))
    .map((k) => [k, buckets.get(k)!] as const)

  const maxCount = Math.max(1, ...entries.map(([, arr]) => arr.length))
  const totalOpen = roots.length
  const totalEst = roots.reduce((n, t) => n + (t.estimatedMinutes ?? 0), 0)

  return (
    <div className="space-y-6 px-3 pt-4 pb-8 sm:px-5 sm:pt-6 md:px-7 md:pb-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-0 shadow-none ring-1 ring-foreground/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] font-semibold tracking-[0.14em] uppercase">
              Open surface
            </CardDescription>
            <CardTitle className="font-heading text-3xl font-semibold tabular-nums">
              {totalOpen}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[13px] text-muted-foreground">
              Active root tasks in the current lens
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-none ring-1 ring-foreground/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] font-semibold tracking-[0.14em] uppercase">
              Planned effort
            </CardDescription>
            <CardTitle className="font-heading text-3xl font-semibold tabular-nums">
              {formatMinutes(totalEst)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[13px] text-muted-foreground">
              Sum of estimates on open work
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-none ring-1 ring-foreground/10">
          <CardHeader className="pb-2">
            <CardDescription className="text-[11px] font-semibold tracking-[0.14em] uppercase">
              Load shape
            </CardDescription>
            <CardTitle className="font-heading text-3xl font-semibold tabular-nums">
              {entries.length || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[13px] text-muted-foreground">
              Distinct ownership bands with open work
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-0 shadow-none ring-1 ring-foreground/10">
        <CardHeader className="border-b border-border/80 bg-card pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Capacity tapestry</CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl text-[13px] leading-relaxed">
                Compare breadth of open tasks by assignee bucket,
                layered with aggregate estimates for staffing conversations.
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0 font-normal">
              Snapshot
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-1 lg:grid-cols-3">
          {entries.length === 0 ? (
            <div className="col-span-full flex flex-col items-center py-14 text-center">
              <p className="font-medium text-foreground">No open tasks in view</p>
              <p className="mt-2 max-w-sm text-[13px] text-muted-foreground">
                When work lands on your plate, this studio fills with proportional load ribbons and
                estimate totals.
              </p>
            </div>
          ) : (
            entries.map(([key, arr]) => {
              const meta = bucketMeta[key] ?? {
                label: key,
                hint: '',
                gradient: 'from-muted/30 via-transparent to-muted/10',
                radial:
                  'before:bg-[radial-gradient(520px_circle_at_50%_50%,rgba(255,255,255,0.04),transparent_55%)]',
              }
              const pct = Math.round((arr.length / maxCount) * 100)
              const est = arr.reduce((n, t) => n + (t.estimatedMinutes ?? 0), 0)
              return (
                <Card
                  key={key}
                  className={cn(
                    'relative overflow-hidden border-0 bg-linear-to-br shadow-none ring-1 ring-foreground/10',
                    meta.gradient,
                    'before:pointer-events-none before:absolute before:inset-0',
                    meta.radial,
                  )}
                >
                  <CardHeader className="relative z-10 space-y-1 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{meta.label}</CardTitle>
                      <Badge variant="secondary" className="font-normal tabular-nums">
                        {arr.length}
                      </Badge>
                    </div>
                    <CardDescription className="text-[12px] leading-relaxed">
                      {meta.hint}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-4 pt-0">
                    <div>
                      <div className="mb-2 flex justify-between text-[11px] font-medium text-muted-foreground uppercase">
                        <span>Relative load</span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-muted/90 ring-1 ring-foreground/6">
                        <div
                          className={cn(
                            'h-full rounded-full bg-linear-to-r from-share via-project to-primary',
                            'shadow-[0_0_22px_-6px_rgba(124,92,255,0.45)] transition-[width] duration-700 ease-out',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <Separator className="bg-border/60" />
                    <div className="flex items-end justify-between gap-3 text-[13px]">
                      <span className="text-muted-foreground">Estimate load</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {est > 0 ? formatMinutes(est) : '—'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
