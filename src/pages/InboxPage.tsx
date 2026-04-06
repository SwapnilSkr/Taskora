import { useMemo, useState } from 'react'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { useAuth } from '../context/AuthContext'
import { useAggregatedTasks } from '../hooks/useAggregatedTasks'
import type { TaskDoc } from '../types/models'

export function InboxPage() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const { rows, byProject } = useAggregatedTasks(uid)
  const inbox = useMemo(
    () => rows.filter((r) => r.task.approvalStatus === 'pending'),
    [rows],
  )
  const [selected, setSelected] = useState<{
    projectId: string
    task: TaskDoc
  } | null>(null)

  return (
    <div style={{ padding: '28px 32px 48px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 26 }}>Inbox</h1>
      <p className="m-0 max-w-[720px] text-muted">
        Surfaces items needing attention — approvals (Asana Advanced) and blocked tasks. Extend with comment @mentions using the same task activity model.
      </p>
      <div
        style={{
          marginTop: 18,
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {inbox.length === 0 ? (
          <div className="p-[18px] text-muted">
            You&apos;re all caught up. Mark a task as &quot;Pending approval&quot; to see it land here.
          </div>
        ) : (
          inbox.map(({ project, task: t }) => (
            <button
              key={`${project.id}-${t.id}`}
              type="button"
              onClick={() => setSelected({ projectId: project.id, task: t })}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderBottom: '1px solid var(--color-border-subtle)',
                background: 'transparent',
              }}
            >
              <div style={{ fontWeight: 700 }}>{t.title}</div>
              <div className="mt-1 text-xs text-muted">
                {project.name} ·{' '}
                {t.approvalStatus === 'pending' ? 'Needs approval' : 'Blocked'}
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
          onOpenTask={(st) =>
            setSelected((prev) =>
              prev ? { projectId: prev.projectId, task: st } : null,
            )
          }
        />
      ) : null}
    </div>
  )
}
