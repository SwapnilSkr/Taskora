import '../components/layout/layout.css'
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
    <div style={{ padding: '0 28px 40px' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 14, fontSize: 13 }}>
        Timeline surfaces upcoming milestones (tasks with due dates). Click a row to open details and adjust dates.
      </div>
      <div
        style={{
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {withDue.length === 0 ? (
          <div style={{ padding: 18, color: 'var(--text-muted)' }}>
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
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 160px 140px',
                  gap: 12,
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  {t.completed ? (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Completed
                    </div>
                  ) : null}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>{sec}</div>
                <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {due!.toDateString()}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
