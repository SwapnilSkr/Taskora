import clsx from 'clsx'
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
  IconSettings,
  IconTarget,
} from '../icons'

const navBtn =
  'flex w-full items-center gap-2.5 rounded-card px-2.5 py-2 text-left text-[13px] text-fg transition-colors duration-[120ms] hover:bg-hover-surface disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-muted'

const navActive = 'bg-hover-surface [&_svg]:text-fg'

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
    <aside className="sticky top-0 flex h-screen w-sidebar shrink-0 flex-col overflow-auto border-r border-border-subtle bg-sidebar px-2.5 pb-4 pt-3">
      <div className="flex items-center gap-2 px-2 pb-3 pt-1 text-[15px] font-semibold tracking-tight">
        Taskora
      </div>

      <button
        type="button"
        className="mb-3.5 flex w-full items-center justify-center gap-2 rounded-pill bg-create px-3 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-create-hover"
        onClick={onCreateProject}
      >
        <IconPlus width={18} height={18} />
        Create
      </button>

      <NavLink
        to="/home"
        className={({ isActive }) => clsx(navBtn, isActive && navActive)}
      >
        <IconHome />
        <span>Home</span>
      </NavLink>
      <NavLink
        to="/my-tasks"
        className={({ isActive }) => clsx(navBtn, isActive && navActive)}
      >
        <IconCheckCircle />
        <span>My tasks</span>
      </NavLink>
      <NavLink
        to="/inbox"
        className={({ isActive }) => clsx(navBtn, isActive && navActive)}
      >
        <IconBell />
        <span>Inbox</span>
      </NavLink>
      <NavLink
        to="/status"
        className={({ isActive }) => clsx(navBtn, isActive && navActive)}
      >
        <IconSettings />
        <span>Status tags</span>
      </NavLink>

      <div className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        Insights
      </div>
      <button type="button" className={navBtn} disabled title="Coming soon">
        <IconChart />
        <span>Reporting</span>
      </button>
      <button type="button" className={navBtn} disabled title="Coming soon">
        <IconFolder />
        <span>Portfolios</span>
      </button>
      <button type="button" className={navBtn} disabled title="Coming soon">
        <IconTarget />
        <span>Goals</span>
      </button>

      <div className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        Projects
      </div>
      {projects.map((p) => (
        <Link
          key={p.id}
          to={`/project/${p.id}/list`}
          className={clsx(
            navBtn,
            loc.pathname.startsWith(`/project/${p.id}`) && navActive,
          )}
          aria-current={
            loc.pathname.startsWith(`/project/${p.id}`) ? 'page' : undefined
          }
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: p.color || 'var(--color-project)' }}
          />
          <span className="truncate">{p.name}</span>
        </Link>
      ))}

      <div className="px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        Team
      </div>
      <button
        type="button"
        className={navBtn}
        onClick={() => setTeamOpen((v) => !v)}
      >
        {teamOpen ? <IconChevronDown /> : <IconChevronRight />}
        <span>Everlore</span>
      </button>

      <div className="mt-auto flex flex-col gap-2.5 pt-4">
        <button type="button" className={clsx(navBtn, 'text-muted')}>
          <IconMail />
          Invite teammates
        </button>
        <button
          type="button"
          className={clsx(navBtn, 'text-muted')}
          onClick={() => void logout()}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
