import { Timestamp } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useModals } from '../context/ModalContext'
import {
  addSection,
  bulkDeleteTasks,
  bulkSetAssignee,
  bulkSetTasksCompleted,
  createTask,
  deleteSection,
  deleteTask,
  renameSection,
  subscribeProjects,
  subscribeSections,
  subscribeTasks,
  updateProject,
  updateTask,
} from '../services/db'
import type {
  ProjectDoc,
  ProjectView,
  SectionDoc,
  TaskDoc,
} from '../types/models'
import { BoardView } from '../views/BoardView'
import { DashboardView } from '../views/DashboardView'
import { GanttView } from '../views/GanttView'
import {
  ListView,
  type GroupMode,
  type SortMode,
} from '../views/ListView'
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

type StatusFilter = 'all' | TaskDoc['status']
type AssigneeFilter = 'all' | 'me' | 'unassigned'

export function ProjectPage() {
  const { projectId, view } = useParams<{
    projectId: string
    view: ProjectView | undefined
  }>()
  const nav = useNavigate()
  const { user } = useAuth()
  const { confirm, prompt, alert } = useModals()
  const uid = user?.uid ?? ''

  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const [sections, setSections] = useState<SectionDoc[]>([])
  const [tasks, setTasks] = useState<TaskDoc[]>([])
  const [selected, setSelected] = useState<TaskDoc | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [group, setGroup] = useState<GroupMode>('section')
  const [sort, setSort] = useState<SortMode>('sortOrder')
  const [filterOpen, setFilterOpen] = useState<
    'filter' | 'sort' | 'group' | 'options' | null
  >(null)
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
  const [filterAssignee, setFilterAssignee] = useState<AssigneeFilter>('all')
  const [filterHideCompleted, setFilterHideCompleted] = useState(false)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
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

  const lastProjectId = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!projectId) return
    if (lastProjectId.current === projectId) return
    lastProjectId.current = projectId
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear bulk selection when opening another project
    setSelectedIds(new Set())
  }, [projectId])

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterHideCompleted && t.completed) return false
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterAssignee === 'me' && t.assigneeId !== uid) return false
      if (filterAssignee === 'unassigned' && t.assigneeId) return false
      return true
    })
  }, [tasks, filterHideCompleted, filterStatus, filterAssignee, uid])

  const toggleSelect = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  const setManySelected = useCallback((taskIds: string[], selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of taskIds) {
        if (selected) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  if (!projectId || !uid || !project) {
    return (
      <div style={{ padding: 28, color: 'var(--text-muted)' }}>
        Loading project…
      </div>
    )
  }

  const pid = projectId

  async function onAddTask(sectionId: string) {
    const title = await prompt({
      title: 'New task',
      message: 'Name this task — it will appear in the selected section.',
      label: 'Task name',
      defaultValue: 'New task',
      placeholder: 'e.g. Ship analytics dashboard',
      confirmLabel: 'Create',
    })
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
    const name = await prompt({
      title: 'New section',
      message: 'Sections group tasks in the list and board.',
      label: 'Section name',
      defaultValue: 'New section',
      confirmLabel: 'Add section',
    })
    if (!name?.trim()) return
    await addSection(uid, pid, name.trim(), sections.length)
  }

  async function handleRequestRenameSection(
    sectionId: string,
    currentName: string,
  ) {
    const name = await prompt({
      title: 'Rename section',
      label: 'Section name',
      defaultValue: currentName,
      confirmLabel: 'Save',
    })
    if (!name?.trim()) return
    await renameSection(uid, pid, sectionId, name.trim())
  }

  async function handleDeleteSection(sectionId: string) {
    const ok = await confirm({
      title: 'Delete section',
      message:
        'All tasks in this section move to the next section in the list. If this is the only section, deletion is blocked.',
      confirmLabel: 'Delete section',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteSection(uid, pid, sectionId, sections, tasks)
    } catch (err) {
      await alert({
        title: 'Cannot delete section',
        message:
          err instanceof Error ? err.message : 'Something went wrong.',
      })
    }
  }

  function handleAssignQuick(taskId: string, assigneeId: string | null) {
    void updateTask(uid, pid, taskId, { assigneeId })
  }

  function handleDueQuick(taskId: string, ymd: string | null) {
    void updateTask(uid, pid, taskId, {
      dueDate: ymd
        ? Timestamp.fromDate(new Date(ymd + 'T12:00:00'))
        : null,
    })
  }

  function handlePriorityQuick(taskId: string, priority: TaskDoc['priority']) {
    void updateTask(uid, pid, taskId, { priority })
  }

  async function handleAddSubtaskQuick(
    parentId: string,
    sectionId: string,
    title: string,
  ) {
    const siblings = tasks.filter((t) => t.parentTaskId === parentId)
    const sortOrder =
      siblings.length > 0
        ? Math.max(...siblings.map((s) => s.sortOrder)) + 1
        : 0
    await createTask(uid, pid, {
      sectionId,
      title: title.trim(),
      parentTaskId: parentId,
      sortOrder,
    })
  }

  async function handleDeleteTaskRow(taskId: string) {
    const ok = await confirm({
      title: 'Delete task',
      message:
        'Delete this task, its subtasks, and related activity? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    await deleteTask(uid, pid, taskId)
    setSelected((s) => (s?.id === taskId ? null : s))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
  }

  function goView(v: ProjectView) {
    if (v !== activeView) {
      setSelectedIds(new Set())
      if (v !== 'list') setMultiSelectMode(false)
    }
    nav(`/project/${pid}/${v}`)
  }

  async function runBulkDelete() {
    const n = selectedIds.size
    if (n === 0) return
    const ok = await confirm({
      title: 'Delete tasks',
      message: `Permanently delete ${n} task(s) and their subtasks, comments, and file links? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    await bulkDeleteTasks(uid, pid, [...selectedIds], tasks)
    setSelectedIds(new Set())
    setSelected(null)
  }

  async function runBulkComplete(completed: boolean) {
    if (selectedIds.size === 0) return
    await bulkSetTasksCompleted(uid, pid, [...selectedIds], completed)
  }

  async function runBulkAssign(toMe: boolean) {
    if (selectedIds.size === 0) return
    await bulkSetAssignee(uid, pid, [...selectedIds], toMe ? uid : null)
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
          <button
            type="button"
            className="tab"
            title="More views"
            onClick={() =>
              void alert({
                title: 'More views',
                message:
                  'Custom views and saved filters are on the roadmap. For now use List, Board, Timeline, Gantt, Dashboard, and Workload.',
              })
            }
          >
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
            {activeView === 'list' ? (
              <button
                type="button"
                className="chip-btn"
                data-open={multiSelectMode ? 'true' : 'false'}
                onClick={() => {
                  setMultiSelectMode((v) => {
                    if (v) setSelectedIds(new Set())
                    return !v
                  })
                }}
              >
                Select tasks
              </button>
            ) : null}
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
            <button
              type="button"
              className="chip-btn"
              data-open={filterOpen === 'options' ? 'true' : 'false'}
              onClick={() =>
                setFilterOpen((x) => (x === 'options' ? null : 'options'))
              }
            >
              Options
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Search (⌘K)"
              onClick={() =>
                window.dispatchEvent(new Event('taskora:open-search'))
              }
            >
              <IconSearch />
            </button>
          </div>
          {filterOpen === 'sort' ? (
            <div
              className="dropdown"
              style={{ position: 'absolute', right: 24, top: 56 }}
            >
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
            <div
              className="dropdown"
              style={{ position: 'absolute', right: 24, top: 56 }}
            >
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
            <div
              className="dropdown"
              style={{
                position: 'absolute',
                right: 120,
                top: 56,
                minWidth: 260,
              }}
            >
              <div className="filter-dropdown-section">Status</div>
              {(
                [
                  ['all', 'All statuses'],
                  ['not_started', 'Not started'],
                  ['in_progress', 'In progress'],
                  ['completed', 'Completed'],
                  ['blocked', 'Blocked'],
                ] as const
              ).map(([id, lab]) => (
                <button
                  key={id}
                  type="button"
                  className="filter-option"
                  data-active={filterStatus === id ? 'true' : 'false'}
                  onClick={() => setFilterStatus(id)}
                >
                  {lab}
                </button>
              ))}
              <div className="filter-dropdown-section">Assignee</div>
              {(
                [
                  ['all', 'Everyone'],
                  ['me', 'Assigned to me'],
                  ['unassigned', 'Unassigned'],
                ] as const
              ).map(([id, lab]) => (
                <button
                  key={id}
                  type="button"
                  className="filter-option"
                  data-active={filterAssignee === id ? 'true' : 'false'}
                  onClick={() => setFilterAssignee(id)}
                >
                  {lab}
                </button>
              ))}
              <div className="filter-dropdown-section">Visibility</div>
              <button
                type="button"
                className="filter-option"
                data-active={filterHideCompleted ? 'true' : 'false'}
                onClick={() => setFilterHideCompleted((x) => !x)}
              >
                Hide completed
                <span style={{ opacity: 0.7 }}>{filterHideCompleted ? 'On' : 'Off'}</span>
              </button>
            </div>
          ) : null}
          {filterOpen === 'options' ? (
            <div
              className="dropdown"
              style={{ position: 'absolute', right: 24, top: 56, minWidth: 240 }}
            >
              <button
                type="button"
                onClick={() => {
                  setFilterOpen(null)
                  void alert({
                    title: 'Project shortcuts',
                    message:
                      '⌘K (Ctrl+K): Search and jump. In List: turn on “Select tasks” for bulk actions. Otherwise use the Done column and inline assignee, due date, and priority — no need to open details.',
                  })
                }}
              >
                Keyboard shortcuts
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterOpen(null)
                  void alert({
                    title: 'About this project',
                    message: `${project.name}: data is stored in your Firebase project under your account. Export and automations can be added later.`,
                  })
                }}
              >
                About this project
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeView === 'list' && multiSelectMode && selectedIds.size > 0 ? (
        <div className="bulk-action-bar">
          <span className="bulk-count">{selectedIds.size} selected</span>
          <button type="button" onClick={() => void runBulkComplete(true)}>
            Mark complete
          </button>
          <button type="button" onClick={() => void runBulkComplete(false)}>
            Mark incomplete
          </button>
          <button type="button" onClick={() => void runBulkAssign(true)}>
            Assign to me
          </button>
          <button type="button" onClick={() => void runBulkAssign(false)}>
            Unassign
          </button>
          <button
            type="button"
            className="bulk-danger"
            onClick={() => void runBulkDelete()}
          >
            Delete…
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
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
          multiSelectMode={multiSelectMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSetManySelected={setManySelected}
          onTaskClick={setSelected}
          onToggleComplete={(t) =>
            void updateTask(uid, pid, t.id, {
              completed: !t.completed,
              status: !t.completed ? 'completed' : 'not_started',
            })
          }
          onAddTask={(sid) => void onAddTask(sid)}
          onAssign={handleAssignQuick}
          onDueChange={handleDueQuick}
          onPriorityChange={handlePriorityQuick}
          onAddSubtask={(parentId, sectionId, title) =>
            void handleAddSubtaskQuick(parentId, sectionId, title)
          }
          onDeleteTask={(id) => void handleDeleteTaskRow(id)}
          onRequestRenameSection={(sid, name) =>
            void handleRequestRenameSection(sid, name)
          }
          onDeleteSection={(sid) => void handleDeleteSection(sid)}
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
        <TimelineViewTimeline
          tasks={filteredTasks}
          sections={sections}
          onTaskClick={setSelected}
        />
      ) : null}
      {activeView === 'dashboard' ? (
        <DashboardView tasks={filteredTasks} />
      ) : null}
      {activeView === 'gantt' ? (
        <GanttView tasks={filteredTasks} onTaskClick={setSelected} />
      ) : null}
      {activeView === 'workload' ? (
        <WorkloadView tasks={filteredTasks} uid={uid} />
      ) : null}

      <button
        type="button"
        className="add-section-btn"
        onClick={() => void onAddSection()}
      >
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
