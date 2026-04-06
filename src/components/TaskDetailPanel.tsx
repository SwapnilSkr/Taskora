import { Timestamp } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  addComment,
  createTask,
  deleteTask,
  subscribeAttachments,
  subscribeComments,
  updateTask,
} from '../services/db'
import { uploadTaskFile } from '../services/storage'
import type { AttachmentMeta, CommentDoc, TaskDoc } from '../types/models'
import { fmtDateFull, tsToDate } from '../utils/format'
import './layout/layout.css'

type Props = {
  uid: string
  projectId: string
  task: TaskDoc | null
  allTasks: TaskDoc[]
  onClose: () => void
  onSaved: () => void
}

function dateInputValue(d: Date | null): string {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromDateInput(v: string): Timestamp | null {
  if (!v) return null
  const d = new Date(v + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return null
  return Timestamp.fromDate(d)
}

export function TaskDetailPanel({
  uid,
  projectId,
  task,
  allTasks,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth()
  const [tab, setTab] = useState<'details' | 'subtasks' | 'comments' | 'files'>(
    'details',
  )
  const [comments, setComments] = useState<CommentDoc[]>([])
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([])
  const [commentText, setCommentText] = useState('')
  const [tagDraft, setTagDraft] = useState('')

  useEffect(() => {
    if (!task) return
    const u = subscribeComments(uid, projectId, task.id, setComments)
    const v = subscribeAttachments(uid, projectId, task.id, setAttachments)
    return () => {
      u()
      v()
    }
  }, [uid, projectId, task])

  const subtasks = useMemo(
    () => allTasks.filter((t) => t.parentTaskId === task?.id),
    [allTasks, task],
  )

  if (!task) return null

  const t = task

  async function savePatch(patch: Partial<TaskDoc>) {
    await updateTask(uid, projectId, t.id, patch)
    onSaved()
  }

  return (
    <>
      <button type="button" className="panel-backdrop" onClick={onClose} aria-label="Close" />
      <aside className="task-panel">
        <div className="panel-header">
          <label className="sr-only">Completed</label>
          <button
            type="button"
            className="checkbox"
            data-done={t.completed ? 'true' : 'false'}
            title="Mark complete"
            onClick={() =>
              void savePatch({
                completed: !t.completed,
                status: !t.completed ? 'completed' : 'not_started',
              })
            }
          />
          <input
            className="input"
            style={{ border: 'none', background: 'transparent', fontSize: 18, fontWeight: 700 }}
            value={t.title}
            onChange={(e) => void savePatch({ title: e.target.value })}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, padding: '0 14px', borderBottom: '1px solid var(--border-subtle)' }}>
          {(
            [
              ['details', 'Details'],
              ['subtasks', `Subtasks (${subtasks.length})`],
              ['comments', `Comments (${comments.length})`],
              ['files', `Files (${attachments.length})`],
            ] as const
          ).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              className="tab"
              data-active={tab === k ? 'true' : 'false'}
              onClick={() => setTab(k)}
              style={{ marginBottom: 0, borderBottom: tab === k ? '2px solid #fff' : '2px solid transparent' }}
            >
              {lab}
            </button>
          ))}
        </div>

        <div className="panel-body">
          {tab === 'details' ? (
            <>
              <div className="field-label">Description</div>
              <textarea
                className="textarea"
                value={t.description}
                placeholder="What is this task about?"
                onChange={(e) => void savePatch({ description: e.target.value })}
              />

              <div className="row-2">
                <div>
                  <div className="field-label">Start date</div>
                  <input
                    type="date"
                    className="input"
                    value={dateInputValue(tsToDate(t.startDate))}
                    onChange={(e) =>
                      void savePatch({ startDate: fromDateInput(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <div className="field-label">Due date</div>
                  <input
                    type="date"
                    className="input"
                    value={dateInputValue(tsToDate(t.dueDate))}
                    onChange={(e) =>
                      void savePatch({ dueDate: fromDateInput(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="row-2">
                <div>
                  <div className="field-label">Status</div>
                  <select
                    className="select"
                    value={t.status}
                    onChange={(e) =>
                      void savePatch({ status: e.target.value as TaskDoc['status'] })
                    }
                  >
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
                <div>
                  <div className="field-label">Priority</div>
                  <select
                    className="select"
                    value={t.priority}
                    onChange={(e) =>
                      void savePatch({
                        priority: e.target.value as TaskDoc['priority'],
                      })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="row-2">
                <div>
                  <div className="field-label">Assignee</div>
                  <select
                    className="select"
                    value={t.assigneeId ?? ''}
                    onChange={(e) =>
                      void savePatch({
                        assigneeId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Unassigned</option>
                    <option value={uid}>Me ({user?.displayName || user?.email || 'self'})</option>
                  </select>
                </div>
                <div>
                  <div className="field-label">Approval</div>
                  <select
                    className="select"
                    value={t.approvalStatus}
                    onChange={(e) =>
                      void savePatch({
                        approvalStatus: e.target.value as TaskDoc['approvalStatus'],
                      })
                    }
                  >
                    <option value="none">None</option>
                    <option value="pending">Pending approval</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="row-2">
                <div>
                  <div className="field-label">Estimate (minutes)</div>
                  <input
                    type="number"
                    className="input"
                    value={t.estimatedMinutes ?? ''}
                    placeholder="e.g. 120"
                    onChange={(e) =>
                      void savePatch({
                        estimatedMinutes: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
                <div>
                  <div className="field-label">Tracked (minutes)</div>
                  <input
                    type="number"
                    className="input"
                    value={t.trackedMinutes ?? ''}
                    placeholder="Log time"
                    onChange={(e) =>
                      void savePatch({
                        trackedMinutes: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
              </div>

              <div className="field-label">Tags</div>
              <div className="tag-input-row">
                {t.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="tag-chip"
                    onClick={() =>
                      void savePatch({ tags: t.tags.filter((x) => x !== tag) })
                    }
                    title="Remove tag"
                  >
                    {tag} ×
                  </button>
                ))}
                <input
                  className="input"
                  style={{ flex: '1 1 140px', minWidth: 120 }}
                  placeholder="Add tag"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = tagDraft.trim()
                      if (!v || t.tags.includes(v)) return
                      void savePatch({ tags: [...t.tags, v] })
                      setTagDraft('')
                    }
                  }}
                />
              </div>

              <div className="field-label">Dependencies (task ids, comma-separated)</div>
              <input
                className="input"
                value={t.dependencies.join(', ')}
                onChange={(e) =>
                  void savePatch({
                    dependencies: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />

              <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ borderRadius: 8, padding: '10px 12px' }}
                  onClick={() => {
                    if (window.confirm('Delete this task?')) {
                      void deleteTask(uid, projectId, t.id).then(onClose)
                    }
                  }}
                >
                  Delete task
                </button>
                <div style={{ flex: 1 }} />
                <div style={{ color: 'var(--text-muted)', fontSize: 12, alignSelf: 'center' }}>
                  Updated {fmtDateFull(tsToDate(t.updatedAt))}
                </div>
              </div>
            </>
          ) : null}

          {tab === 'subtasks' ? (
            <div>
              {subtasks.map((st) => (
                <div key={st.id} className="board-card" style={{ cursor: 'default' }}>
                  {st.title}
                </div>
              ))}
              <button
                type="button"
                className="btn-add-task"
                style={{ marginTop: 10 }}
                onClick={async () => {
                  const title = window.prompt('Subtask title')
                  if (!title?.trim()) return
                  const siblings = allTasks.filter(
                    (x) => x.parentTaskId === t.id,
                  )
                  const sortOrder =
                    siblings.length > 0
                      ? Math.max(...siblings.map((s) => s.sortOrder)) + 1
                      : 0
                  await createTask(uid, projectId, {
                    sectionId: t.sectionId,
                    title: title.trim(),
                    parentTaskId: t.id,
                    sortOrder,
                  })
                  onSaved()
                }}
              >
                + Add subtask
              </button>
            </div>
          ) : null}

          {tab === 'comments' ? (
            <div>
              {comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: 13,
                  }}
                >
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>
                    {c.authorName || 'Teammate'} ·{' '}
                    {fmtDateFull(tsToDate(c.createdAt))}
                  </div>
                  <div>{c.text}</div>
                </div>
              ))}
              <div className="field-label">New comment</div>
              <textarea
                className="textarea"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: 10, width: '100%' }}
                onClick={() => {
                  const text = commentText.trim()
                  if (!text) return
                  void addComment(
                    uid,
                    projectId,
                    t.id,
                    text,
                    user?.displayName ?? user?.email ?? null,
                  ).then(() => {
                    setCommentText('')
                    onSaved()
                  })
                }}
              >
                Comment
              </button>
            </div>
          ) : null}

          {tab === 'files' ? (
            <div>
              <input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  void uploadTaskFile(uid, projectId, t.id, f).then(onSaved)
                }}
              />
              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.downloadURL}
                    target="_blank"
                    rel="noreferrer"
                    className="board-card"
                    style={{ cursor: 'pointer' }}
                  >
                    {a.name} · {(a.size / 1024).toFixed(1)} KB
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
