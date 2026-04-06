import { Timestamp } from 'firebase/firestore'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useModals } from '@/context/ModalContext'
import {
  DescriptionWysiwyg,
  type DescriptionWysiwygRef,
} from '@/components/DescriptionWysiwyg'
import { RichTextContent } from '@/components/RichTextContent'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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
} from '@/services/db'
import { uploadTaskFile, uploadTaskImageBlob } from '@/services/storage'
import type { AttachmentMeta, CommentDoc, StatusDoc, TaskDoc } from '@/types/models'
import { fmtDateFull, tsToDate } from '@/utils/format'
import {
  firstImageFromClipboard,
  markdownImageLine,
  textHasMarkdownImages,
} from '@/utils/imagePaste'

type Props = {
  uid: string
  projectId: string
  task: TaskDoc | null
  allTasks: TaskDoc[]
  onClose: () => void
  onSaved: () => void
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

const NONE = '__none__'
const UNASSIGNED = '__unassigned__'

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
  const [imageUploadBusy, setImageUploadBusy] = useState<
    'idle' | 'desc' | 'comment'
  >('idle')
  const descImageInputRef = useRef<HTMLInputElement>(null)
  const commentImageInputRef = useRef<HTMLInputElement>(null)
  const descWysiwygRef = useRef<DescriptionWysiwygRef>(null)
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
    () => allTasks.filter((x) => x.parentTaskId === task?.id),
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

  const tabItems = (
    [
      ['details', 'Details'] as const,
      ...(!isSubtask
        ? ([['subtasks', `Subtasks (${subtasks.length})`]] as const)
        : []),
      ['comments', `Comments (${comments.length})`] as const,
      ['files', `Files (${attachments.length})`] as const,
    ] as const
  ) satisfies readonly (readonly [typeof tab, string])[]

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="h-full w-full gap-0 p-0 sm:max-w-[520px] flex flex-col"
      >
        <SheetHeader className="border-border space-y-0 border-b px-[18px] py-4 text-left sm:text-left">
          <div className="flex items-start gap-2.5">
            <div className="pt-0.5">
              <Checkbox
                checked={t.completed}
                onCheckedChange={() => {
                  const comp = statuses.find((s) => s.isCompleted)
                  const def = statuses.find((s) => s.isDefault)
                  void savePatch({
                    completed: !t.completed,
                    statusId: !t.completed
                      ? (comp?.id ?? null)
                      : (def?.id ?? null),
                  })
                }}
                aria-label="Mark complete"
              />
            </div>
            <Input
              className="text-foreground border-none bg-transparent px-0 text-lg font-bold shadow-none focus-visible:ring-0"
              value={t.title}
              onChange={(e) => void savePatch({ title: e.target.value })}
            />
          </div>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList
            variant="line"
            className="border-border w-full justify-start gap-0 rounded-none border-b bg-transparent px-3.5 pt-1"
          >
            {tabItems.map(([k, lab]) => (
              <TabsTrigger
                key={k}
                value={k}
                className="rounded-none px-3 pb-3 pt-2.5 text-[13px] font-semibold data-active:shadow-none"
              >
                {lab}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-auto px-[18px] py-4">
            <TabsContent value="details" className="mt-0">
              <div className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2 first:mt-0">
                <span className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                  Description
                </span>
                <span className="text-muted-foreground text-[11px] font-medium normal-case tracking-normal opacity-90">
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
                <Button
                  type="button"
                  variant="link"
                  className="text-primary ml-auto h-auto p-0 text-[12px] font-semibold disabled:opacity-45"
                  disabled={imageUploadBusy !== 'idle'}
                  onClick={() => descImageInputRef.current?.click()}
                >
                  Attach image
                </Button>
              </div>
              <DescriptionWysiwyg
                ref={descWysiwygRef}
                markdown={t.description}
                onMarkdownChange={(md) => void saveDescriptionNext(md)}
                disabled={false}
                placeholder="What is this task about?"
                className="border-input bg-background text-foreground min-h-[100px] w-full resize-y rounded-md border px-3 py-2 text-[13px] leading-[1.45]"
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

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">
                    Start date
                  </Label>
                  <Input
                    type="date"
                    className="text-[13px]"
                    value={dateInputValue(tsToDate(t.startDate))}
                    onChange={(e) =>
                      void savePatch({ startDate: fromDateInput(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">
                    Due date
                  </Label>
                  <Input
                    type="date"
                    className="text-[13px]"
                    value={dateInputValue(tsToDate(t.dueDate))}
                    onChange={(e) =>
                      void savePatch({ dueDate: fromDateInput(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">
                    Status
                  </Label>
                  <Select
                    value={t.statusId ?? NONE}
                    onValueChange={(sid) => {
                      const real = sid === NONE ? null : sid
                      const s = statuses.find((x) => x.id === real)
                      void savePatch({
                        statusId: real,
                        completed: s?.isCompleted ?? false,
                      })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No status</SelectItem>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">
                    Priority
                  </Label>
                  <Select
                    value={t.priority}
                    onValueChange={(v) =>
                      void savePatch({
                        priority: v as TaskDoc['priority'],
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">
                    Assignee
                  </Label>
                  <Select
                    value={t.assigneeId ?? UNASSIGNED}
                    onValueChange={(v) =>
                      void savePatch({
                        assigneeId: v === UNASSIGNED ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      <SelectItem value={uid}>
                        Me ({user?.displayName || user?.email || 'self'})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">
                    Approval
                  </Label>
                  <Select
                    value={t.approvalStatus}
                    onValueChange={(v) =>
                      void savePatch({
                        approvalStatus: v as TaskDoc['approvalStatus'],
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="pending">Pending approval</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">
                    Estimate (minutes)
                  </Label>
                  <Input
                    type="number"
                    className="text-[13px]"
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
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider">
                    Tracked (minutes)
                  </Label>
                  <Input
                    type="number"
                    className="text-[13px]"
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

              <div className="mt-3">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Tags
                </Label>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {t.tags.map((tag) => (
                    <Button
                      key={tag}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 rounded-full px-2.5 text-xs font-normal"
                      onClick={() =>
                        void savePatch({ tags: t.tags.filter((x) => x !== tag) })
                      }
                      title="Remove tag"
                    >
                      {tag} ×
                    </Button>
                  ))}
                  <Input
                    className="text-[13px]"
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
              </div>

              <div className="mt-3 space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wider">
                  Dependencies (task ids, comma-separated)
                </Label>
                <Input
                  className="text-[13px]"
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
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
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
                </Button>
                <div className="flex-1" />
                <p className="text-muted-foreground self-center text-xs">
                  Updated {fmtDateFull(tsToDate(t.updatedAt))}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="subtasks" className="mt-0">
              {!isSubtask ? (
                <div>
                  {subtasks.map((st) => (
                    <Card key={st.id} className="border-border mb-2">
                      <CardContent className="px-2.5 py-2.5 text-[13px] font-semibold">
                        <Button
                          type="button"
                          variant="link"
                          className="text-primary h-auto w-full justify-start p-0 font-semibold"
                          onClick={() => {
                            setTab('details')
                            onOpenTask?.(st)
                          }}
                        >
                          {st.title}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2.5 rounded-full font-semibold"
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
                  </Button>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="comments" className="mt-0">
              <div>
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="border-border border-b py-2.5 text-[13px]"
                  >
                    <div className="text-muted-foreground mb-1 flex items-center justify-between gap-2.5 text-xs">
                      <span>
                        {c.authorName || 'Teammate'} ·{' '}
                        {fmtDateFull(tsToDate(c.createdAt))}
                      </span>
                      <Button
                        type="button"
                        variant="link"
                        className="text-primary h-auto shrink-0 p-0 text-[12px] font-semibold"
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
                      </Button>
                    </div>
                    <div className="text-foreground text-[13px]">
                      <RichTextContent text={c.text} />
                    </div>
                  </div>
                ))}
                <div className="text-muted-foreground mt-3.5 mb-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[11px] font-bold uppercase tracking-wider">
                  <span>New comment</span>
                  <span className="text-[11px] font-medium normal-case tracking-normal opacity-90">
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
                        (prev) =>
                          prev + markdownImageLine(blobUrl, f.name.slice(0, 40)),
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
                  <Button
                    type="button"
                    variant="link"
                    className="text-primary ml-auto h-auto p-0 text-[12px] font-semibold disabled:opacity-45"
                    disabled={imageUploadBusy !== 'idle'}
                    onClick={() => commentImageInputRef.current?.click()}
                  >
                    Attach image
                  </Button>
                </div>
                <Textarea
                  className="border-input bg-background min-h-[100px] text-[13px] leading-[1.45]"
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
                  <div className="mt-2">
                    <div className="text-muted-foreground mb-1.5 text-[11px] font-bold uppercase tracking-wider">
                      Preview
                    </div>
                    <div className="border-border bg-background text-foreground rounded-md border px-3 py-2.5 text-[13px]">
                      <RichTextContent text={commentText} />
                    </div>
                  </div>
                ) : null}
                {imageUploadBusy === 'comment' ? (
                  <p className="text-muted-foreground mt-1.5 text-[11px] font-medium normal-case tracking-normal opacity-90">
                    Finishing image upload…
                  </p>
                ) : null}
                <Button
                  type="button"
                  className="mt-2.5 w-full rounded-full font-bold"
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
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="files" className="mt-0">
              <div>
                <Input
                  type="file"
                  className="cursor-pointer text-[13px]"
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
                        className="border-border bg-card text-foreground min-w-0 flex-1 rounded-lg border px-2.5 py-2.5 text-[13px] font-semibold no-underline"
                      >
                        {a.name} · {(a.size / 1024).toFixed(1)} KB
                      </a>
                      <Button
                        type="button"
                        variant="link"
                        className="text-primary h-auto shrink-0 self-center p-0 text-[12px] font-semibold"
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
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
