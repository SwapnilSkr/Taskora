import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconChevronDown,
  IconList,
  IconPlus,
  IconSearch,
  IconStar,
} from '../components/icons'
import '../components/layout/layout.css'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { useAuth } from '../context/AuthContext'
import {
  addSection,
  createTask,
  subscribeProjects,
  subscribeSections,
  subscribeTasks,
  updateProject,
  updateTask,
} from '../services/db'
import type { ProjectDoc, ProjectView, SectionDoc, TaskDoc } from '../types/models'
import { BoardView } from '../views/BoardView'
import {
  ListView,
  type GroupMode,
  type SortMode,
} from '../views/ListView'
import { DashboardView } from '../views/DashboardView'
import { GanttView } from '../views/GanttView'
import { OverviewView } from '../views/OverviewView'
import { TimelineViewTimeline } from '../views/TimelineView'
import { WorkloadView } from '../views/WorkloadView'

const VIEWS: { id: ProjectView; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'list', label: 'List' },
  { id: 'board', label: 'Board' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'workload', label: 'Workload' },
]

export function ProjectPage() {
  const { projectId, view } = useParams<{
    projectId: string
    view: ProjectView | undefined
  }>()
  const nav = useNavigate()
  const { user } = useAuth()
  const uid = user?.uid ?? ''

  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const [sections, setSections] = useState<SectionDoc[]>([])
  const [tasks, setTasks] = useState<TaskDoc[]>([])
  const [selected, setSelected] = useState<TaskDoc | null>(null)
  const [group, setGroup] = useState<GroupMode>('section')
  const [sort, setSort] = useState<SortMode>('sortOrder')
  const [filterOpen, setFilterOpen] = useState<'filter' | 'sort' | 'group' | null>(
    null,
  )
  const popRef = useRef<HTMLDivElement | null>(null)

  const activeView: ProjectView =
    view && VIEWS.some((v) => v.id === view) ? view : 'list'

  useEffect(() => {
    if (!uid) return
    return subscribeProjects(uid, setProjects)
  }, [uid])

  useEffect(() => {
    if (!projectId || !uid) return
    const u = subscribeSections(uid, projectId, setSections)
    const v = subscribeTasks(uid, projectId, setTasks)
    return () => {
      u()
      v()
    }
  }, [uid, projectId])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!popRef.current) return
      if (!popRef.current.contains(e.target as Node)) setFilterOpen(null)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  )

  useEffect(() => {
    if (!projectId || !uid) return
    if (projects.length > 0 && !project) nav('/home', { replace: true })
  }, [project, projectId, projects, nav, uid])

  if (!projectId || !uid || !project) {
    return (
      <div style={{ padding: 28, color: 'var(--text-muted)' }}>
        Loading project…
      </div>
    )
  }

  const pid = projectId

  const filteredTasks = tasks

  async function onAddTask(sectionId: string) {
    const title = window.prompt('Task name', 'New task')
    if (!title?.trim()) return
    const inSec = tasks.filter((t) => t.sectionId === sectionId && !t.parentTaskId)
    const sortOrder =
      inSec.length > 0 ? Math.max(...inSec.map((t) => t.sortOrder)) + 1 : 0
    await createTask(uid, pid, {
      sectionId,
      title: title.trim(),
      sortOrder,
    })
  }

  async function onAddSection() {
    const name = window.prompt('Section name', 'New section')
    if (!name?.trim()) return
    await addSection(uid, pid, name.trim(), sections.length)
  }

  function goView(v: ProjectView) {
    nav(`/project/${pid}/${v}`)
  }

  return (
    <>
      <div className="project-header">
        <div className="project-title-row">
          <IconList className="icon-inline" />
          <span
            className="project-dot"
            style={{ background: project.color, width: 12, height: 12 }}
          />
          <h1>{project.name}</h1>
          <button
            type="button"
            className="icon-inline"
            title="Star project"
            onClick={() =>
              void updateProject(uid, pid, { starred: !project.starred })
            }
          >
            <IconStar
              style={{
                color: project.starred ? '#f5d76e' : undefined,
                fill: project.starred ? 'rgba(245,215,110,0.18)' : 'none',
              }}
            />
          </button>
          <button type="button" className="icon-inline" title="Project menu">
            <IconChevronDown />
          </button>
        </div>

        <div className="tabs-row">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="tab"
              data-active={activeView === v.id ? 'true' : 'false'}
              onClick={() => goView(v.id)}
            >
              {v.label}
            </button>
          ))}
          <button type="button" className="tab" title="Add tab">
            <IconPlus width={16} height={16} />
          </button>
        </div>
      </div>

      {activeView === 'list' || activeView === 'board' ? (
        <div className="toolbar" ref={popRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn-add-task"
            onClick={() => {
              const s = sections[0]
              if (s) void onAddTask(s.id)
            }}
          >
            <IconPlus width={16} height={16} />
            Add task
            <IconChevronDown width={14} height={14} />
          </button>
          <div className="toolbar-spacer" />
          <div className="toolbar-cluster">
            <button
              type="button"
              className="chip-btn"
              data-open={filterOpen === 'filter' ? 'true' : 'false'}
              onClick={() =>
                setFilterOpen((x) => (x === 'filter' ? null : 'filter'))
              }
            >
              Filter
            </button>
            <button
              type="button"
              className="chip-btn"
              data-open={filterOpen === 'sort' ? 'true' : 'false'}
              onClick={() => setFilterOpen((x) => (x === 'sort' ? null : 'sort'))}
            >
              Sort
            </button>
            <button
              type="button"
              className="chip-btn"
              data-open={filterOpen === 'group' ? 'true' : 'false'}
              onClick={() => setFilterOpen((x) => (x === 'group' ? null : 'group'))}
            >
              Group
            </button>
            <button type="button" className="chip-btn">
              Options
            </button>
            <button type="button" className="icon-btn" title="Search in project">
              <IconSearch />
            </button>
          </div>
          {filterOpen === 'sort' ? (
            <div className="dropdown" style={{ position: 'absolute', right: 24, top: 152 }}>
              {(
                [
                  ['sortOrder', 'Manual / list order'],
                  ['dueDate', 'Due date'],
                  ['priority', 'Priority'],
                  ['name', 'Name'],
                ] as const
              ).map(([id, lab]) => (
                <button key={id} type="button" onClick={() => setSort(id)}>
                  {lab}
                </button>
              ))}
            </div>
          ) : null}
          {filterOpen === 'group' ? (
            <div className="dropdown" style={{ position: 'absolute', right: 24, top: 152 }}>
              {(
                [
                  ['section', 'Section'],
                  ['assignee', 'Assignee'],
                  ['due', 'Due date'],
                  ['status', 'Status'],
                  ['priority', 'Priority'],
                ] as const
              ).map(([id, lab]) => (
                <button key={id} type="button" onClick={() => setGroup(id)}>
                  {lab}
                </button>
              ))}
            </div>
          ) : null}
          {filterOpen === 'filter' ? (
            <div className="dropdown" style={{ position: 'absolute', right: 120, top: 152, minWidth: 260 }}>
              <div style={{ padding: '6px 8px', color: 'var(--text-muted)', fontSize: 12 }}>
                Pro-style filters (status, assignee, tags) apply on top of the current view. Use List and mark tasks complete to see them roll up in Dashboard.
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeView === 'overview' ? (
        <OverviewView project={project} tasks={tasks} sections={sections} />
      ) : null}
      {activeView === 'list' ? (
        <ListView
          sections={sections}
          tasks={filteredTasks}
          group={group}
          sort={sort}
          uid={uid}
          onTaskClick={setSelected}
          onToggleComplete={(t) =>
            void updateTask(uid, pid, t.id, {
              completed: !t.completed,
              status: !t.completed ? 'completed' : 'not_started',
            })
          }
          onAddTask={(sid) => void onAddTask(sid)}
        />
      ) : null}
      {activeView === 'board' ? (
        <BoardView
          uid={uid}
          projectId={pid}
          sections={sections}
          tasks={filteredTasks}
          onTaskClick={setSelected}
        />
      ) : null}
      {activeView === 'timeline' ? (
        <TimelineViewTimeline tasks={filteredTasks} sections={sections} />
      ) : null}
      {activeView === 'dashboard' ? (
        <DashboardView tasks={filteredTasks} />
      ) : null}
      {activeView === 'gantt' ? (
        <GanttView tasks={filteredTasks} />
      ) : null}
      {activeView === 'workload' ? (
        <WorkloadView tasks={filteredTasks} uid={uid} />
      ) : null}

      <button type="button" className="add-section-btn" onClick={() => void onAddSection()}>
        <IconPlus width={16} height={16} />
        Add section
      </button>

      {selected ? (
        <TaskDetailPanel
          uid={uid}
          projectId={pid}
          task={selected}
          allTasks={tasks}
          onClose={() => setSelected(null)}
          onSaved={() => setSelected({ ...selected })}
        />
      ) : null}
    </>
  )
}
