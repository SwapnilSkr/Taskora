import {
  addDays,
  differenceInCalendarDays,
  format,
  max as maxDate,
  min as minDate,
} from 'date-fns'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
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

function buildMonthSpans(days: Date[]) {
  const spans: { label: string; start: number; len: number }[] = []
  let idx = 0
  while (idx < days.length) {
    const label = format(days[idx], 'MMM yyyy')
    let end = idx
    while (end < days.length && format(days[end], 'MMM yyyy') === label) {
      end++
    }
    spans.push({ label, start: idx, len: end - idx })
    idx = end
  }
  return spans
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
      <div className="px-7 pt-6 pb-10">
        <Card className="border-0 py-12 shadow-none ring-1 ring-foreground/10">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <div
              className="flex size-14 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-foreground/10"
              aria-hidden
            >
              <span className="text-xl text-muted-foreground">◎</span>
            </div>
            <div>
              <CardTitle className="text-base">Nothing to schedule yet</CardTitle>
              <CardDescription className="mx-auto mt-2 max-w-sm text-[13px]">
                Add tasks from the List view — bars appear from start and due dates, with gentle
                inference when dates are missing.
              </CardDescription>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const minD = minDate(rows.map((r) => r.start))
  const maxD = maxDate(rows.map((r) => r.end))
  const totalDays = Math.max(21, differenceInCalendarDays(maxD, minD) + 8)
  const days = Array.from({ length: totalDays }, (_, i) => addDays(minD, i))
  const monthSpans = buildMonthSpans(days)

  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const todayOffset = Math.max(
    0,
    Math.min(totalDays - 1, differenceInCalendarDays(today, minD)),
  )
  const pctPerDay = 100 / totalDays

  const gridCols = `minmax(200px,240px) repeat(${totalDays}, minmax(24px, 1fr))`

  return (
    <div className="px-7 pt-6 pb-10">
      <Card className="overflow-hidden border-0 shadow-none ring-1 ring-foreground/10">
        <CardHeader className="border-b border-border/80 bg-card pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Execution runway</CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl text-[13px] leading-relaxed">
                Dense, editorial scheduling: each lane aligns to calendar days. The accent guide
                marks today; inferred spans are softly labeled so the team knows where to tighten
                dates.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-normal tabular-nums">
                {rows.length} lanes
              </Badge>
              <Badge variant="secondary" className="font-normal">
                Live grid
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <TooltipProvider delayDuration={200}>
            <div className="overflow-x-auto bg-gantt-grid-bg/30">
              <div className="min-w-[760px]">
                {/* Month band */}
                <div className="grid" style={{ gridTemplateColumns: gridCols }}>
                  <div
                    className={cn(
                      'sticky left-0 z-30 border-b border-r border-border-subtle bg-card/95 px-3 py-2.5 backdrop-blur-md',
                    )}
                  />
                  {monthSpans.map((s) => (
                    <div
                      key={`${s.label}-${s.start}`}
                      className="border-b border-l border-border-subtle bg-muted/15 py-2.5 text-center text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase"
                      style={{ gridColumn: `${s.start + 2} / span ${s.len}` }}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>

                {/* Day scale */}
                <div className="grid" style={{ gridTemplateColumns: gridCols }}>
                  <div
                    className={cn(
                      'sticky left-0 z-30 border-b border-r border-border-subtle bg-card/95 px-3 py-2.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase backdrop-blur-md',
                    )}
                  >
                    Task
                  </div>
                  {days.map((d, i) => (
                    <div
                      key={i}
                      className={cn(
                        'border-b border-l border-border-subtle px-0.5 py-2.5 text-center text-[10px] font-semibold tabular-nums text-muted-foreground',
                        i % 7 === 0 ? 'bg-muted/25' : 'bg-card/40',
                      )}
                    >
                      {i % 3 === 0 || i === 0 || i === days.length - 1 ? format(d, 'd') : ''}
                    </div>
                  ))}
                </div>

                {rows.map(({ task: t, start, end, inferred }) => {
                  const offset = Math.max(0, differenceInCalendarDays(start, minD))
                  const len = Math.max(1, differenceInCalendarDays(end, start) + 1)
                  return (
                    <div
                      key={t.id}
                      className="grid min-h-11 items-stretch border-b border-border-subtle"
                      style={{ gridTemplateColumns: gridCols }}
                    >
                      <div
                        className={cn(
                          'sticky left-0 z-20 flex flex-col justify-center gap-0.5 border-r border-border-subtle bg-card/95 px-3 py-2.5 backdrop-blur-md',
                        )}
                      >
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold tracking-tight">
                          <button
                            type="button"
                            className={cn(
                              'block w-full cursor-pointer border-none bg-transparent p-0 text-left font-inherit',
                              'text-foreground transition-colors hover:text-primary',
                            )}
                            onClick={() => onTaskClick(t)}
                          >
                            {t.title}
                          </button>
                        </div>
                        {inferred ? (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Inferred window · refine in details
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="relative min-h-11 border-l border-border-subtle bg-[#16171a]/80"
                        style={{ gridColumn: `2 / -1` }}
                      >
                        <div
                          className="pointer-events-none absolute bottom-0 top-0 z-1 w-px bg-primary/90 shadow-[0_0_12px_2px_rgba(224,109,94,0.35)]"
                          style={{
                            left: `calc(${todayOffset * pctPerDay}% + ${pctPerDay / 2}%)`,
                          }}
                          aria-hidden
                        />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              role="button"
                              tabIndex={0}
                              className={cn(
                                'absolute top-[7px] z-2 h-6 min-w-2 cursor-pointer rounded-lg',
                                'bg-linear-to-r from-share via-project to-primary',
                                'opacity-92 ring-1 ring-white/15 transition-all duration-200',
                                'hover:scale-[1.01] hover:opacity-100 hover:shadow-[0_8px_28px_-8px_rgba(124,92,255,0.55)]',
                                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                              )}
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
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            <span className="font-medium">{t.title}</span>
                            <span className="mt-1 block text-[11px] opacity-90">
                              {format(start, 'MMM d')} → {format(end, 'MMM d, yyyy')}
                              {inferred ? ' · inferred' : ''}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  )
}
