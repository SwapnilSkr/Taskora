import { format } from 'date-fns'
import type { SectionDoc, TaskDoc } from '../types/models'
import { dueBadgeState, tsToDate } from '../utils/format'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export function TimelineViewTimeline({
  tasks,
  sections,
  onTaskClick,
}: {
  tasks: TaskDoc[]
  sections: SectionDoc[]
  onTaskClick: (t: TaskDoc) => void
}) {
  const roots = tasks.filter((t) => !t.parentTaskId)
  const withDue = roots
    .map((t) => ({ t, due: tsToDate(t.dueDate) }))
    .filter((x) => x.due)
    .sort((a, b) => a.due!.getTime() - b.due!.getTime())

  return (
    <div className="px-3 pt-4 pb-8 sm:px-5 sm:pt-6 md:px-7 md:pb-10">
      <Card className="overflow-hidden border-0 shadow-none ring-1 ring-foreground/10">
        <CardHeader className="space-y-3 border-b border-border/80 bg-card pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Milestone horizon</CardTitle>
              <CardDescription className="mt-1.5 max-w-xl text-[13px] leading-relaxed">
                A concierge view of upcoming commitment dates. Each row opens the task
                canvas so you can adjust scope without leaving flow.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0 font-normal tabular-nums">
              {withDue.length} dated
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {withDue.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div
                className={cn(
                  'flex size-14 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-foreground/10',
                )}
                aria-hidden
              >
                <span className="text-2xl font-light text-muted-foreground">—</span>
              </div>
              <div>
                <p className="font-medium text-foreground">No dates on the radar yet</p>
                <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
                  Add due dates to tasks here, or open the Gantt to see inferred windows from
                  start and created timestamps.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="max-h-[min(560px,calc(100vh-260px))]">
              <div className="min-w-[640px]">
                <div
                  className={cn(
                    'grid grid-cols-[minmax(0,1fr)_140px_150px_120px] gap-0 px-4 py-3',
                    'bg-muted/20 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase',
                  )}
                >
                  <div>Work item</div>
                  <div>Section</div>
                  <div>Commitment</div>
                  <div className="text-end">Signal</div>
                </div>
                <Separator />
                {withDue.map(({ t, due }, idx) => {
                  const sec =
                    sections.find((s) => s.id === t.sectionId)?.name ?? 'Section'
                  const dueState = dueBadgeState(due!, t.completed)
                  const isLast = idx === withDue.length - 1
                  return (
                    <div key={t.id}>
                      <button
                        type="button"
                        onClick={() => onTaskClick(t)}
                        className={cn(
                          'grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_140px_150px_120px] items-center gap-0 px-4 py-4 text-left',
                          'bg-transparent transition-colors hover:bg-muted/35 focus-visible:bg-muted/40 focus-visible:outline-none',
                        )}
                      >
                        <div className="min-w-0 pr-4">
                          <div className="truncate font-semibold text-[15px] text-foreground leading-snug tracking-tight">
                            {t.title}
                          </div>
                          {t.completed ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Completed — retained for audit trail
                            </p>
                          ) : null}
                        </div>
                        <div className="text-[13px] text-muted-foreground">
                          <span className="line-clamp-2">{sec}</span>
                        </div>
                        <div>
                          <div className="font-medium tabular-nums text-foreground">
                            {format(due!, 'MMM d, yyyy')}
                          </div>
                          <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                            {format(due!, 'EEEE')}
                          </div>
                        </div>
                        <div className="flex justify-end">
                          {t.completed ? (
                            <Badge variant="outline" className="font-normal">
                              Done
                            </Badge>
                          ) : dueState === 'overdue' ? (
                            <Badge variant="destructive" className="font-normal">
                              Overdue
                            </Badge>
                          ) : dueState === 'soon' ? (
                            <Badge className="bg-chart-1/15 font-normal text-chart-1 hover:bg-chart-1/20">
                              Upcoming
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="font-normal">
                              Scheduled
                            </Badge>
                          )}
                        </div>
                      </button>
                      {!isLast ? <Separator className="bg-border/60" /> : null}
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
