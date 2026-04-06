import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  ChartColumn,
  CheckCircle2,
  Folder,
  Home,
  Plus,
  Settings,
  Target,
} from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useModals } from '@/context/ModalContext'
import { createProject, subscribeProjects } from '@/services/db'
import type { ProjectDoc } from '@/types/models'
import { ProjectColorPicker } from '@/components/ProjectColorPicker'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

const navBtn =
  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-foreground transition-colors duration-[120ms] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

const navActive = 'bg-accent [&_svg]:text-foreground'

type SidebarContentProps = {
  /** Called when the active route changes (e.g. close mobile sheet). */
  onNavigate?: () => void
}

/** Shared nav body for desktop rail and mobile sheet */
export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const { user, logout } = useAuth()
  const { prompt } = useModals()
  const nav = useNavigate()
  const loc = useLocation()
  const [projects, setProjects] = useState<ProjectDoc[]>([])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeProjects(user.uid, setProjects)
    return () => unsub()
  }, [user])

  const pathWhenMounted = useRef(loc.pathname)
  useEffect(() => {
    if (pathWhenMounted.current === loc.pathname) return
    pathWhenMounted.current = loc.pathname
    onNavigate?.()
  }, [loc.pathname, onNavigate])

  async function onCreateProject() {
    if (!user) return
    const name = await prompt({
      title: 'Create project',
      message:
        'Give your project a clear name. You can add sections and tasks next.',
      label: 'Project name',
      defaultValue: 'New project',
      confirmLabel: 'Create',
    })
    if (!name?.trim()) return
    const id = await createProject(user.uid, name.trim())
    nav(`/project/${id}/list`)
  }

  return (
    <ScrollArea className="h-full min-h-0 px-2.5 pb-4 pt-3">
      <div className="flex items-center gap-2 px-2 pb-3 pt-1 text-[15px] font-semibold tracking-tight">
        Taskora
      </div>

      <Button
        type="button"
        className="mb-3.5 w-full rounded-full font-semibold"
        onClick={onCreateProject}
      >
        <Plus className="size-[18px]" />
        Create
      </Button>

      <NavLink
        to="/home"
        className={({ isActive }) => clsx(navBtn, isActive && navActive)}
      >
        <Home />
        <span>Home</span>
      </NavLink>
      <NavLink
        to="/my-tasks"
        className={({ isActive }) => clsx(navBtn, isActive && navActive)}
      >
        <CheckCircle2 />
        <span>My tasks</span>
      </NavLink>
      <NavLink
        to="/inbox"
        className={({ isActive }) => clsx(navBtn, isActive && navActive)}
      >
        <Bell />
        <span>Inbox</span>
      </NavLink>
      <NavLink
        to="/status"
        className={({ isActive }) => clsx(navBtn, isActive && navActive)}
      >
        <Settings />
        <span>Status tags</span>
      </NavLink>

      <div className="text-muted-foreground px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-wider">
        Insights
      </div>
      <button type="button" className={navBtn} disabled title="Coming soon">
        <ChartColumn />
        <span>Reporting</span>
      </button>
      <button type="button" className={navBtn} disabled title="Coming soon">
        <Folder />
        <span>Portfolios</span>
      </button>
      <button type="button" className={navBtn} disabled title="Coming soon">
        <Target />
        <span>Goals</span>
      </button>

      <div className="text-muted-foreground px-2.5 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-wider">
        Projects
      </div>
      {projects.map((p) => {
        const isProjectRoute = loc.pathname.startsWith(`/project/${p.id}`)
        return (
          <div
            key={p.id}
            className={clsx(
              'flex w-full min-w-0 items-center gap-0.5 rounded-md transition-colors duration-120',
              isProjectRoute ? 'bg-accent' : 'hover:bg-accent/85',
            )}
          >
            {user ? (
              <ProjectColorPicker
                uid={user.uid}
                projectId={p.id}
                color={p.color}
                align="start"
                side="right"
              />
            ) : null}
            <Link
              to={`/project/${p.id}/list`}
              className={clsx(
                'min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                isProjectRoute && 'font-medium',
              )}
              aria-current={isProjectRoute ? 'page' : undefined}
              onClick={() => onNavigate?.()}
            >
              {p.name}
            </Link>
          </div>
        )
      })}

      <Separator className="my-3 bg-border" />

      <div className="flex flex-col gap-2.5 pb-2">
        <button
          type="button"
          className={clsx(navBtn, 'text-muted-foreground')}
          onClick={() => void logout()}
        >
          Sign out
        </button>
      </div>
    </ScrollArea>
  )
}

/** Fixed sidebar for md+ viewports */
export function SidebarDesktop() {
  return (
    <aside className="border-border bg-sidebar text-sidebar-foreground sticky top-0 hidden h-screen w-sidebar shrink-0 overflow-hidden border-r md:flex md:flex-col">
      <SidebarContent />
    </aside>
  )
}
