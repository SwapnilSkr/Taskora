import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb, getFirebaseStorage } from '../lib/firebase'
import { deleteObject, ref as storageRef } from 'firebase/storage'
import type {
  AttachmentMeta,
  CommentDoc,
  ProjectDoc,
  SectionDoc,
  TaskDoc,
} from '../types/models'
import type { Timestamp } from 'firebase/firestore'

const ts = () => serverTimestamp()

function userRoot(uid: string) {
  return doc(getDb(), 'users', uid)
}

function projectsCol(uid: string) {
  return collection(userRoot(uid), 'projects')
}

function projectRef(uid: string, projectId: string) {
  return doc(projectsCol(uid), projectId)
}

function sectionsCol(uid: string, projectId: string) {
  return collection(projectRef(uid, projectId), 'sections')
}

function tasksCol(uid: string, projectId: string) {
  return collection(projectRef(uid, projectId), 'tasks')
}

function taskRef(uid: string, projectId: string, taskId: string) {
  return doc(tasksCol(uid, projectId), taskId)
}

function commentsCol(uid: string, projectId: string, taskId: string) {
  return collection(taskRef(uid, projectId, taskId), 'comments')
}

function attachmentsCol(uid: string, projectId: string, taskId: string) {
  return collection(taskRef(uid, projectId, taskId), 'attachments')
}

export async function upsertUserProfile(
  uid: string,
  data: { email: string | null; displayName: string | null; photoURL: string | null },
): Promise<void> {
  const ref = userRoot(uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      createdAt: ts(),
    })
  } else {
    await updateDoc(ref, {
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
    })
  }
}

function mapProject(id: string, d: Record<string, unknown>): ProjectDoc {
  return {
    id,
    name: String(d.name ?? ''),
    color: String(d.color ?? '#7c5cff'),
    description: String(d.description ?? ''),
    starred: Boolean(d.starred),
    archived: Boolean(d.archived),
    createdAt: (d.createdAt as Timestamp | null) ?? null,
    updatedAt: (d.updatedAt as Timestamp | null) ?? null,
  }
}

function mapSection(id: string, d: Record<string, unknown>): SectionDoc {
  return {
    id,
    name: String(d.name ?? ''),
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
    createdAt: (d.createdAt as Timestamp | null) ?? null,
  }
}

function mapTask(id: string, d: Record<string, unknown>): TaskDoc {
  return {
    id,
    sectionId: String(d.sectionId ?? ''),
    title: String(d.title ?? ''),
    description: String(d.description ?? ''),
    completed: Boolean(d.completed),
    status: (d.status as TaskDoc['status']) ?? 'not_started',
    priority: (d.priority as TaskDoc['priority']) ?? 'medium',
    assigneeId: (d.assigneeId as string | null) ?? null,
    startDate: (d.startDate as Timestamp | null) ?? null,
    dueDate: (d.dueDate as Timestamp | null) ?? null,
    completedAt: (d.completedAt as Timestamp | null) ?? null,
    parentTaskId: (d.parentTaskId as string | null) ?? null,
    sortOrder: typeof d.sortOrder === 'number' ? d.sortOrder : 0,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    estimatedMinutes:
      typeof d.estimatedMinutes === 'number' ? d.estimatedMinutes : null,
    trackedMinutes:
      typeof d.trackedMinutes === 'number' ? d.trackedMinutes : null,
    approvalStatus: (d.approvalStatus as TaskDoc['approvalStatus']) ?? 'none',
    customFields:
      d.customFields && typeof d.customFields === 'object'
        ? (d.customFields as Record<string, string | number | boolean | null>)
        : {},
    dependencies: Array.isArray(d.dependencies) ? (d.dependencies as string[]) : [],
    createdAt: (d.createdAt as Timestamp | null) ?? null,
    updatedAt: (d.updatedAt as Timestamp | null) ?? null,
  }
}

export function subscribeProjects(
  uid: string,
  cb: (projects: ProjectDoc[]) => void,
): Unsubscribe {
  const q = query(projectsCol(uid), orderBy('updatedAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((x) =>
        mapProject(x.id, x.data() as Record<string, unknown>),
      ),
    )
  })
}

