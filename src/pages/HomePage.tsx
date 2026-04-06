import { useNavigate } from 'react-router-dom'
import '../components/layout/layout.css'
import { useAuth } from '../context/AuthContext'
import { useModals } from '../context/ModalContext'
import { createProject, subscribeProjects } from '../services/db'
import type { ProjectDoc } from '../types/models'
import { useEffect, useState } from 'react'

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
    <div style={{ padding: '28px 32px 48px' }}>
      <h1 style={{ margin: '0 0 8px', fontSize: 26, letterSpacing: '-0.03em' }}>
        Home
      </h1>
      <p style={{ margin: 0, color: 'var(--text-muted)', maxWidth: 640, lineHeight: 1.6 }}>
        Taskora mirrors the Asana-style workflows you expect — list, board, timeline, Gantt, approvals, workload, time tracking, dependencies, and attachments via Firebase Storage.
      </p>

      <div style={{ marginTop: 28 }}>
        <button type="button" className="btn-create" style={{ width: 'auto', paddingInline: 22 }} onClick={() => void onCreate()}>
          New project
        </button>
      </div>

      <div
        style={{
          marginTop: 28,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 14,
        }}
      >
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => nav(`/project/${p.id}/list`)}
            style={{
              textAlign: 'left',
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--border-subtle)',
              background: '#1b1c1f',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                className="project-dot"
                style={{ background: p.color, width: 12, height: 12 }}
              />
              <span style={{ fontWeight: 700 }}>{p.name}</span>
            </div>
            <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 12 }}>
              Open list view
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
