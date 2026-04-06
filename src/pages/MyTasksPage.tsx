import { useMemo, useState } from 'react'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { useAuth } from '../context/AuthContext'
import { useAggregatedTasks } from '../hooks/useAggregatedTasks'
import type { TaskDoc } from '../types/models'
import { fmtDate, tsToDate } from '../utils/format'

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
    <div className="px-8 pb-12 pt-7">
      <h1 className="mb-2 mt-0 text-[26px] font-bold">My tasks</h1>
      <p className="m-0 max-w-[720px] text-muted-foreground">
        Everything assigned to you across projects — similar to Asana &quot;My tasks&quot;.
      </p>

      <div className="mt-[18px] overflow-hidden rounded-modal border border-border-subtle">
        {mine.length === 0 ? (
          <div className="p-[18px] text-muted-foreground">
            Assign tasks to yourself from the task pane to see them here.
          </div>
        ) : (
          mine.map(({ project, task: t }) => (
            <button
              key={`${project.id}-${t.id}`}
              type="button"
              onClick={() => setSelected({ projectId: project.id, task: t })}
              className="grid w-full cursor-pointer grid-cols-[1fr_140px_120px] items-center gap-3 border-b border-border-subtle bg-transparent px-3.5 py-3 text-left last:border-b-0"
            >
              <div>
                <div className="font-bold">{t.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{project.name}</div>
              </div>
              <div className="text-[13px] text-muted-foreground">
                {fmtDate(tsToDate(t.dueDate))}
              </div>
              <div className="text-xs text-muted-foreground">{t.completed ? 'Done' : 'Open'}</div>
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
