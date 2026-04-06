import type { SectionDoc, TaskDoc } from '../types/models'
import { tsToDate } from '../utils/format'

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
    <div className="px-7 pb-10">
      <div className="mb-3.5 text-[13px] text-muted">
        Timeline surfaces upcoming milestones (tasks with due dates). Click a row to open details and adjust dates.
      </div>
      <div className="overflow-hidden rounded-modal border border-border-subtle">
        {withDue.length === 0 ? (
          <div className="p-[18px] text-muted">
            Add due dates to tasks to populate this timeline — or open the Gantt tab to see inferred windows.
          </div>
        ) : (
          withDue.map(({ t, due }) => {
            const sec =
              sections.find((s) => s.id === t.sectionId)?.name ?? 'Section'
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTaskClick(t)}
                className="grid w-full cursor-pointer grid-cols-[1fr_160px_140px] items-center gap-3 border-b border-border-subtle bg-transparent px-3.5 py-3 text-left text-inherit last:border-b-0"
              >
                <div>
                  <div className="font-semibold">{t.title}</div>
                  {t.completed ? (
                    <div className="mt-1 text-[11px] text-muted">Completed</div>
                  ) : null}
                </div>
                <div className="text-muted">{sec}</div>
                <div className="tabular-nums">{due!.toDateString()}</div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
