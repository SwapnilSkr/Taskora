import '../components/layout/layout.css'
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
    <div className="stats-grid">
      <div className="stat-card">
        <h3>Project health</h3>
        <div className="n">{Math.round((done / Math.max(roots.length, 1)) * 100)}%</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>
          {done} of {roots.length} top-level tasks complete
        </div>
      </div>
      <div className="stat-card">
        <h3>Sections</h3>
        <div className="n">{sections.length}</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>
          Structured like Asana list sections
        </div>
      </div>
      <div className="stat-card">
        <h3>At risk</h3>
        <div className="n">{overdue}</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 13 }}>
          Overdue incomplete tasks
        </div>
      </div>
      <div className="stat-card">
        <h3>Description</h3>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {project.description || 'Add a short project charter in the star menu (coming soon) or keep notes in the first task.'}
        </div>
      </div>
    </div>
  )
}
