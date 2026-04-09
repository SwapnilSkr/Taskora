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
    <div className="px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-7 md:px-8">
      <h1 className="mb-2 mt-0 text-[22px] font-bold tracking-tight sm:text-[26px]">
        Inbox
      </h1>
      <p className="m-0 max-w-[720px] text-muted-foreground">
        Surfaces items needing attention — approvals and blocked tasks. Extend with comment @mentions using the same task activity model.
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
          <div className="p-[18px] text-muted-foreground">
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
              <div className="mt-1 text-xs text-muted-foreground">
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
