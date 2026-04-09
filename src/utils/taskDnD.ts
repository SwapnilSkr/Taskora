import {
  closestCorners,
  pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core'
import type { TaskDoc } from '../types/models'

/** Pointer-first; only `sec:` / `par:` targets; prefer a task row over a section. */
export const taskDropCollisionDetection: CollisionDetection = (args) => {
  const isDropTarget = (id: string | number) => {
    const s = String(id)
    return s.startsWith('sec:') || s.startsWith('par:')
  }
  const pointerHits = pointerWithin(args).filter((x) => isDropTarget(x.id))
  const preferPar = (hits: typeof pointerHits) => {
    if (hits.length === 0) return []
    const par = hits.find((x) => String(x.id).startsWith('par:'))
    return par ? [par] : [hits[0]]
  }
  const fromPointer = preferPar(pointerHits)
  if (fromPointer.length > 0) return fromPointer
  const cornerHits = closestCorners(args).filter((x) => isDropTarget(x.id))
  return preferPar(cornerHits)
}

/** dnd-kit active id: `drag:<taskId>` */
export function taskDragId(taskId: string) {
  return `drag:${taskId}`
}

export function parseTaskDragId(activeId: string | number | undefined): string | null {
  const s = String(activeId ?? '')
  return s.startsWith('drag:') ? s.slice(5) : null
}

/** Section column / header: `sec:<sectionId>`, parent task row: `par:<taskId>` */
export function sectionDropId(sectionId: string) {
  return `sec:${sectionId}`
}

export function parentTaskDropId(taskId: string) {
  return `par:${taskId}`
}

export type TaskMovePatch = {
  sectionId: string
  parentTaskId: string | null
  sortOrder: number
}

/**
 * Computes Firestore patch fields for dropping `activeTaskId` onto `overId`.
 * Returns null when the drop does nothing.
 */
export function resolveTaskDrop(
  tasks: TaskDoc[],
  activeTaskId: string,
  overId: string | null,
): TaskMovePatch | null {
  if (!overId) return null
  const dragged = tasks.find((t) => t.id === activeTaskId)
  if (!dragged) return null

  if (overId.startsWith('sec:')) {
    const sectionId = overId.slice(4)
    const rootsHere = tasks.filter(
      (t) =>
        !t.parentTaskId &&
        t.sectionId === sectionId &&
        t.id !== activeTaskId,
    )
    const nextSort =
      rootsHere.length > 0
        ? Math.max(...rootsHere.map((t) => t.sortOrder)) + 1
        : 0

    if (dragged.parentTaskId) {
      // Promote subtask to a main task in this section (any section, including current).
      return { sectionId, parentTaskId: null, sortOrder: nextSort }
    }

    // Root task: only move when changing section
    if (dragged.sectionId === sectionId) return null
    return { sectionId, parentTaskId: null, sortOrder: nextSort }
  }

  if (overId.startsWith('par:')) {
    const parentId = overId.slice(4)
    if (parentId === activeTaskId) return null
    const parent = tasks.find((t) => t.id === parentId)
    if (!parent || parent.parentTaskId) return null
    // Reordering under the same parent is a no-op for our model (append-only order).
    if (dragged.parentTaskId === parentId) return null
    const siblings = tasks.filter(
      (t) => t.parentTaskId === parentId && t.id !== activeTaskId,
    )
    const sortOrder =
      siblings.length > 0
        ? Math.max(...siblings.map((t) => t.sortOrder)) + 1
        : 0
    return {
      sectionId: parent.sectionId,
      parentTaskId: parentId,
      sortOrder,
    }
  }

  return null
}

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
