import type { Timestamp } from 'firebase/firestore'

export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'blocked'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type ApprovalStatus = 'none' | 'pending' | 'approved' | 'rejected'

export interface UserProfile {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  createdAt: Timestamp | null
}

export interface ProjectDoc {
  id: string
  name: string
  color: string
  description: string
  starred: boolean
  archived: boolean
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface SectionDoc {
  id: string
  name: string
  sortOrder: number
  createdAt: Timestamp | null
}

export type CustomFieldValue = string | number | boolean | null

export interface TaskDoc {
  id: string
  sectionId: string
  title: string
  description: string
  completed: boolean
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string | null
  startDate: Timestamp | null
  dueDate: Timestamp | null
  completedAt: Timestamp | null
  parentTaskId: string | null
  sortOrder: number
  tags: string[]
  estimatedMinutes: number | null
  trackedMinutes: number | null
  approvalStatus: ApprovalStatus
  customFields: Record<string, CustomFieldValue>
  dependencies: string[]
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface CommentDoc {
  id: string
  text: string
  authorId: string
  authorName: string | null
  createdAt: Timestamp | null
}

export interface AttachmentMeta {
  id: string
  name: string
  size: number
  contentType: string | null
  storagePath: string
  downloadURL: string
  createdAt: Timestamp | null
}

export type ProjectView =
  | 'overview'
  | 'list'
  | 'board'
  | 'timeline'
  | 'dashboard'
  | 'gantt'
  | 'workload'
