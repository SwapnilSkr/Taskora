import {
  closestCorners,
  pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core'
import type { SectionDoc, TaskDoc } from '../types/models'

/**
 * Shared collision detection for list and board DnD.
 * Priority: gap:task: (exact insert position) > appsub: (subtask tail)
 *           > append: (column tail) > sec: (column chrome fallback).
 * Resolvers handle same-section reorder vs cross-section move logic.
 */
export function taskDropCollisionDetectionForTasks(): CollisionDetection {
  return (args) => {
    const activeId = String(args.active.id)
    const isDraggingSection = activeId.startsWith('drag:sec:')

    if (isDraggingSection) {
      const isTarget = (id: string | number) => String(id).startsWith('gap:sec:')
      const hits = pointerWithin(args).filter((x) => isTarget(x.id))
      if (hits.length > 0) return [hits[0]]
      return closestCorners(args).filter((x) => isTarget(x.id))
    }

    const isDropTarget = (id: string | number) => {
      const s = String(id)
      return (
        s.startsWith('sec:') ||
        s.startsWith('gap:task:') ||
        s.startsWith('append:') ||
        s.startsWith('appsub:')
      )
    }

    // Priority: gap:task: (exact position) > appsub: (subtask tail) > append: (col tail) > sec: (fallback)
    // No sibling filtering here — resolvers handle same-section vs cross-section logic.
    const preferBestHit = (
      hits: ReturnType<typeof pointerWithin>,
    ): ReturnType<typeof pointerWithin> => {
      if (hits.length === 0) return []
      const gapHit = hits.find((x) => String(x.id).startsWith('gap:task:'))
      if (gapHit) return [gapHit]
      const appSubHit = hits.find((x) => String(x.id).startsWith('appsub:'))
      if (appSubHit) return [appSubHit]
      const appendHit = hits.find((x) => String(x.id).startsWith('append:'))
      if (appendHit) return [appendHit]
      return [hits[0]]
    }

    const pointerHits = pointerWithin(args).filter((x) => isDropTarget(x.id))
    const fromPointer = preferBestHit(pointerHits)
    if (fromPointer.length > 0) return fromPointer
    const cornerHits = closestCorners(args).filter((x) => isDropTarget(x.id))
    return preferBestHit(cornerHits)
  }
}

// ─── drag / drop ID helpers ─────────────────────────────────────────────────

/** dnd-kit active id: `drag:<taskId>` */
export function taskDragId(taskId: string) {
  return `drag:${taskId}`
}

export function parseTaskDragId(activeId: string | number | undefined): string | null {
  const s = String(activeId ?? '')
  return s.startsWith('drag:') && !s.startsWith('drag:sec:') ? s.slice(5) : null
}

/** Section drag id: `drag:sec:<sectionId>` */
export function sectionDragId(sectionId: string) {
  return `drag:sec:${sectionId}`
}

export function parseSectionDragId(activeId: string | number | undefined): string | null {
  const s = String(activeId ?? '')
  return s.startsWith('drag:sec:') ? s.slice(9) : null
}

/** Section column / header drop: `sec:<sectionId>` */
export function sectionDropId(sectionId: string) {
  return `sec:${sectionId}`
}

/** Gap between tasks / subtasks (reorder before this task): `gap:task:<taskId>` */
export function gapTaskDropId(taskId: string) {
  return `gap:task:${taskId}`
}

/**
 * Kanban column footer — append as the last root task in this section (`append:<sectionId>`).
 * Same-section roots can move to the bottom; cross-section moves append; subtasks promote here.
 */
export function appendLastRootDropId(sectionId: string) {
  return `append:${sectionId}`
}

/** After the last subtask under this root (`appsub:<parentTaskId>`). */
export function appendLastSubtaskDropId(parentTaskId: string) {
  return `appsub:${parentTaskId}`
}

/** Gap between sections (reorder before this section): `gap:sec:<sectionId>` */
export function gapSectionDropId(sectionId: string) {
  return `gap:sec:${sectionId}`
}

// ─── patch types ────────────────────────────────────────────────────────────

export type TaskMovePatch = {
  sectionId: string
  parentTaskId: string | null
  sortOrder: number
}

export type SectionMovePatch = {
  sortOrder: number
}

// ─── drop resolvers ─────────────────────────────────────────────────────────

/**
 * Computes Firestore patch for dropping `activeTaskId` onto `overId`.
 * - `sec:` — column chrome: move root to another section or promote subtask (append in target).
 * - `append:` — kanban footer lane: same as promote/cross-move, and move root to **end** of column.
 */
export function resolveTaskDrop(
  tasks: TaskDoc[],
  activeTaskId: string,
  overId: string | null,
): TaskMovePatch | null {
  if (!overId) return null
  const isAppend = overId.startsWith('append:')
  const isSec = overId.startsWith('sec:')
  if (!isAppend && !isSec) return null

  const sectionId = isAppend ? overId.slice(7) : overId.slice(4)
  const dragged = tasks.find((t) => t.id === activeTaskId)
  if (!dragged) return null

  if (
    isAppend &&
    !dragged.parentTaskId &&
    dragged.sectionId === sectionId
  ) {
    const orderedRoots = tasks
      .filter((t) => !t.parentTaskId && t.sectionId === sectionId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    if (
      orderedRoots.length > 0 &&
      orderedRoots[orderedRoots.length - 1].id === activeTaskId
    ) {
      return null
    }
  }

  const rootsExcludingDragged = tasks.filter(
    (t) =>
      !t.parentTaskId &&
      t.sectionId === sectionId &&
      t.id !== activeTaskId,
  )
  const nextSort =
    rootsExcludingDragged.length > 0
      ? Math.max(...rootsExcludingDragged.map((t) => t.sortOrder)) + 1
      : 0

  if (dragged.parentTaskId) {
    return { sectionId, parentTaskId: null, sortOrder: nextSort }
  }

  if (isAppend) {
    return { sectionId, parentTaskId: null, sortOrder: nextSort }
  }

  if (dragged.sectionId === sectionId) return null
  return { sectionId, parentTaskId: null, sortOrder: nextSort }
}

/**
 * Computes a sortOrder patch for reordering `activeTaskId` before the task
 * referenced by `gapId` (`gap:task:<taskId>`). Only fires between siblings.
 * Returns null when no change is needed.
 */
export function resolveTaskReorder(
  tasks: TaskDoc[],
  activeTaskId: string,
  gapId: string,
): TaskMovePatch | null {
  if (!gapId.startsWith('gap:task:')) return null
  const targetTaskId = gapId.slice(9) // 'gap:task:'.length === 9
  if (targetTaskId === activeTaskId) return null

  const dragged = tasks.find((t) => t.id === activeTaskId)
  const target = tasks.find((t) => t.id === targetTaskId)
  if (!dragged || !target) return null

  // Must be siblings: same parentTaskId and sectionId
  if (dragged.parentTaskId !== target.parentTaskId) return null
  if (dragged.sectionId !== target.sectionId) return null

  // Full sorted sibling list (including dragged) for no-op check
  const allSiblings = tasks
    .filter(
      (t) =>
        t.parentTaskId === dragged.parentTaskId && t.sectionId === dragged.sectionId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const draggedPos = allSiblings.findIndex((t) => t.id === activeTaskId)
  const targetPos = allSiblings.findIndex((t) => t.id === targetTaskId)
  if (draggedPos < 0 || targetPos < 0) return null

  // If dragged is already immediately before target, it's a no-op
  if (draggedPos === targetPos - 1) return null

  // Compute insertion point among siblings without the dragged task
  const withoutDragged = allSiblings.filter((t) => t.id !== activeTaskId)
  const insertAt = withoutDragged.findIndex((t) => t.id === targetTaskId)
  if (insertAt < 0) return null

  let newSortOrder: number
  if (insertAt === 0) {
    newSortOrder = withoutDragged[0].sortOrder - 1
  } else {
    const prev = withoutDragged[insertAt - 1]
    const next = withoutDragged[insertAt]
    newSortOrder = (prev.sortOrder + next.sortOrder) / 2
  }

  return {
    sectionId: dragged.sectionId,
    parentTaskId: dragged.parentTaskId,
    sortOrder: newSortOrder,
  }
}

/**
 * When the pointer lands on `gap:task:<anchorId>` but not on a `sec:` target (e.g. list view
 * rows vs section headers), move the task into the anchor's section as a **root** with
 * sortOrder just before the anchor's top-level root (never nests under another task).
 * Runs only after `resolveTaskReorder` returns null (not a same-parent sibling reorder).
 */
export function resolveTaskGapSectionMove(
  tasks: TaskDoc[],
  activeTaskId: string,
  gapId: string,
): TaskMovePatch | null {
  if (!gapId.startsWith('gap:task:')) return null
  const anchorId = gapId.slice(9)
  if (anchorId === activeTaskId) return null

  const dragged = tasks.find((t) => t.id === activeTaskId)
  const anchor = tasks.find((t) => t.id === anchorId)
  if (!dragged || !anchor) return null

  // Same sibling group: handled only by resolveTaskReorder
  if (
    dragged.parentTaskId === anchor.parentTaskId &&
    dragged.sectionId === anchor.sectionId
  ) {
    return null
  }

  const sectionId = anchor.sectionId
  const anchorRoot =
    anchor.parentTaskId === null
      ? anchor
      : tasks.find((t) => t.id === anchor.parentTaskId)
  if (!anchorRoot || anchorRoot.parentTaskId !== null) return null

  // Already a root in target section, immediately before anchor root — no-op
  if (
    dragged.parentTaskId === null &&
    dragged.sectionId === sectionId
  ) {
    const rootsAll = tasks
      .filter((t) => !t.parentTaskId && t.sectionId === sectionId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    const dIdx = rootsAll.findIndex((t) => t.id === activeTaskId)
    const aIdx = rootsAll.findIndex((t) => t.id === anchorRoot.id)
    if (dIdx >= 0 && aIdx >= 0 && dIdx === aIdx - 1) return null
  }

  const rootsHere = tasks
    .filter(
      (t) =>
        !t.parentTaskId &&
        t.sectionId === sectionId &&
        t.id !== activeTaskId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const insertAt = rootsHere.findIndex((t) => t.id === anchorRoot.id)
  if (insertAt < 0) return null

  let newSortOrder: number
  if (insertAt === 0) {
    newSortOrder = rootsHere[0].sortOrder - 1
  } else {
    const prev = rootsHere[insertAt - 1]
    const next = rootsHere[insertAt]
    newSortOrder = (prev.sortOrder + next.sortOrder) / 2
  }

  return {
    sectionId,
    parentTaskId: null,
    sortOrder: newSortOrder,
  }
}

/** Move subtask to end of chain under `appsub:<parentId>` (same parent only). */
export function resolveTaskAppendSubtaskChain(
  tasks: TaskDoc[],
  activeTaskId: string,
  overId: string | null,
): TaskMovePatch | null {
  if (!overId || !overId.startsWith('appsub:')) return null
  const parentId = overId.slice(7)
  const dragged = tasks.find((t) => t.id === activeTaskId)
  if (!dragged || dragged.parentTaskId !== parentId) return null

  const orderedSiblings = tasks
    .filter(
      (t) =>
        t.parentTaskId === parentId && t.sectionId === dragged.sectionId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  if (
    orderedSiblings.length > 0 &&
    orderedSiblings[orderedSiblings.length - 1].id === activeTaskId
  ) {
    return null
  }

  const siblingsEx = tasks.filter(
    (t) => t.parentTaskId === parentId && t.id !== activeTaskId,
  )
  const nextSort =
    siblingsEx.length > 0
      ? Math.max(...siblingsEx.map((t) => t.sortOrder)) + 1
      : 0

  return {
    sectionId: dragged.sectionId,
    parentTaskId: parentId,
    sortOrder: nextSort,
  }
}

/**
 * Computes a new sortOrder for `activeSectionId` so that it appears immediately
 * before the section referenced by `gapId` (`gap:sec:<sectionId>`).
 * Returns null when no change is needed.
 */
export function resolveSectionReorder(
  sections: SectionDoc[],
  activeSectionId: string,
  gapId: string,
): SectionMovePatch | null {
  if (!gapId.startsWith('gap:sec:')) return null
  const targetSectionId = gapId.slice(8) // 'gap:sec:'.length === 8
  if (targetSectionId === activeSectionId) return null

  const allSorted = [...sections].sort((a, b) => a.sortOrder - b.sortOrder)
  const draggedPos = allSorted.findIndex((s) => s.id === activeSectionId)
  const targetPos = allSorted.findIndex((s) => s.id === targetSectionId)
  if (draggedPos < 0 || targetPos < 0) return null

  // No-op: already immediately before target
  if (draggedPos === targetPos - 1) return null

  const withoutDragged = allSorted.filter((s) => s.id !== activeSectionId)
  const insertAt = withoutDragged.findIndex((s) => s.id === targetSectionId)
  if (insertAt < 0) return null

  let newSortOrder: number
  if (insertAt === 0) {
    newSortOrder = withoutDragged[0].sortOrder - 1
  } else {
    const prev = withoutDragged[insertAt - 1]
    const next = withoutDragged[insertAt]
    newSortOrder = (prev.sortOrder + next.sortOrder) / 2
  }

  return { sortOrder: newSortOrder }
}

// ─── optimistic-update helpers ───────────────────────────────────────────────

/** Re-applies in-flight move patches when the Firestore snapshot is still behind the client. */
export function mergeTasksWithPendingMoves(
  incoming: TaskDoc[],
  pending: Map<string, TaskMovePatch>,
): TaskDoc[] {
  if (pending.size === 0) return incoming
  return incoming.map((t) => {
    const p = pending.get(t.id)
    if (!p) return t
    return {
      ...t,
      sectionId: p.sectionId,
      parentTaskId: p.parentTaskId,
      sortOrder: p.sortOrder,
    }
  })
}

/** Drop pending rows once the server document matches what we wrote (or the task vanished). */
export function clearPendingMovesConfirmedByServer(
  incoming: TaskDoc[],
  pending: Map<string, TaskMovePatch>,
) {
  for (const [id, patch] of [...pending.entries()]) {
    const t = incoming.find((x) => x.id === id)
    if (!t) {
      pending.delete(id)
      continue
    }
    if (
      t.sectionId === patch.sectionId &&
      t.parentTaskId === patch.parentTaskId &&
      t.sortOrder === patch.sortOrder
    ) {
      pending.delete(id)
    }
  }
}
