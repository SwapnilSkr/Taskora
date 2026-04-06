import { useMemo, useState } from 'react'
import '../components/layout/layout.css'
import { useAuth } from '../context/AuthContext'
import { useAggregatedTasks } from '../hooks/useAggregatedTasks'
import type { TaskDoc } from '../types/models'
import { fmtDate, tsToDate } from '../utils/format'
import { TaskDetailPanel } from '../components/TaskDetailPanel'

export function MyTasksPage() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const { rows, byProject } = useAggregatedTasks(uid)
  const mine = useMemo(
    () => rows.filter((r) => r.task.assigneeId === uid),
    [rows, uid],
  )
  const [selected, setSelected] = useState<{
    projectId: string
    task: TaskDoc
  } | null>(null)

  return (
    <div style={{ padding: '28px 32px 48px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 26 }}>My tasks</h1>
      <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: 720 }}>
        Everything assigned to you across projects — similar to Asana &quot;My tasks&quot;.
      </p>

      <div
        style={{
          marginTop: 18,
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {mine.length === 0 ? (
          <div style={{ padding: 18, color: 'var(--text-muted)' }}>
            Assign tasks to yourself from the task pane to see them here.
          </div>
        ) : (
          mine.map(({ project, task: t }) => (
            <button
              key={`${project.id}-${t.id}`}
              type="button"
              onClick={() => setSelected({ projectId: project.id, task: t })}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'transparent',
                display: 'grid',
                gridTemplateColumns: '1fr 140px 120px',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {project.name}
                </div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {fmtDate(tsToDate(t.dueDate))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {t.completed ? 'Done' : 'Open'}
              </div>
            </button>
          ))
        )}
      </div>

      {selected ? (
        <TaskDetailPanel
          uid={uid}
          projectId={selected.projectId}
          task={selected.task}
          allTasks={byProject[selected.projectId] ?? []}
          onClose={() => setSelected(null)}
          onSaved={() => {
            const list = byProject[selected.projectId]
            const next = list?.find((x) => x.id === selected.task.id)
            if (next) setSelected({ projectId: selected.projectId, task: next })
          }}
        />
      ) : null}
    </div>
  )
}
