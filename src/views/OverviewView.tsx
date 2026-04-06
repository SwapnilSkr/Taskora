import type { ProjectDoc, SectionDoc, TaskDoc } from '../types/models'
import { tsToDate } from '../utils/format'

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
  const overdue = roots.filter((t) => {
    if (t.completed) return false
    const d = tsToDate(t.dueDate)
    if (!d) return false
    return d.getTime() < new Date().getTime()
  }).length

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5 px-7 pb-10">
      <div className="rounded-modal border border-border-subtle bg-board p-4">
        <h3 className="mb-2 mt-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Project health
        </h3>
        <div className="text-[28px] font-bold tracking-tight">
          {Math.round((done / Math.max(roots.length, 1)) * 100)}%
        </div>
        <div className="mt-1.5 text-[13px] text-muted-foreground">
          {done} of {roots.length} top-level tasks complete
        </div>
      </div>
      <div className="rounded-modal border border-border-subtle bg-board p-4">
        <h3 className="mb-2 mt-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Sections
        </h3>
        <div className="text-[28px] font-bold tracking-tight">{sections.length}</div>
        <div className="mt-1.5 text-[13px] text-muted-foreground">
          Structured like Asana list sections
        </div>
      </div>
      <div className="rounded-modal border border-border-subtle bg-board p-4">
        <h3 className="mb-2 mt-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          At risk
        </h3>
        <div className="text-[28px] font-bold tracking-tight">{overdue}</div>
        <div className="mt-1.5 text-[13px] text-muted-foreground">Overdue incomplete tasks</div>
      </div>
      <div className="rounded-modal border border-border-subtle bg-board p-4">
        <h3 className="mb-2 mt-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Description
        </h3>
        <div className="text-sm leading-normal text-muted-foreground">
          {project.description ||
            'Add a short project charter in the star menu (coming soon) or keep notes in the first task.'}
        </div>
      </div>
    </div>
  )
}
