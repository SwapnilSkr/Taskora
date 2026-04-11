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
  StatusDoc,
  TaskDoc,
} from '../types/models'
import {
  extractMarkdownImageUrls,
  normalizeDownloadUrl,
  removeMarkdownImagesWithUrl,
} from '../utils/imagePaste'
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

function statusesCol(uid: string) {
  return collection(userRoot(uid), 'statuses')
}

function statusRef(uid: string, statusId: string) {
  return doc(statusesCol(uid), statusId)
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

function mapStatus(id: string, d: Record<string, unknown>): StatusDoc {
  return {
    id,
    name: String(d.name ?? ''),
    color: String(d.color ?? '#cbd5e1'),
    isCompleted: Boolean(d.isCompleted),
    isDefault: Boolean(d.isDefault),
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
    statusId: (d.statusId as string | null) ?? (d.status as string | null) ?? null,
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

export function subscribeStatuses(
  uid: string,
  cb: (statuses: StatusDoc[]) => void,
): Unsubscribe {
  const q = query(statusesCol(uid), orderBy('sortOrder', 'asc'))
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((x) =>
        mapStatus(x.id, x.data() as Record<string, unknown>),
      ),
    )
  })
}

export async function createStatus(
  uid: string,
  data: Omit<StatusDoc, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(statusesCol(uid), {
    ...data,
    createdAt: ts(),
  })
  return ref.id
}

export async function updateStatus(
  uid: string,
  statusId: string,
  patch: Partial<Omit<StatusDoc, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(statusRef(uid, statusId), patch)
}

export async function deleteStatus(
  uid: string,
  statusId: string,
): Promise<void> {
  await deleteDoc(statusRef(uid, statusId))
}

