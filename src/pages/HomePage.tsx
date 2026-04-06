import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useModals } from '../context/ModalContext'
import { createProject, subscribeProjects } from '../services/db'
import type { ProjectDoc } from '../types/models'

export function HomePage() {
  const { user } = useAuth()
  const { prompt } = useModals()
  const nav = useNavigate()
  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const uid = user?.uid ?? ''

  useEffect(() => {
    if (!uid) return
    return subscribeProjects(uid, setProjects)
  }, [uid])

  async function onCreate() {
    if (!uid) return
    const name = await prompt({
      title: 'Create project',
      message: 'Projects hold sections, tasks, and every view (list, board, Gantt, and more).',
      label: 'Project name',
      defaultValue: 'New project',
      confirmLabel: 'Create',
    })
    if (!name?.trim()) return
    const id = await createProject(uid, name.trim())
    nav(`/project/${id}/list`)
  }

  return (
    <div className="px-8 pb-12 pt-7">
      <h1 className="mb-2 mt-0 text-[26px] font-bold tracking-tight">
        Home
      </h1>
      <p className="m-0 max-w-[640px] leading-relaxed text-muted">
        Taskora mirrors the Asana-style workflows you expect — list, board, timeline, Gantt, approvals, workload, time tracking, dependencies, and attachments via Firebase Storage.
      </p>

      <div className="mt-7">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-pill bg-create px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-create-hover"
          onClick={() => void onCreate()}
        >
          New project
        </button>
      </div>

      <div className="mt-7 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => nav(`/project/${p.id}/list`)}
            className="cursor-pointer rounded-xl border border-border-subtle bg-board p-4 text-left"
          >
            <div className="flex items-center gap-2.5">
              <span
                className="h-3 w-3 shrink-0 rounded-[3px]"
                style={{ background: p.color }}
              />
              <span className="font-bold">{p.name}</span>
            </div>
            <div className="mt-2 text-xs text-muted">Open list view</div>
          </button>
        ))}
      </div>
    </div>
  )
}
