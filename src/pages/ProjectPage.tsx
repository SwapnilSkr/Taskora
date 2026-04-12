import { Timestamp } from 'firebase/firestore'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconChevronDown,
  IconList,
  IconPlus,
  IconSearch,
  IconStar,
} from '../components/icons'
import { ProjectColorPicker } from '../components/ProjectColorPicker'
import { RoutePageFallback } from '@/components/RoutePageFallback'
import { TaskDetailPanel } from '../components/TaskDetailPanel'
import { useAuth } from '../context/AuthContext'
import { useModals } from '../context/ModalContext'
import {
  addSection,
  bulkDeleteTasks,
  bulkSetAssignee,
  bulkSetTasksCompleted,
  createTask,
  deleteProject,
  deleteSection,
  deleteTask,
  renameSection,
  reorderSection,
  subscribeProjects,
  subscribeSections,
  subscribeStatuses,
  subscribeTasks,
  updateProject,
  updateTask,
} from '../services/db'
import type {
  ProjectDoc,
  ProjectView,
  SectionDoc,
  StatusDoc,
  TaskDoc,
} from '../types/models'
import type { GroupMode, SortMode } from '../views/ListView'
import {
  clearPendingMovesConfirmedByServer,
  mergeTasksWithPendingMoves,
  type TaskMovePatch,
} from '../utils/taskDnD'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const OverviewView = lazy(() =>
  import('../views/OverviewView').then((m) => ({ default: m.OverviewView })),
)
const ListView = lazy(() =>
  import('../views/ListView').then((m) => ({ default: m.ListView })),
)
const BoardView = lazy(() =>
  import('../views/BoardView').then((m) => ({ default: m.BoardView })),
)
const TimelineViewTimeline = lazy(() =>
  import('../views/TimelineView').then((m) => ({
    default: m.TimelineViewTimeline,
  })),
)
const DashboardView = lazy(() =>
  import('../views/DashboardView').then((m) => ({ default: m.DashboardView })),
)
const GanttView = lazy(() =>
  import('../views/GanttView').then((m) => ({ default: m.GanttView })),
)
const WorkloadView = lazy(() =>
  import('../views/WorkloadView').then((m) => ({ default: m.WorkloadView })),
)

const VIEWS: { id: ProjectView; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'list', label: 'List' },
  { id: 'board', label: 'Board' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'workload', label: 'Workload' },
]

