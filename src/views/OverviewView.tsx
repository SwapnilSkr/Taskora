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
import type { ProjectDoc, SectionDoc, TaskDoc } from '../types/models'
import { dueBadgeState, tsToDate } from '../utils/format'

export function OverviewView({
  project,
  tasks,
  sections,
}: {
  project: ProjectDoc
  tasks: TaskDoc[]
  sections: SectionDoc[]
}) {
  const roots = tasks.filter((t) => !t.parentTaskId)
  const done = roots.filter((t) => t.completed).length
  const open = roots.length - done
  const completionPct = roots.length ? Math.round((done / roots.length) * 100) : 0

  const overdue = roots.filter(
    (t) => dueBadgeState(tsToDate(t.dueDate), t.completed) === 'overdue',
  ).length
  const upcoming = roots.filter((t) => {
    if (t.completed) return false
    return dueBadgeState(tsToDate(t.dueDate), t.completed) === 'soon'
  }).length

  const subtasks = tasks.filter((t) => t.parentTaskId).length

  const description =
    project.description?.trim() ||
    'Add a project description from settings when available — or capture the charter in a pinned task for now.'

  return (
    <div className="space-y-6 px-7 pt-6 pb-10">
      <Card className="overflow-hidden border-0 shadow-none ring-1 ring-foreground/10">
        <CardHeader className="flex flex-row flex-wrap items-start gap-4 border-b border-border/80 pb-5">
          <span
            className="mt-0.5 size-11 shrink-0 rounded-xl ring-2 ring-foreground/10 shadow-sm"
            style={{ background: project.color }}
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl tracking-tight">{project.name}</CardTitle>
              <Badge variant="outline" className="font-normal">
                Overview
              </Badge>
            </div>
            <CardDescription className="text-[13px] leading-relaxed">
              Bird&apos;s-eye snapshot — completion, structure, and schedule pressure without leaving
              this tab.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0 font-normal tabular-nums">
            {roots.length} root · {subtasks} sub
          </Badge>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          className={cn(
            'relative overflow-hidden border-0 bg-linear-to-br from-card via-card to-chart-1/10 shadow-none ring-1 ring-foreground/10',
            'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(820px_circle_at_0%_0%,rgba(90,159,212,0.16),transparent_52%)]',
          )}
        >
          <CardHeader className="relative z-10 pb-2">
            <CardDescription className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Project health
            </CardDescription>
            <CardTitle className="mt-1 font-heading text-3xl font-semibold tabular-nums tracking-tight">
              {completionPct}
              <span className="text-lg font-medium text-muted-foreground">%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3 pt-0">
            <div className="h-2 overflow-hidden rounded-full bg-muted ring-1 ring-foreground/6">
              <div
                className="h-full rounded-full bg-linear-to-r from-chart-1 via-share to-primary shadow-[0_0_20px_-4px_rgba(90,159,212,0.5)] transition-[width] duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">{done}</span> complete ·{' '}
              <span className="font-medium text-foreground">{open}</span> open · top-level only
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'relative overflow-hidden border-0 bg-linear-to-br from-card via-card to-chart-2/12 shadow-none ring-1 ring-foreground/10',
            'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(700px_circle_at_100%_0%,rgba(124,92,255,0.16),transparent_48%)]',
          )}
        >
          <CardHeader className="relative z-10 pb-2">
            <CardDescription className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Structure
            </CardDescription>
            <CardTitle className="mt-1 font-heading text-3xl font-semibold tabular-nums tracking-tight">
              {sections.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            <p className="text-[13px] text-muted-foreground">
              List sections organize the backlog the same way you navigate in{' '}
              <span className="text-foreground/90">List</span> and{' '}
              <span className="text-foreground/90">Board</span>.
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'relative overflow-hidden border-0 bg-linear-to-br from-card via-card to-destructive/10 shadow-none ring-1 ring-foreground/10',
            'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(640px_circle_at_0%_100%,rgba(196,76,92,0.14),transparent_50%)]',
          )}
        >
          <CardHeader className="relative z-10 pb-2">
            <CardDescription className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Schedule pressure
            </CardDescription>
            <CardTitle className="mt-1 font-heading text-3xl font-semibold tabular-nums tracking-tight text-destructive">
              {overdue}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="destructive" className="font-normal tabular-nums">
                {overdue} overdue
              </Badge>
              <Badge variant="secondary" className="font-normal tabular-nums">
                {upcoming} due soon
              </Badge>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              Uses the same due-date rules as the rest of the app.
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'relative overflow-hidden border-0 bg-linear-to-br from-card via-card to-muted/30 shadow-none ring-1 ring-foreground/10',
            'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(600px_circle_at_100%_100%,rgba(255,255,255,0.04),transparent_55%)]',
          )}
        >
          <CardHeader className="relative z-10 pb-2">
            <CardDescription className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Work depth
            </CardDescription>
            <CardTitle className="mt-1 font-heading text-3xl font-semibold tabular-nums tracking-tight">
              {subtasks}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 pt-0">
            <p className="text-[13px] text-muted-foreground">
              Subtasks across the project — execution detail under your root initiatives.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-none ring-1 ring-foreground/10">
        <CardHeader className="border-b border-border/80 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Project charter</CardTitle>
              <CardDescription className="mt-1 max-w-2xl text-[13px] leading-relaxed">
                Context for anyone opening the workspace — scope, success criteria, or links to briefs.
              </CardDescription>
            </div>
            {project.description?.trim() ? (
              <Badge variant="outline" className="shrink-0 font-normal">
                Set
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0 font-normal">
                Placeholder
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <p className="m-0 max-w-3xl text-[15px] leading-[1.55] text-foreground/95">
            {description}
          </p>
          <Separator className="my-5 bg-border/60" />
          <div className="flex flex-wrap gap-3 text-[12px] text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{tasks.length}</span> total tasks
            </span>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-semibold text-foreground">{sections.length}</span> sections
            </span>
            <span className="text-border" aria-hidden>
              ·
            </span>
            <span>
              <span className="font-semibold text-foreground">{open}</span> open roots
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