export async function createProject(uid: string, name: string): Promise<string> {
  const ref = await addDoc(projectsCol(uid), {
    name,
    color: '#7c5cff',
    description: '',
    starred: false,
    archived: false,
    createdAt: ts(),
    updatedAt: ts(),
  })
  const pid = ref.id
  const batch = writeBatch(getDb())
  const sref = doc(sectionsCol(uid, pid))
  batch.set(sref, { name: 'Untitled section', sortOrder: 0, createdAt: ts() })
  batch.update(projectRef(uid, pid), { updatedAt: ts() })
  await batch.commit()

  const tref = doc(tasksCol(uid, pid))
  await setDoc(tref, {
    sectionId: sref.id,
    title: 'Determine project goal',
    description: '',
    completed: false,
    status: 'not_started',
    priority: 'medium',
    assigneeId: null,
    startDate: null,
    dueDate: null,
    completedAt: null,
    parentTaskId: null,
    sortOrder: 0,
    tags: ['planning'],
    estimatedMinutes: null,
    trackedMinutes: null,
    approvalStatus: 'none',
    customFields: {},
    dependencies: [],
    createdAt: ts(),
    updatedAt: ts(),
  })
  await addDoc(tasksCol(uid, pid), {
    sectionId: sref.id,
    title: 'Schedule kickoff meeting',
    description: '',
    completed: false,
    status: 'not_started',
    priority: 'medium',
    assigneeId: null,
    startDate: null,
    dueDate: null,
    completedAt: null,
    parentTaskId: null,
    sortOrder: 1,
    tags: ['meeting'],
    estimatedMinutes: 60,
    trackedMinutes: null,
    approvalStatus: 'none',
    customFields: {},
    dependencies: [],
    createdAt: ts(),
    updatedAt: ts(),
  })
  await addDoc(tasksCol(uid, pid), {
    sectionId: sref.id,
    title: 'Set final deadline',
    description: '',
    completed: false,
    status: 'not_started',
    priority: 'high',
    assigneeId: null,
    startDate: null,
    dueDate: null,
    completedAt: null,
    parentTaskId: null,
    sortOrder: 2,
    tags: ['milestone'],
    estimatedMinutes: null,
    trackedMinutes: null,
    approvalStatus: 'none',
    customFields: {},
    dependencies: [],
    createdAt: ts(),
    updatedAt: ts(),
  })
  return pid
}

export async function updateProject(
  uid: string,
  projectId: string,
  patch: Partial<
    Pick<
      ProjectDoc,
      'name' | 'color' | 'description' | 'starred' | 'archived'
    >
  >,
): Promise<void> {
  await updateDoc(projectRef(uid, projectId), {
    ...patch,
    updatedAt: ts(),
  })
}

export function subscribeSections(
  uid: string,
  projectId: string,
  cb: (sections: SectionDoc[]) => void,
): Unsubscribe {
  const q = query(sectionsCol(uid, projectId), orderBy('sortOrder', 'asc'))
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((x) =>
        mapSection(x.id, x.data() as Record<string, unknown>),
      ),
    )
  })
}

export async function addSection(
  uid: string,
  projectId: string,
  name: string,
  sortOrder: number,
): Promise<void> {
  await addDoc(sectionsCol(uid, projectId), {
    name,
    sortOrder,
    createdAt: ts(),
  })
  await updateDoc(projectRef(uid, projectId), { updatedAt: ts() })
}

export async function renameSection(
  uid: string,
  projectId: string,
  sectionId: string,
  name: string,
): Promise<void> {
  await updateDoc(doc(sectionsCol(uid, projectId), sectionId), { name })
}

const BATCH_FIRESTORE = 450