type StatusFilter = 'all' | string
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
  const [statuses, setStatuses] = useState<StatusDoc[]>([])
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
  const taskMovePendingRef = useRef<Map<string, TaskMovePatch>>(new Map())

  const activeView: ProjectView =
    view && VIEWS.some((v) => v.id === view) ? view : 'list'

  useEffect(() => {
    if (!uid) return
    return subscribeProjects(uid, setProjects)
  }, [uid])

  useEffect(() => {
    if (!projectId || !uid) return
    taskMovePendingRef.current.clear()
    const u = subscribeSections(uid, projectId, setSections)
    const v = subscribeTasks(uid, projectId, (incoming) => {
      clearPendingMovesConfirmedByServer(incoming, taskMovePendingRef.current)
      setTasks(mergeTasksWithPendingMoves(incoming, taskMovePendingRef.current))
    })
    const w = subscribeStatuses(uid, setStatuses)
    return () => {
      u()
      v()
      w()
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- bulk selection is scoped to the current project route
    setSelectedIds(new Set())
  }, [projectId])

  /** Canonical task row from the live snapshot so the detail panel never stays stale after saves. */
  const taskForDetailPanel = useMemo(() => {
    if (!selected) return null
    return tasks.find((x) => x.id === selected.id) ?? selected
  }, [tasks, selected])

  const filteredTasks = useMemo(() => {
    const taskById = new Map(tasks.map((t) => [t.id, t]))

    const matchesPredicate = (t: TaskDoc) => {
      if (filterHideCompleted && t.completed) return false
      if (filterStatus !== 'all' && t.statusId !== filterStatus) return false
      if (filterAssignee === 'me' && t.assigneeId !== uid) return false
      if (filterAssignee === 'unassigned' && t.assigneeId) return false
      return true
    }

    // Include ancestor chain so subtasks that match filters still appear under their parent in List (and Board).
    const visibleIds = new Set<string>()
    for (const t of tasks) {
      if (!matchesPredicate(t)) continue
      let cur: TaskDoc | undefined = t
      while (cur) {
        if (visibleIds.has(cur.id)) break
        visibleIds.add(cur.id)
        cur = cur.parentTaskId
          ? taskById.get(cur.parentTaskId)
          : undefined
      }
    }

    return tasks.filter((t) => visibleIds.has(t.id))
  }, [tasks, filterHideCompleted, filterStatus, filterAssignee, uid])

  const listFilterActive =
    filterStatus !== 'all' ||
    filterAssignee !== 'all' ||
    filterHideCompleted

  /** Subtasks whose parent is not in the filtered set still show as top-level rows (broken links or stale data). */
  const listSurfaceAsRootIds = useMemo(() => {
    const ids = new Set(filteredTasks.map((t) => t.id))
    const surface = new Set<string>()
    for (const t of filteredTasks) {
      if (!t.parentTaskId) continue
      if (!ids.has(t.parentTaskId)) surface.add(t.id)
    }
    return surface
  }, [filteredTasks])

  /** While filters are on, hide section headers that have no visible root tasks in the list. */
  const listSections = useMemo(() => {
    if (!listFilterActive) return sections
    const sectionIds = new Set(
      filteredTasks
        .filter(
          (t) => !t.parentTaskId || listSurfaceAsRootIds.has(t.id),
        )
        .map((t) => t.sectionId),
    )
    return sections.filter((s) => sectionIds.has(s.id))
  }, [sections, filteredTasks, listFilterActive, listSurfaceAsRootIds])

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

  const selectTask = useCallback((task: TaskDoc) => {
    setSelected(task)
  }, [])

  const runOptimisticTaskMove = useCallback(
    (taskId: string, patch: TaskMovePatch) => {
      if (!uid || !projectId) return
      let prevFields: {
        sectionId: string
        parentTaskId: string | null
        sortOrder: number
      } | null = null

      taskMovePendingRef.current.set(taskId, patch)
      setTasks((old) => {
        const prev = old.find((t) => t.id === taskId)
        if (!prev) return old
        prevFields = {
          sectionId: prev.sectionId,
          parentTaskId: prev.parentTaskId,
          sortOrder: prev.sortOrder,
        }
        return old.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
      })

      if (!prevFields) {
        taskMovePendingRef.current.delete(taskId)
        return
      }

      void updateTask(uid, projectId, taskId, patch).catch((err: unknown) => {
        taskMovePendingRef.current.delete(taskId)
        const revert = prevFields!
        setTasks((old) =>
          old.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  sectionId: revert.sectionId,
                  parentTaskId: revert.parentTaskId,
                  sortOrder: revert.sortOrder,
                }
              : t,
          ),
        )
        const msg =
          err instanceof Error ? err.message : 'Could not move this task.'
        void alert({ title: 'Move blocked', message: msg })
      })
    },
    [uid, projectId, alert],
  )

  const runOptimisticSectionReorder = useCallback(
    (sectionId: string, sortOrder: number) => {
      if (!uid || !projectId) return
      let prevSortOrder: number | null = null
      setSections((old) => {
        const prev = old.find((s) => s.id === sectionId)
        if (!prev) return old
        prevSortOrder = prev.sortOrder
        return old.map((s) => (s.id === sectionId ? { ...s, sortOrder } : s))
      })
      void reorderSection(uid, projectId, sectionId, sortOrder).catch((err: unknown) => {
        if (prevSortOrder !== null) {
          const reverted = prevSortOrder
          setSections((old) =>
            old.map((s) => (s.id === sectionId ? { ...s, sortOrder: reverted } : s)),
          )
        }
        const msg = err instanceof Error ? err.message : 'Could not reorder section.'
        void alert({ title: 'Move blocked', message: msg })
      })
    },
    [uid, projectId, alert],
  )

  if (!projectId || !uid || !project) {
    return (
      <div className="p-7 text-muted-foreground">
        Loading project…
      </div>
    )
  }

  const pid = projectId
  const projectDoc = project

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

  function handleStartQuick(taskId: string, ymd: string | null) {
    void updateTask(uid, pid, taskId, {
      startDate: ymd
        ? Timestamp.fromDate(new Date(ymd + 'T12:00:00'))
        : null,
    })
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
    const parent = tasks.find((x) => x.id === parentId)
    if (parent?.parentTaskId) return
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

  async function handleRequestRenameTask(
    taskId: string,
    currentTitle: string,
  ) {
    const title = await prompt({
      title: 'Rename task',
      label: 'Task name',
      defaultValue: currentTitle,
      confirmLabel: 'Save',
    })
    if (!title?.trim()) return
    await updateTask(uid, pid, taskId, { title: title.trim() })
  }

  async function handleRenameCurrentProject() {
    const name = await prompt({
      title: 'Rename project',
      message: 'This name appears in the sidebar, home, and command palette.',
      label: 'Project name',
      defaultValue: projectDoc.name,
      confirmLabel: 'Save',
    })
    if (!name?.trim()) return
    await updateProject(uid, pid, { name: name.trim() })
  }

  async function handleDeleteCurrentProject() {
    const ok = await confirm({
      title: 'Delete project',
      message: `Permanently delete “${projectDoc.name}” and all of its sections, tasks, subtasks, comments, and attachments? This cannot be undone.`,
      confirmLabel: 'Delete project',
      danger: true,
    })
    if (!ok) return
    await deleteProject(uid, pid)
    nav('/home', { replace: true })
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

  /** Anchored below the toolbar; full-width inset on phones, right-aligned from sm+. */
  const filterDropdownClassName =
    'absolute left-3 right-3 top-14 z-50 mt-1.5 max-h-[min(70vh,calc(100vh-6rem))] overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-md sm:left-auto sm:right-6 sm:min-w-[220px] sm:max-w-[min(320px,calc(100vw-1.5rem))]'
  const filterDropdownWideClassName =
    'absolute left-3 right-3 top-14 z-50 mt-1.5 max-h-[min(70vh,calc(100vh-6rem))] overflow-y-auto rounded-lg border border-border bg-card p-1.5 shadow-md sm:left-auto sm:right-4 md:right-[120px] sm:min-w-0 sm:max-w-[min(320px,calc(100vw-1.5rem))] md:min-w-sidebar'

  return (
    <>
      <div className="min-w-0 px-3 pb-0 pt-4 sm:px-5 sm:pt-5 md:px-7">
        <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2.5">
          <IconList className="size-5 shrink-0 text-muted-foreground hover:text-foreground" />
          <ProjectColorPicker
            uid={uid}
            projectId={pid}
            color={project.color}
            align="start"
            side="bottom"
            trigger={
              <button
                type="button"
                className="text-muted-foreground grid size-8 shrink-0 place-items-center rounded-md outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-share/40"
                title="Change project color"
                aria-label="Change project color"
              >
                <span
                  className="h-3 w-3 rounded-[3px] ring-1 ring-border"
                  style={{ background: project.color }}
                />
              </button>
            }
          />
          <h1 className="m-0 min-w-0 flex-1 truncate text-lg font-semibold tracking-tight sm:text-[22px]">
            {project.name}
          </h1>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground [&_svg]:size-5"
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground [&_svg]:size-5"
                title="Project menu"
              >
                <IconChevronDown />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px]">
              <DropdownMenuItem
                className="text-[13px]"
                onSelect={() => void handleRenameCurrentProject()}
              >
                Rename project…
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-[13px]"
                onSelect={() =>
                  void updateProject(uid, pid, { starred: !project.starred })
                }
              >
                {project.starred ? 'Remove star' : 'Star project'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="text-[13px]"
                onSelect={() => void handleDeleteCurrentProject()}
              >
                Delete project…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-3 flex min-w-0 items-center gap-1 overflow-x-auto border-b border-border pb-px [-ms-overflow-style:auto] [scrollbar-width:thin]">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="-mb-px shrink-0 border-b-2 border-transparent px-3 pb-3 pt-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-white data-[active=true]:text-foreground"
              data-active={activeView === v.id ? 'true' : 'false'}
              onClick={() => goView(v.id)}
            >
              {v.label}
            </button>
          ))}
          <button
            type="button"
            className="-mb-px shrink-0 border-b-2 border-transparent px-3 pb-3 pt-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
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
        <div
          className="relative flex min-w-0 flex-wrap items-center gap-2 px-3 py-3 sm:px-5 md:px-7 md:py-3.5"
          ref={popRef}
        >
          <Button
            type="button"
            variant="outline"
            className="rounded-full text-[13px] font-semibold"
            onClick={() => {
              const s = sections[0]
              if (s) void onAddTask(s.id)
            }}
          >
            <IconPlus width={16} height={16} />
            Add task
            <IconChevronDown width={14} height={14} />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5">
            {activeView === 'list' ? (
              <button
                type="button"
                className="rounded-pill border border-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[open=true]:border-border data-[open=true]:bg-hover-surface data-[open=true]:text-foreground"
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
              className="rounded-pill border border-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[open=true]:border-border data-[open=true]:bg-hover-surface data-[open=true]:text-foreground"
              data-open={filterOpen === 'filter' ? 'true' : 'false'}
              onClick={() =>
                setFilterOpen((x) => (x === 'filter' ? null : 'filter'))
              }
            >
              Filter
            </button>
            <button
              type="button"
              className="rounded-pill border border-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[open=true]:border-border data-[open=true]:bg-hover-surface data-[open=true]:text-foreground"
              data-open={filterOpen === 'sort' ? 'true' : 'false'}
              onClick={() => setFilterOpen((x) => (x === 'sort' ? null : 'sort'))}
            >
              Sort
            </button>
            <button
              type="button"
              className="rounded-pill border border-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[open=true]:border-border data-[open=true]:bg-hover-surface data-[open=true]:text-foreground"
              data-open={filterOpen === 'group' ? 'true' : 'false'}
              onClick={() => setFilterOpen((x) => (x === 'group' ? null : 'group'))}
            >
              Group
            </button>
            <button
              type="button"
              className="rounded-pill border border-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[open=true]:border-border data-[open=true]:bg-hover-surface data-[open=true]:text-foreground"
              data-open={filterOpen === 'options' ? 'true' : 'false'}
              onClick={() =>
                setFilterOpen((x) => (x === 'options' ? null : 'options'))
              }
            >
              Options
            </button>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-[18px]"
              title="Search (⌘K)"
              onClick={() =>
                window.dispatchEvent(new Event('taskora:open-search'))
              }
            >
              <IconSearch />
            </button>
          </div>
          {filterOpen === 'sort' ? (
            <div className={filterDropdownClassName}>
              {(
                [
                  ['sortOrder', 'Manual / list order'],
                  ['dueDate', 'Due date'],
                  ['priority', 'Priority'],
                  ['name', 'Name'],
                ] as const
              ).map(([id, lab]) => (
                <button
                  key={id}
                  type="button"
                  className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-accent"
                  onClick={() => {
                    setSort(id)
                    setFilterOpen(null)
                  }}
                >
                  {lab}
                </button>
              ))}
            </div>
          ) : null}
          {filterOpen === 'group' ? (
            <div className={filterDropdownClassName}>
              {(
                [
                  ['section', 'Section'],
                  ['assignee', 'Assignee'],
                  ['due', 'Due date'],
                  ['status', 'Status'],
                  ['priority', 'Priority'],
                ] as const
              ).map(([id, lab]) => (
                <button
                  key={id}
                  type="button"
                  className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-accent"
                  onClick={() => {
                    setGroup(id)
                    setFilterOpen(null)
                  }}
                >
                  {lab}
                </button>
              ))}
            </div>
          ) : null}
          {filterOpen === 'filter' ? (
            <div className={filterDropdownWideClassName}>
              <div className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Status
              </div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground data-[active=true]:bg-accent data-[active=true]:font-semibold"
                data-active={filterStatus === 'all' ? 'true' : 'false'}
                onClick={() => {
                  setFilterStatus('all')
                  setFilterOpen(null)
                }}
              >
                All statuses
              </button>
              {statuses.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground data-[active=true]:bg-accent data-[active=true]:font-semibold"
                  data-active={filterStatus === s.id ? 'true' : 'false'}
                  onClick={() => {
                    setFilterStatus(s.id)
                    setFilterOpen(null)
                  }}
                >
                  {s.name}
                </button>
              ))}
              <div className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Assignee
              </div>
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
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground data-[active=true]:bg-accent data-[active=true]:font-semibold"
                  data-active={filterAssignee === id ? 'true' : 'false'}
                  onClick={() => {
                    setFilterAssignee(id)
                    setFilterOpen(null)
                  }}
                >
                  {lab}
                </button>
              ))}
              <div className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Visibility
              </div>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground data-[active=true]:bg-accent data-[active=true]:font-semibold"
                data-active={filterHideCompleted ? 'true' : 'false'}
                onClick={() => {
                  setFilterHideCompleted((x) => !x)
                  setFilterOpen(null)
                }}
              >
                Hide completed
                <span style={{ opacity: 0.7 }}>{filterHideCompleted ? 'On' : 'Off'}</span>
              </button>
            </div>
          ) : null}
          {filterOpen === 'options' ? (
            <div className={filterDropdownClassName}>
              <button
                type="button"
                className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-accent"
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
                className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-accent"
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
        <div className="mx-3 mb-3 flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-[13px] sm:mx-5 md:mx-7">
          <span className="mr-1 font-bold">{selectedIds.size} selected</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-xs font-semibold"
            onClick={() => void runBulkComplete(true)}
          >
            Mark complete
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-xs font-semibold"
            onClick={() => void runBulkComplete(false)}
          >
            Mark incomplete
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-xs font-semibold"
            onClick={() => void runBulkAssign(true)}
          >
            Assign to me
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-xs font-semibold"
            onClick={() => void runBulkAssign(false)}
          >
            Unassign
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="rounded-full text-xs font-semibold"
            onClick={() => void runBulkDelete()}
          >
            Delete…
          </Button>
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-xs font-semibold"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </Button>
        </div>
      ) : null}

      <Suspense fallback={<RoutePageFallback />}>
        {activeView === 'overview' ? (
          <OverviewView project={project} tasks={tasks} sections={sections} />
        ) : null}
        {activeView === 'list' ? (
          <ListView
            sections={listSections}
            statuses={statuses}
            tasks={filteredTasks}
            tasksForMove={tasks}
            group={group}
            sort={sort}
            uid={uid}
            multiSelectMode={multiSelectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSetManySelected={setManySelected}
            onTaskClick={selectTask}
            onStatusChange={(taskId, statusId) => {
              const s = statuses.find((x) => x.id === statusId)
              void updateTask(uid, pid, taskId, {
                statusId,
                completed: s?.isCompleted ?? false,
              })
            }}
            onAddTask={(sid) => void onAddTask(sid)}
            onAssign={handleAssignQuick}
            onStartChange={handleStartQuick}
            onDueChange={handleDueQuick}
            onPriorityChange={handlePriorityQuick}
            onAddSubtask={(parentId, sectionId, title) =>
              void handleAddSubtaskQuick(parentId, sectionId, title)
            }
            onDeleteTask={(id) => void handleDeleteTaskRow(id)}
            onRequestRenameTask={(taskId, title) =>
              void handleRequestRenameTask(taskId, title)
            }
            onRequestRenameSection={(sid, name) =>
              void handleRequestRenameSection(sid, name)
            }
            onDeleteSection={(sid) => void handleDeleteSection(sid)}
            onMoveTask={runOptimisticTaskMove}
            onMoveSection={runOptimisticSectionReorder}
            surfaceAsRootIds={listSurfaceAsRootIds}
          />
        ) : null}
        {activeView === 'board' ? (
          <BoardView
            sections={sections}
            statuses={statuses}
            tasks={filteredTasks}
            tasksForMove={tasks}
            onTaskClick={selectTask}
            onAddSection={() => void onAddSection()}
            onMoveTask={runOptimisticTaskMove}
            onMoveSection={runOptimisticSectionReorder}
            onAddTask={(sid) => void onAddTask(sid)}
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
        {activeView === 'timeline' ? (
          <TimelineViewTimeline
            tasks={filteredTasks}
            sections={sections}
            onTaskClick={selectTask}
          />
        ) : null}
        {activeView === 'dashboard' ? (
          <DashboardView tasks={filteredTasks} statuses={statuses} />
        ) : null}
        {activeView === 'gantt' ? (
          <GanttView tasks={filteredTasks} onTaskClick={selectTask} />
        ) : null}
        {activeView === 'workload' ? (
          <WorkloadView tasks={filteredTasks} uid={uid} />
        ) : null}
      </Suspense>

      {activeView === 'list' ? (
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground mx-7 mb-8 mt-[18px] justify-start gap-1.5 text-[13px] font-semibold hover:text-foreground"
          onClick={() => void onAddSection()}
        >
          <IconPlus width={16} height={16} />
          Add section
        </Button>
      ) : null}

      {selected && taskForDetailPanel ? (
        <TaskDetailPanel
          uid={uid}
          projectId={pid}
          task={taskForDetailPanel}
          allTasks={tasks}
          presentation={activeView === 'board' ? 'dialog' : 'sheet'}
          onClose={() => setSelected(null)}
          onSaved={() => {
            /* Panel reads `taskForDetailPanel` from the live `tasks` subscription. */
          }}
          onOpenTask={selectTask}
        />
      ) : null}
    </>
  )
}
