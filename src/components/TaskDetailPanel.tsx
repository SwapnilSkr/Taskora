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
  subscribeStatuses,
  updateTask,
  updateTaskDescriptionWithImageCleanup,
} from '../services/db'
import { uploadTaskFile, uploadTaskImageBlob } from '../services/storage'
import type { AttachmentMeta, CommentDoc, StatusDoc, TaskDoc } from '../types/models'
import { fmtDateFull, tsToDate } from '../utils/format'
import {
  firstImageFromClipboard,
  markdownImageLine,
  textHasMarkdownImages,
} from '../utils/imagePaste'

type Props = {
  uid: string
  projectId: string
  task: TaskDoc | null
  allTasks: TaskDoc[]
  onClose: () => void
  onSaved: () => void
  /** Open another task in this panel (e.g. subtask from the Subtasks tab). */
  onOpenTask?: (task: TaskDoc) => void
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
  onOpenTask,
}: Props) {
  const { user } = useAuth()
  const { confirm, prompt } = useModals()
  const [tab, setTab] = useState<'details' | 'subtasks' | 'comments' | 'files'>(
    'details',
  )
  const [comments, setComments] = useState<CommentDoc[]>([])
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([])
  const [statuses, setStatuses] = useState<StatusDoc[]>([])
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

  const taskIdForDescRef = task?.id
  const taskDescriptionForDescRef = task?.description ?? ''

  useEffect(() => {
    if (taskIdForDescRef == null) {
      lastCommittedDescription.current = ''
      return
    }
    lastCommittedDescription.current = taskDescriptionForDescRef
  }, [taskIdForDescRef, taskDescriptionForDescRef])

  useEffect(() => {
    if (!task) return
    const u = subscribeComments(uid, projectId, task.id, setComments)
    const v = subscribeAttachments(uid, projectId, task.id, setAttachments)
    const w = subscribeStatuses(uid, setStatuses)
    return () => {
      u()
      v()
      w()
    }
  }, [uid, projectId, task])

  useEffect(() => {
    if (!task?.parentTaskId) return
    setTab((cur) => (cur === 'subtasks' ? 'details' : cur))
  }, [task?.id, task?.parentTaskId])

  const subtasks = useMemo(
    () => allTasks.filter((t) => t.parentTaskId === task?.id),
    [allTasks, task?.id],
  )

  if (!task) return null
  const t = task
  const isSubtask = Boolean(t.parentTaskId)

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
      <button
        type="button"
        className="fixed inset-0 z-90 cursor-default border-none bg-black/45 p-0"
        onClick={onClose}
        aria-label="Close"
      />
      <aside className="fixed right-0 top-0 z-100 flex h-full w-full max-w-[520px] flex-col border-l border-border bg-raised shadow-panel">
        <div className="flex items-start gap-2.5 border-b border-border-subtle px-[18px] py-4">
          <label className="sr-only">Completed</label>
          <button
            type="button"
            className="size-4 shrink-0 rounded border-[1.5px] border-placeholder shadow-[inset_0_0_0_2px_var(--color-app)] data-[done=true]:border-tick-done data-[done=true]:bg-tick-done"
            data-done={t.completed ? 'true' : 'false'}
            title="Mark complete"
            onClick={() => {
              const comp = statuses.find((s) => s.isCompleted)
              const def = statuses.find((s) => s.isDefault)
              void savePatch({
                completed: !t.completed,
                statusId: !t.completed ? (comp?.id ?? null) : (def?.id ?? null),
              })
            }}
          />
          <input
            className="flex-1 border-none bg-transparent text-lg font-bold outline-none"
            value={t.title}
            onChange={(e) => void savePatch({ title: e.target.value })}
          />
        </div>

        <div className="flex gap-1.5 border-b border-border-subtle px-3.5">
          {(
            [
              ['details', 'Details'] as const,
              ...(!isSubtask
                ? ([['subtasks', `Subtasks (${subtasks.length})`]] as const)
                : []),
              ['comments', `Comments (${comments.length})`] as const,
              ['files', `Files (${attachments.length})`] as const,
            ] as const
          ).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              className="-mb-px border-b-2 border-transparent px-3 pb-3 pt-2.5 text-[13px] font-semibold text-muted transition-colors hover:text-fg data-[active=true]:border-white data-[active=true]:text-fg"
              data-active={tab === k ? 'true' : 'false'}
              onClick={() => setTab(k)}
            >
              {lab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto px-[18px] py-4">
          {tab === 'details' ? (
            <>
              <div className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2 first:mt-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Description
                </span>
                <span className="text-[11px] font-medium normal-case tracking-normal text-muted opacity-90">
                  Paste or attach images (⌘V / Ctrl+V)
                </span>
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
                  className="ml-auto cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-share disabled:cursor-not-allowed disabled:opacity-45"
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
                className="min-h-[100px] w-full resize-y rounded-card border border-border bg-app px-3 py-2 text-[13px] leading-[1.45]"
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0">Start date</div>
                  <input
                    type="date"
                    className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
                    value={dateInputValue(tsToDate(t.startDate))}
                    onChange={(e) =>
                      void savePatch({ startDate: fromDateInput(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0">Due date</div>
                  <input
                    type="date"
                    className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
                    value={dateInputValue(tsToDate(t.dueDate))}
                    onChange={(e) =>
                      void savePatch({ dueDate: fromDateInput(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0">Status</div>
                  <select
                    className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
                    value={t.statusId ?? ''}
                    onChange={(e) => {
                      const sid = e.target.value || null
                      const s = statuses.find((x) => x.id === sid)
                      void savePatch({
                        statusId: sid,
                        completed: s?.isCompleted ?? false,
                      })
                    }}
                  >
                    <option value="">No status</option>
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0">Priority</div>
                  <select
                    className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0">Assignee</div>
                  <select
                    className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
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
                  <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0">Approval</div>
                  <select
                    className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
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

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0">Estimate (minutes)</div>
                  <input
                    type="number"
                    className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
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
                  <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0">Tracked (minutes)</div>
                  <input
                    type="number"
                    className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
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

              <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0">
                Tags
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {t.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="rounded-pill bg-tag-chip px-2.5 py-1 text-xs text-muted"
                    onClick={() =>
                      void savePatch({ tags: t.tags.filter((x) => x !== tag) })
                    }
                    title="Remove tag"
                  >
                    {tag} ×
                  </button>
                ))}
                <input
                  className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
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

              <div className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0">Dependencies (task ids, comma-separated)</div>
              <input
                className="w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
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
                  className="rounded-lg border border-border px-3 py-2.5 font-bold"
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
                <div className="self-center text-xs text-muted">
                  Updated {fmtDateFull(tsToDate(t.updatedAt))}
                </div>
              </div>
            </>
          ) : null}

          {tab === 'subtasks' && !isSubtask ? (
            <div>
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className="mb-2 cursor-default rounded-lg border border-border-subtle bg-raised px-2.5 py-2.5 text-[13px] font-semibold"
                >
                  <button
                    type="button"
                    className="w-full cursor-pointer border-none bg-transparent p-0 text-left font-semibold text-share hover:underline"
                    onClick={() => {
                      setTab('details')
                      onOpenTask?.(st)
                    }}
                  >
                    {st.title}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-pill border border-border bg-raised px-3 py-2 text-[13px] font-semibold transition-colors hover:bg-hover-surface"
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
                  className="border-b border-border-subtle py-2.5 text-[13px]"
                >
                  <div className="mb-1 flex items-center justify-between gap-2.5 text-xs text-muted">
                    <span>
                      {c.authorName || 'Teammate'} ·{' '}
                      {fmtDateFull(tsToDate(c.createdAt))}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-share"
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
                  <div className="text-[13px] text-fg">
                    <RichTextContent text={c.text} />
                  </div>
                </div>
              ))}
              <div className="mb-1.5 mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0">
                <span>New comment</span>
                <span className="text-[11px] font-medium normal-case tracking-normal text-muted opacity-90">
                  Images: ⌘V / Ctrl+V or attach
                </span>
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
                  className="ml-auto cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-share disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={imageUploadBusy !== 'idle'}
                  onClick={() => commentImageInputRef.current?.click()}
                >
                  Attach image
                </button>
              </div>
              <textarea
                className="min-h-[100px] w-full resize-y rounded-card border border-border bg-app px-3 py-2 text-[13px] leading-[1.45]"
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
                  <div className="mb-1.5 mt-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                    Preview
                  </div>
                  <div className="rounded-card border border-border-subtle bg-app px-3 py-2.5 text-[13px] text-fg">
                    <RichTextContent text={commentText} />
                  </div>
                </>
              ) : null}
              {imageUploadBusy === 'comment' ? (
                <p className="mt-1.5 text-[11px] font-medium normal-case tracking-normal text-muted opacity-90">
                  Finishing image upload…
                </p>
              ) : null}
              <button
                type="button"
                className="mt-2.5 w-full rounded-pill bg-share px-3.5 py-2.5 font-bold text-white transition-colors hover:bg-share-hover"
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
              <div className="mt-3 grid gap-2">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-stretch gap-2.5">
                    <a
                      href={a.downloadURL}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-raised px-2.5 py-2.5 text-[13px] font-semibold text-inherit no-underline"
                    >
                      {a.name} · {(a.size / 1024).toFixed(1)} KB
                    </a>
                    <button
                      type="button"
                      className="shrink-0 self-center cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-share"
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