/** Moves tasks to another section, then deletes the section doc (requires ≥2 sections). */
export async function deleteSection(
  uid: string,
  projectId: string,
  sectionId: string,
  allSections: SectionDoc[],
  allTasks: TaskDoc[],
): Promise<void> {
  const remaining = allSections
    .filter((s) => s.id !== sectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  if (remaining.length === 0) {
    throw new Error('Cannot delete the only section in a project')
  }
  const targetId = remaining[0].id
  let batch = writeBatch(getDb())
  let n = 0
  for (const t of allTasks) {
    if (t.sectionId !== sectionId) continue
    batch.update(taskRef(uid, projectId, t.id), {
      sectionId: targetId,
      updatedAt: ts(),
    })
    n++
    if (n >= BATCH_FIRESTORE) {
      await batch.commit()
      batch = writeBatch(getDb())
      n = 0
    }
  }
  if (n > 0) await batch.commit()
  await deleteDoc(doc(sectionsCol(uid, projectId), sectionId))
  await updateDoc(projectRef(uid, projectId), { updatedAt: ts() })
}

export function subscribeTasks(
  uid: string,
  projectId: string,
  cb: (tasks: TaskDoc[]) => void,
): Unsubscribe {
  const q = query(tasksCol(uid, projectId), orderBy('sortOrder', 'asc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((x) => mapTask(x.id, x.data() as Record<string, unknown>)))
  })
}

export async function createTask(
  uid: string,
  projectId: string,
  input: {
    sectionId: string
    title: string
    parentTaskId?: string | null
    sortOrder: number
  },
): Promise<string> {
  const ref = await addDoc(tasksCol(uid, projectId), {
    sectionId: input.sectionId,
    title: input.title,
    description: '',
    completed: false,
    status: 'not_started',
    priority: 'medium',
    assigneeId: null,
    startDate: null,
    dueDate: null,
    completedAt: null,
    parentTaskId: input.parentTaskId ?? null,
    sortOrder: input.sortOrder,
    tags: [],
    estimatedMinutes: null,
    trackedMinutes: null,
    approvalStatus: 'none',
    customFields: {},
    dependencies: [],
    createdAt: ts(),
    updatedAt: ts(),
  })
  await updateDoc(projectRef(uid, projectId), { updatedAt: ts() })
  return ref.id
}

export async function updateTask(
  uid: string,
  projectId: string,
  taskId: string,
  patch: Partial<
    Omit<TaskDoc, 'id' | 'createdAt'> & { completed?: boolean }
  >,
): Promise<void> {
  const cleaned: Record<string, unknown> = { ...patch, updatedAt: ts() }
  if (patch.completed === true) cleaned.completedAt = ts()
  if (patch.completed === false) cleaned.completedAt = null
  await updateDoc(taskRef(uid, projectId, taskId), cleaned)
}

async function deleteTaskLeaf(
  uid: string,
  projectId: string,
  taskId: string,
): Promise<void> {
  const cs = await getDocs(commentsCol(uid, projectId, taskId))
  const batch = writeBatch(getDb())
  cs.docs.forEach((d) => batch.delete(d.ref))
  const as = await getDocs(attachmentsCol(uid, projectId, taskId))
  const bucket = getFirebaseStorage()
  for (const d of as.docs) {
    const path = (d.data() as { storagePath?: string }).storagePath
    if (path) {
      try {
        await deleteObject(storageRef(bucket, path))
      } catch {
        /* file already removed */
      }
    }
    batch.delete(d.ref)
  }
  batch.delete(taskRef(uid, projectId, taskId))
  await batch.commit()
}

/** Deletes task, nested subtasks, comments, and attachment docs. */
export async function deleteTask(
  uid: string,
  projectId: string,
  taskId: string,
): Promise<void> {
  const kidQ = query(tasksCol(uid, projectId), where('parentTaskId', '==', taskId))
  const kids = await getDocs(kidQ)
  for (const d of kids.docs) {
    await deleteTask(uid, projectId, d.id)
  }
  await deleteTaskLeaf(uid, projectId, taskId)
  await updateDoc(projectRef(uid, projectId), { updatedAt: ts() })
}

/** Deletes selected tasks; avoids double-deleting when parent and child are both selected. */
export async function bulkDeleteTasks(
  uid: string,
  projectId: string,
  taskIds: string[],
  allTasks: TaskDoc[],
): Promise<void> {
  const sel = new Set(taskIds)
  const roots = taskIds.filter((id) => {
    const t = allTasks.find((x) => x.id === id)
    if (!t?.parentTaskId) return true
    return !sel.has(t.parentTaskId)
  })
  for (const id of roots) {
    await deleteTask(uid, projectId, id)
  }
}

const BATCH_LIMIT = 450

export async function bulkSetTasksCompleted(
  uid: string,
  projectId: string,
  taskIds: string[],
  completed: boolean,
): Promise<void> {
  let batch = writeBatch(getDb())
  let n = 0
  for (const id of taskIds) {
    const patch: Record<string, unknown> = {
      completed,
      status: completed ? 'completed' : 'not_started',
      completedAt: completed ? ts() : null,
      updatedAt: ts(),
    }
    batch.update(taskRef(uid, projectId, id), patch)
    n++
    if (n >= BATCH_LIMIT) {
      await batch.commit()
      batch = writeBatch(getDb())
      n = 0
    }
  }
  if (n > 0) await batch.commit()
  await updateDoc(projectRef(uid, projectId), { updatedAt: ts() })
}

export async function bulkSetAssignee(
  uid: string,
  projectId: string,
  taskIds: string[],
  assigneeId: string | null,
): Promise<void> {
  let batch = writeBatch(getDb())
  let n = 0
  for (const id of taskIds) {
    batch.update(taskRef(uid, projectId, id), {
      assigneeId,
      updatedAt: ts(),
    })
    n++
    if (n >= BATCH_LIMIT) {
      await batch.commit()
      batch = writeBatch(getDb())
      n = 0
    }
  }
  if (n > 0) await batch.commit()
  await updateDoc(projectRef(uid, projectId), { updatedAt: ts() })
}

export function subscribeComments(
  uid: string,
  projectId: string,
  taskId: string,
  cb: (comments: CommentDoc[]) => void,
): Unsubscribe {
  const q = query(commentsCol(uid, projectId, taskId), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((x) => {
        const d = x.data() as Record<string, unknown>
        return {
          id: x.id,
          text: String(d.text ?? ''),
          authorId: String(d.authorId ?? ''),
          authorName: (d.authorName as string | null) ?? null,
          createdAt: (d.createdAt as Timestamp | null) ?? null,
        }
      }),
    )
  })
}

