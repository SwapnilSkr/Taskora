import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useModals } from '../../context/ModalContext'
import { createProject, subscribeProjects } from '../../services/db'
import type { ProjectDoc } from '../../types/models'
import {
  IconBell,
  IconChart,
  IconCheckCircle,
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconHome,
  IconMail,
  IconPlus,
  IconTarget,
} from '../icons'
import './layout.css'

export function Sidebar() {
  const { user, logout } = useAuth()
  const { prompt } = useModals()
  const nav = useNavigate()
  const loc = useLocation()
  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const [teamOpen, setTeamOpen] = useState(true)

  useEffect(() => {
    if (!user) return
    const unsub = subscribeProjects(user.uid, setProjects)
    return () => unsub()
  }, [user])

  async function onCreateProject() {
    if (!user) return
    const name = await prompt({
      title: 'Create project',
      message: 'Give your project a clear name. You can add sections and tasks next.',
      label: 'Project name',
      defaultValue: 'New project',
      confirmLabel: 'Create',
    })
    if (!name?.trim()) return
    const id = await createProject(user.uid, name.trim())
    nav(`/project/${id}/list`)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Taskora</div>

      <button type="button" className="btn-create" onClick={onCreateProject}>
        <IconPlus width={18} height={18} />
        Create
      </button>

      <NavLink to="/home" className="nav-item">
        <IconHome />
        <span>Home</span>
      </NavLink>
      <NavLink to="/my-tasks" className="nav-item">
        <IconCheckCircle />
        <span>My tasks</span>
      </NavLink>
      <NavLink to="/inbox" className="nav-item">
        <IconBell />
        <span>Inbox</span>
      </NavLink>

      <div className="nav-section-label">Insights</div>
      <button type="button" className="nav-item" disabled title="Coming soon">
        <IconChart />
        <span>Reporting</span>
      </button>
      <button type="button" className="nav-item" disabled title="Coming soon">
        <IconFolder />
        <span>Portfolios</span>
      </button>
      <button type="button" className="nav-item" disabled title="Coming soon">
        <IconTarget />
        <span>Goals</span>
      </button>

      <div className="nav-section-label">Projects</div>
      {projects.map((p) => (
        <Link
          key={p.id}
          to={`/project/${p.id}/list`}
          className="nav-item"
          aria-current={
            loc.pathname.startsWith(`/project/${p.id}`) ? 'page' : undefined
          }
        >
          <span
            className="project-dot"
            style={{ background: p.color || 'var(--purple-project)' }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.name}
          </span>
        </Link>
      ))}

      <div className="nav-section-label">Team</div>
      <button
        type="button"
        className="nav-item"
        onClick={() => setTeamOpen((v) => !v)}
      >
        {teamOpen ? <IconChevronDown /> : <IconChevronRight />}
        <span>Everlore</span>
      </button>

      <div className="sidebar-footer">
        <button type="button" className="btn-upgrade">
          Upgrade
        </button>
        <button type="button" className="link-muted">
          <IconMail />
          Invite teammates
        </button>
        <button
          type="button"
          className="link-muted"
          onClick={() => void logout()}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