export async function seedDefaultStatuses(uid: string): Promise<void> {
  const snap = await getDocs(statusesCol(uid))
  if (!snap.empty) return

  const defaults: Omit<StatusDoc, 'id' | 'createdAt'>[] = [
    {
      name: 'Pending',
      color: '#94a3b8',
      isCompleted: false,
      isDefault: true,
      sortOrder: 0,
    },
    {
      name: 'In Progress',
      color: '#3b82f6',
      isCompleted: false,
      isDefault: false,
      sortOrder: 1,
    },
    {
      name: 'In Review',
      color: '#f59e0b',
      isCompleted: false,
      isDefault: false,
      sortOrder: 2,
    },
    {
      name: 'Completed',
      color: '#10b981',
      isCompleted: true,
      isDefault: false,
      sortOrder: 3,
    },
  ]

  for (const s of defaults) {
    await createStatus(uid, s)
  }
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
  if (input.parentTaskId) {
    const parentSnap = await getDoc(
      taskRef(uid, projectId, input.parentTaskId),
    )
    if (!parentSnap.exists()) {
      throw new Error('Parent task not found')
    }
    const parent = mapTask(
      parentSnap.id,
      parentSnap.data() as Record<string, unknown>,
    )
    if (parent.parentTaskId) {
      throw new Error('Subtasks cannot have subtasks')
    }
  }
  const defaultSnap = await getDocs(
    query(statusesCol(uid), where('isDefault', '==', true)),
  )
  const defaultStatusId = defaultSnap.docs[0]?.id ?? null

  const ref = await addDoc(tasksCol(uid, projectId), {
    sectionId: input.sectionId,
    title: input.title,
    description: '',
    completed: false,
    statusId: defaultStatusId,
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
  const snap = await getDoc(taskRef(uid, projectId, taskId))
  if (!snap.exists()) {
    throw new Error('Task not found')
  }
  const current = mapTask(
    taskId,
    snap.data() as Record<string, unknown>,
  )

  const merged: Partial<TaskDoc> & {
    completed?: boolean
    sortOrder?: number
    sectionId?: string
    parentTaskId?: string | null
  } = { ...patch }

  if (patch.parentTaskId !== undefined && patch.parentTaskId !== null) {
    if (patch.parentTaskId === taskId) {
      throw new Error('A task cannot be its own parent.')
    }
    const kids = await getDocs(
      query(tasksCol(uid, projectId), where('parentTaskId', '==', taskId)),
    )
    if (!kids.empty) {
      throw new Error(
        'This task has subtasks. Move or delete them before making it a subtask.',
      )
    }
    const pSnap = await getDoc(taskRef(uid, projectId, patch.parentTaskId))
    if (!pSnap.exists()) {
      throw new Error('Parent task not found')
    }
    const parent = mapTask(
      patch.parentTaskId,
      pSnap.data() as Record<string, unknown>,
    )
    if (parent.parentTaskId) {
      throw new Error('Subtasks cannot have subtasks.')
    }
    merged.sectionId = parent.sectionId
  }

  if (patch.parentTaskId === null && current.parentTaskId !== null) {
    if (patch.sectionId === undefined) {
      throw new Error('sectionId is required when promoting a subtask to the main list.')
    }
  }

  const cleaned: Record<string, unknown> = { ...merged, updatedAt: ts() }
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
  cs.docs.forEach((d) => {
    batch.delete(d.ref)
  })
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
  const statusesSnap = await getDocs(statusesCol(uid))
  const statuses = statusesSnap.docs.map((x) => mapStatus(x.id, x.data() as Record<string, unknown>))
  const comp = statuses.find(s => s.isCompleted)
  const def = statuses.find(s => s.isDefault)

  let batch = writeBatch(getDb())
  let n = 0
  for (const id of taskIds) {
    const patch: Record<string, unknown> = {
      completed,
      statusId: completed ? (comp?.id ?? null) : (def?.id ?? null),
      completedAt: completed ? ts() : null,
      updatedAt: ts(),
    }
    batch.update(taskRef(uid, projectId, id), patch)
    n++
// ... (rest of the batch logic)
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

/** Deletes all tasks (and nested subtasks, comments, attachments), sections, and the project document. */
export async function deleteProject(
  uid: string,
  projectId: string,
): Promise<void> {
  for (;;) {
    const tq = await getDocs(tasksCol(uid, projectId))
    if (tq.empty) break
    await deleteTask(uid, projectId, tq.docs[0].id)
  }

  const sq = await getDocs(sectionsCol(uid, projectId))
  let batch = writeBatch(getDb())
  let n = 0
  for (const d of sq.docs) {
    batch.delete(d.ref)
    n++
    if (n >= BATCH_LIMIT) {
      await batch.commit()
      batch = writeBatch(getDb())
      n = 0
    }
  }
  if (n > 0) await batch.commit()

  await deleteDoc(projectRef(uid, projectId))
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

/** Deletes Storage objects + attachment docs for each URL (matched after normalize). */
async function deleteAttachmentsForUrls(
  uid: string,
  projectId: string,
  taskId: string,
  rawUrls: string[],
): Promise<void> {
  const realUrls = rawUrls.filter((u) => !u.startsWith('blob:'))
  if (realUrls.length === 0) return
  const normTargets = new Set(realUrls.map(normalizeDownloadUrl))
  const snap = await getDocs(attachmentsCol(uid, projectId, taskId))
  const bucket = getFirebaseStorage()
  for (const d of snap.docs) {
    const data = d.data() as { downloadURL?: string; storagePath?: string }
    const docUrl = normalizeDownloadUrl(String(data.downloadURL ?? ''))
    if (!normTargets.has(docUrl)) continue
    if (data.storagePath) {
      try {
        await deleteObject(storageRef(bucket, data.storagePath))
      } catch {
        /* already removed */
      }
    }
    await deleteDoc(d.ref)
  }
}

/**
 * Updates description and deletes Storage + attachment docs for images removed from text.
 */
export async function updateTaskDescriptionWithImageCleanup(
  uid: string,
  projectId: string,
  taskId: string,
  previousDescription: string,
  nextDescription: string,
): Promise<void> {
  const oldUrls = extractMarkdownImageUrls(previousDescription)
  const newNorm = new Set(
    extractMarkdownImageUrls(nextDescription).map(normalizeDownloadUrl),
  )
  const toDelete = oldUrls.filter(
    (u) => !newNorm.has(normalizeDownloadUrl(u)),
  )
  await updateTask(uid, projectId, taskId, { description: nextDescription })
  await deleteAttachmentsForUrls(uid, projectId, taskId, toDelete)
  await updateDoc(projectRef(uid, projectId), { updatedAt: ts() })
}

/** Deletes comment and any images embedded in it from Storage + attachments. */
export async function deleteComment(
  uid: string,
  projectId: string,
  taskId: string,
  commentId: string,
): Promise<void> {
  const cref = doc(commentsCol(uid, projectId, taskId), commentId)
  const snap = await getDoc(cref)
  const text = snap.exists()
    ? String((snap.data() as { text?: string }).text ?? '')
    : ''
  const urls = extractMarkdownImageUrls(text)
  await deleteAttachmentsForUrls(uid, projectId, taskId, urls)
  await deleteDoc(cref)
  await updateDoc(projectRef(uid, projectId), { updatedAt: ts() })
}

async function scrubDownloadUrlFromTaskContent(
  uid: string,
  projectId: string,
  taskId: string,
  downloadURL: string,
): Promise<void> {
  const tref = taskRef(uid, projectId, taskId)
  const taskSnap = await getDoc(tref)
  if (!taskSnap.exists()) return
  const desc = String(
    (taskSnap.data() as { description?: string }).description ?? '',
  )
  const nextDesc = removeMarkdownImagesWithUrl(desc, downloadURL)
  if (nextDesc !== desc) {
    await updateDoc(tref, { description: nextDesc, updatedAt: ts() })
  }
  const cq = await getDocs(commentsCol(uid, projectId, taskId))
  for (const cd of cq.docs) {
    const text = String((cd.data() as { text?: string }).text ?? '')
    if (!text.trim()) continue
    const cleaned = removeMarkdownImagesWithUrl(text, downloadURL)
    if (cleaned === text) continue
    const nextTrim = cleaned.trim()
    if (nextTrim === '') {
      await deleteDoc(cd.ref)
    } else {
      await updateDoc(cd.ref, { text: nextTrim })
    }
  }
}

/** Deletes one attachment from Storage + Firestore and strips that image from description/comments. */
export async function deleteTaskAttachment(
  uid: string,
  projectId: string,
  taskId: string,
  attachmentId: string,
): Promise<void> {
  const aref = doc(attachmentsCol(uid, projectId, taskId), attachmentId)
  const snap = await getDoc(aref)
  if (!snap.exists()) return
  const data = snap.data() as { downloadURL?: string; storagePath?: string }
  const downloadURL = String(data.downloadURL ?? '')
  const path = data.storagePath
  if (path) {
    try {
      await deleteObject(storageRef(getFirebaseStorage(), path))
    } catch {
      /* already removed */
    }
  }
  await deleteDoc(aref)
  await scrubDownloadUrlFromTaskContent(uid, projectId, taskId, downloadURL)
  await updateDoc(projectRef(uid, projectId), { updatedAt: ts() })
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