export async function addComment(
  uid: string,
  projectId: string,
  taskId: string,
  text: string,
  authorName: string | null,
): Promise<void> {
  await addDoc(commentsCol(uid, projectId, taskId), {
    text,
    authorId: uid,
    authorName,
    createdAt: ts(),
  })
}

export function subscribeAttachments(
  uid: string,
  projectId: string,
  taskId: string,
  cb: (attachments: AttachmentMeta[]) => void,
): Unsubscribe {
  const q = query(
    attachmentsCol(uid, projectId, taskId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((x) => {
        const d = x.data() as Record<string, unknown>
        return {
          id: x.id,
          name: String(d.name ?? ''),
          size: typeof d.size === 'number' ? d.size : 0,
          contentType: (d.contentType as string | null) ?? null,
          storagePath: String(d.storagePath ?? ''),
          downloadURL: String(d.downloadURL ?? ''),
          createdAt: (d.createdAt as Timestamp | null) ?? null,
        }
      }),
    )
  })
}

export async function saveAttachmentMeta(
  uid: string,
  projectId: string,
  taskId: string,
  meta: Omit<AttachmentMeta, 'id' | 'createdAt'>,
): Promise<void> {
  await addDoc(attachmentsCol(uid, projectId, taskId), {
    ...meta,
    createdAt: ts(),
  })
}

export async function deleteAttachmentDoc(
  uid: string,
  projectId: string,
  taskId: string,
  attachmentId: string,
): Promise<void> {
  await deleteDoc(doc(attachmentsCol(uid, projectId, taskId), attachmentId))
}
