import { Timestamp } from 'firebase/firestore'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useModals } from '../context/ModalContext'
import {
  DescriptionWysiwyg,
  type DescriptionWysiwygRef,
} from './DescriptionWysiwyg'
import { RichTextContent } from './RichTextContent'
import {
  addComment,
  createTask,
  deleteComment,
  deleteTask,
  deleteTaskAttachment,
  subscribeAttachments,
  subscribeComments,
  updateTask,
  updateTaskDescriptionWithImageCleanup,
} from '../services/db'
import { uploadTaskFile, uploadTaskImageBlob } from '../services/storage'
import type { AttachmentMeta, CommentDoc, TaskDoc } from '../types/models'
import { fmtDateFull, tsToDate } from '../utils/format'
import {
  firstImageFromClipboard,
  markdownImageLine,
  textHasMarkdownImages,
} from '../utils/imagePaste'
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
  const { confirm, prompt } = useModals()
  const [tab, setTab] = useState<'details' | 'subtasks' | 'comments' | 'files'>(
    'details',
  )
  const [comments, setComments] = useState<CommentDoc[]>([])
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([])
  const [commentText, setCommentText] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [imageUploadBusy, setImageUploadBusy] = useState<'idle' | 'desc' | 'comment'>(
    'idle',
  )
  const descImageInputRef = useRef<HTMLInputElement>(null)
  const commentImageInputRef = useRef<HTMLInputElement>(null)
  const descWysiwygRef = useRef<DescriptionWysiwygRef>(null)
  /** Last description persisted (to compute orphaned images vs edits). */
  const lastCommittedDescription = useRef('')

  useEffect(() => {
    if (!task) {
      lastCommittedDescription.current = ''
      return
    }
    lastCommittedDescription.current = task.description
  }, [task?.id])

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

  async function saveDescriptionNext(nextDescription: string) {
    await updateTaskDescriptionWithImageCleanup(
      uid,
      projectId,
      t.id,
      lastCommittedDescription.current,
      nextDescription,
    )
    lastCommittedDescription.current = nextDescription
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
              <div className="field-label field-label-row">
                <span>Description</span>
                <span className="field-hint">Paste or attach images (⌘V / Ctrl+V)</span>
                <input
                  ref={descImageInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (!f?.type.startsWith('image/')) return
                    void (async () => {
                      setImageUploadBusy('desc')
                      try {
                        const url = await uploadTaskImageBlob(
                          uid,
                          projectId,
                          t.id,
                          f,
                          f.name,
                        )
                        descWysiwygRef.current?.appendImageMarkdown(
                          markdownImageLine(url, f.name.slice(0, 40)),
                        )
                      } finally {
                        setImageUploadBusy('idle')
                      }
                    })()
                  }}
                />
                <button
                  type="button"
                  className="linkish-btn-inline"
                  disabled={imageUploadBusy !== 'idle'}
                  onClick={() => descImageInputRef.current?.click()}
                >
                  Attach image
                </button>
              </div>
              <DescriptionWysiwyg
                ref={descWysiwygRef}
                markdown={t.description}
                onMarkdownChange={(md) => void saveDescriptionNext(md)}
                disabled={false}
                placeholder="What is this task about?"
                className="textarea"
                onPasteImageBlob={async (blob) => {
                  setImageUploadBusy('desc')
                  try {
                    return await uploadTaskImageBlob(
                      uid,
                      projectId,
                      t.id,
                      blob,
                      'paste',
                    )
                  } finally {
                    setImageUploadBusy('idle')
                  }
                }}
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
                    void (async () => {
                      const ok = await confirm({
                        title: 'Delete task',
                        message:
                          'Delete this task, its subtasks, comments, and file metadata? This cannot be undone.',
                        confirmLabel: 'Delete',
                        danger: true,
                      })
                      if (!ok) return
                      await deleteTask(uid, projectId, t.id)
                      onClose()
                    })()
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
                onClick={() => {
                  void (async () => {
                  const title = await prompt({
                    title: 'New subtask',
                    label: 'Subtask name',
                    placeholder: 'e.g. Draft outline',
                    confirmLabel: 'Add',
                  })
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
                  })()
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
                  className="comment-row"
                >
                  <div className="comment-row-meta">
                    <span>
                      {c.authorName || 'Teammate'} ·{' '}
                      {fmtDateFull(tsToDate(c.createdAt))}
                    </span>
                    <button
                      type="button"
                      className="linkish-btn-inline comment-delete"
                      onClick={() => {
                        void (async () => {
                          const ok = await confirm({
                            title: 'Delete comment',
                            message:
                              'Delete this comment and any images attached to it from Storage? This cannot be undone.',
                            confirmLabel: 'Delete',
                            danger: true,
                          })
                          if (!ok) return
                          await deleteComment(uid, projectId, t.id, c.id)
                          onSaved()
                        })()
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="comment-body">
                    <RichTextContent text={c.text} />
                  </div>
                </div>
              ))}
              <div className="field-label field-label-row">
                <span>New comment</span>
                <span className="field-hint">Images: ⌘V / Ctrl+V or attach</span>
                <input
                  ref={commentImageInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (!f?.type.startsWith('image/')) return
                    const blobUrl = URL.createObjectURL(f)
                    setCommentText(
                      (prev) => prev + markdownImageLine(blobUrl, f.name.slice(0, 40)),
                    )
                    void (async () => {
                      setImageUploadBusy('comment')
                      try {
                        const url = await uploadTaskImageBlob(
                          uid,
                          projectId,
                          t.id,
                          f,
                          f.name,
                        )
                        setCommentText((prev) =>
                          prev.includes(blobUrl)
                            ? prev.replace(blobUrl, url)
                            : prev + markdownImageLine(url, f.name.slice(0, 40)),
                        )
                      } finally {
                        URL.revokeObjectURL(blobUrl)
                        setImageUploadBusy('idle')
                      }
                    })()
                  }}
                />
                <button
                  type="button"
                  className="linkish-btn-inline"
                  disabled={imageUploadBusy !== 'idle'}
                  onClick={() => commentImageInputRef.current?.click()}
                >
                  Attach image
                </button>
              </div>
              <textarea
                className="textarea"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onPaste={(e) => {
                  const blob = firstImageFromClipboard(e.nativeEvent)
                  if (!blob) return
                  e.preventDefault()
                  const blobUrl = URL.createObjectURL(blob)
                  setCommentText((prev) => prev + markdownImageLine(blobUrl))
                  void (async () => {
                    setImageUploadBusy('comment')
                    try {
                      const url = await uploadTaskImageBlob(
                        uid,
                        projectId,
                        t.id,
                        blob,
                        'paste',
                      )
                      setCommentText((prev) =>
                        prev.includes(blobUrl)
                          ? prev.replace(blobUrl, url)
                          : prev + markdownImageLine(url),
                      )
                    } finally {
                      URL.revokeObjectURL(blobUrl)
                      setImageUploadBusy('idle')
                    }
                  })()
                }}
              />
              {textHasMarkdownImages(commentText) ? (
                <>
                  <div className="field-label" style={{ marginTop: 8 }}>
                    Preview
                  </div>
                  <div className="rich-preview-box">
                    <RichTextContent text={commentText} />
                  </div>
                </>
              ) : null}
              {imageUploadBusy === 'comment' ? (
                <p className="field-hint" style={{ marginTop: 6 }}>
                  Finishing image upload…
                </p>
              ) : null}
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: 10, width: '100%' }}
                disabled={
                  imageUploadBusy !== 'idle' || commentText.includes('blob:')
                }
                onClick={() => {
                  const text = commentText.trim()
                  if (!text) return
                  if (text.includes('blob:')) return
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
                  <div key={a.id} className="file-attachment-row">
                    <a
                      href={a.downloadURL}
                      target="_blank"
                      rel="noreferrer"
                      className="board-card file-attachment-link"
                    >
                      {a.name} · {(a.size / 1024).toFixed(1)} KB
                    </a>
                    <button
                      type="button"
                      className="linkish-btn-inline file-delete-btn"
                      onClick={() => {
                        void (async () => {
                          const ok = await confirm({
                            title: 'Delete file',
                            message:
                              'Remove this file from Storage, the file list, and any description or comments that embed it?',
                            confirmLabel: 'Delete',
                            danger: true,
                          })
                          if (!ok) return
                          await deleteTaskAttachment(
                            uid,
                            projectId,
                            t.id,
                            a.id,
                          )
                          onSaved()
                        })()
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
