import { Timestamp } from 'firebase/firestore'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useModals } from '@/context/ModalContext'
import { RichTextContent } from '@/components/RichTextContent'
import {
  TaskTipTapEditor,
  type TaskTipTapEditorRef,
} from '@/components/TaskTipTapEditor'
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
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SheetHeader } from '@/components/ui/sheet'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { XIcon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { markdownImageLine } from '@/utils/imagePaste'
import { cn } from '@/lib/utils'

type Props = {
  uid: string
  projectId: string
  task: TaskDoc | null
  allTasks: TaskDoc[]
  onClose: () => void
  onSaved: () => void
  onOpenTask?: (task: TaskDoc) => void
  /** Centered modal (e.g. board) vs right sheet (default). */
  presentation?: 'sheet' | 'dialog'
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

/** B2B task detail: grouped surfaces, subdued labels, elevated controls */
const detailScrollArea =
  'min-h-0 flex-1 overflow-auto bg-muted/5 px-5 py-5 dark:bg-background/40'
const detailSection =
  'rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm ring-1 ring-foreground/5 dark:bg-card/40 dark:ring-white/10'
const detailSectionHeading =
  'text-sm font-semibold leading-tight tracking-tight text-foreground'
const detailFieldLabel =
  'mb-1.5 block text-xs font-medium text-muted-foreground'
const detailControl =
  'h-9 w-full rounded-lg border border-border/70 bg-background px-3 text-[13px] shadow-sm transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 dark:bg-background/85'
const detailSecondaryAction =
  'h-auto rounded-md px-2 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground'

export function TaskDetailPanel({
  uid,
  projectId,
  task,
  allTasks,
  onClose,
  onSaved,
  onOpenTask,
  presentation = 'sheet',
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
  const descWysiwygRef = useRef<TaskTipTapEditorRef>(null)
  const commentWysiwygRef = useRef<TaskTipTapEditorRef>(null)
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

  const taskId = task?.id
  useLayoutEffect(() => {
    setCommentText('')
  }, [taskId])

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
    if (nextDescription.includes('blob:')) return
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

  const panel = (
    <>
        <SheetHeader
          className={cn(
            'space-y-0 border-b border-border/70 bg-muted/15 px-5 py-5 text-left backdrop-blur-sm sm:text-left dark:bg-muted/10',
            presentation === 'dialog' && 'pr-16',
          )}
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
            <p className="col-start-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
              Task
            </p>
            <Checkbox
              className="col-start-1 row-start-2 size-5 shrink-0 self-center"
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
            <Input
              className="col-start-2 row-start-2 h-auto min-h-0 border-0 border-transparent bg-transparent px-0 py-0 text-xl font-semibold tracking-tight text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent md:text-[1.35rem]"
              value={t.title}
              onChange={(e) => void savePatch({ title: e.target.value })}
              placeholder="Untitled task"
            />
          </div>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex min-h-0 flex-1 flex-col bg-background/40 dark:bg-background/25"
        >
          <TabsList
            variant="line"
            className="h-auto w-full justify-start gap-0.5 rounded-none border-b border-border/70 bg-muted/20 px-4 pt-1 dark:bg-muted/10"
          >
            {tabItems.map(([k, lab]) => (
              <TabsTrigger
                key={k}
                value={k}
                className="rounded-t-lg px-4 pb-3.5 pt-3 text-[13px] font-medium text-muted-foreground data-active:font-semibold data-active:text-foreground"
              >
                {lab}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className={detailScrollArea}>
            <TabsContent value="details" className="mt-0 space-y-5">
              <section className={detailSection} aria-label="Description">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-3">
                  <div>
                    <h3 className={detailSectionHeading}>Description</h3>
                    <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
                      TipTap editor: headings, lists, links, and more. Paste or attach
                      images (⌘V / Ctrl+V).
                    </p>
                  </div>
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
                    variant="ghost"
                    size="sm"
                    className={cn(detailSecondaryAction, 'shrink-0')}
                    disabled={imageUploadBusy !== 'idle'}
                    onClick={() => descImageInputRef.current?.click()}
                  >
                    Attach image
                  </Button>
                </div>
                <TaskTipTapEditor
                  ref={descWysiwygRef}
                  documentKey={t.id}
                  markdown={t.description}
                  onMarkdownChange={(md) => void saveDescriptionNext(md)}
                  disabled={false}
                  placeholder="What is this task about?"
                  className="w-full"
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
              </section>

              <section className={detailSection} aria-label="Schedule and assignment">
                <h3 className={cn(detailSectionHeading, 'mb-4')}>
                  Schedule & assignment
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className={detailFieldLabel}>Start date</Label>
                    <Input
                      type="date"
                      className={detailControl}
                      value={dateInputValue(tsToDate(t.startDate))}
                      onChange={(e) =>
                        void savePatch({ startDate: fromDateInput(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label className={detailFieldLabel}>Due date</Label>
                    <Input
                      type="date"
                      className={detailControl}
                      value={dateInputValue(tsToDate(t.dueDate))}
                      onChange={(e) =>
                        void savePatch({ dueDate: fromDateInput(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label className={detailFieldLabel}>Status</Label>
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
                      <SelectTrigger className={cn(detailControl, 'flex w-full justify-between py-0 pr-2')}>
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
                  <div>
                    <Label className={detailFieldLabel}>Priority</Label>
                    <Select
                      value={t.priority}
                      onValueChange={(v) =>
                        void savePatch({
                          priority: v as TaskDoc['priority'],
                        })
                      }
                    >
                      <SelectTrigger className={cn(detailControl, 'flex w-full justify-between py-0 pr-2')}>
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
                  <div>
                    <Label className={detailFieldLabel}>Assignee</Label>
                    <Select
                      value={t.assigneeId ?? UNASSIGNED}
                      onValueChange={(v) =>
                        void savePatch({
                          assigneeId: v === UNASSIGNED ? null : v,
                        })
                      }
                    >
                      <SelectTrigger className={cn(detailControl, 'flex w-full justify-between py-0 pr-2')}>
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
                  <div>
                    <Label className={detailFieldLabel}>Approval</Label>
                    <Select
                      value={t.approvalStatus}
                      onValueChange={(v) =>
                        void savePatch({
                          approvalStatus: v as TaskDoc['approvalStatus'],
                        })
                      }
                    >
                      <SelectTrigger className={cn(detailControl, 'flex w-full justify-between py-0 pr-2')}>
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
              </section>

              <section className={detailSection} aria-label="Time tracking">
                <h3 className={cn(detailSectionHeading, 'mb-4')}>Time tracking</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className={detailFieldLabel}>Estimate (minutes)</Label>
                    <Input
                      type="number"
                      className={detailControl}
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
                    <Label className={detailFieldLabel}>Tracked (minutes)</Label>
                    <Input
                      type="number"
                      className={detailControl}
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
              </section>

              <section className={detailSection} aria-label="Organization">
                <h3 className={cn(detailSectionHeading, 'mb-4')}>Organization</h3>
                <div className="space-y-4">
                  <div>
                    <Label className={detailFieldLabel}>Tags</Label>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {t.tags.map((tag) => (
                        <Button
                          key={tag}
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-full border border-border/60 bg-muted/50 px-3 text-xs font-medium shadow-sm"
                          onClick={() =>
                            void savePatch({ tags: t.tags.filter((x) => x !== tag) })
                          }
                          title="Remove tag"
                        >
                          {tag}
                          <span className="text-muted-foreground"> ×</span>
                        </Button>
                      ))}
                      <Input
                        className={cn(detailControl, 'min-w-32 flex-1')}
                        placeholder="Add tag, press Enter"
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
                  <div>
                    <Label className={detailFieldLabel}>
                      Dependencies{' '}
                      <span className="font-normal text-muted-foreground/80">
                        (task IDs, comma-separated)
                      </span>
                    </Label>
                    <Input
                      className={cn(detailControl, 'font-mono text-[12px]')}
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
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg border-destructive/40 font-medium text-destructive shadow-sm hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/15"
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
                <p className="text-xs font-medium tabular-nums text-muted-foreground">
                  Updated {fmtDateFull(tsToDate(t.updatedAt))}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="subtasks" className="mt-0 space-y-3">
              {!isSubtask ? (
                <div className="space-y-3">
                  {subtasks.map((st) => (
                    <Card
                      key={st.id}
                      className="border-border/60 bg-card/50 shadow-sm ring-1 ring-foreground/5 dark:ring-white/10"
                    >
                      <CardContent className="px-4 py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto w-full justify-start px-2 py-1.5 text-left text-[13px] font-semibold tracking-tight text-foreground hover:bg-muted/80"
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
                    className="mt-1 rounded-lg border-dashed font-medium shadow-sm"
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

            <TabsContent value="comments" className="mt-0 space-y-4">
              <div className="space-y-0">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="border-b border-border/60 py-4 text-[13px] last:border-b-0"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2.5 text-xs font-medium text-muted-foreground">
                      <span>
                        {c.authorName || 'Teammate'} ·{' '}
                        {fmtDateFull(tsToDate(c.createdAt))}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(detailSecondaryAction, 'shrink-0')}
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
                    <div className="rounded-lg bg-muted/25 px-3 py-2.5 text-[13px] leading-relaxed text-foreground dark:bg-muted/15">
                      <RichTextContent text={c.text} />
                    </div>
                  </div>
                ))}
                <section className={cn(detailSection, 'mt-2')}>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className={detailSectionHeading}>New comment</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Rich formatting and images — paste or attach below.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
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
                          commentWysiwygRef.current?.appendImageMarkdown(
                            markdownImageLine(blobUrl, f.name.slice(0, 40)),
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
                              commentWysiwygRef.current?.replaceMarkdownUrl(
                                blobUrl,
                                url,
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
                        variant="ghost"
                        size="sm"
                        className={cn(detailSecondaryAction, 'shrink-0')}
                        disabled={imageUploadBusy !== 'idle'}
                        onClick={() => commentImageInputRef.current?.click()}
                      >
                        Attach image
                      </Button>
                    </div>
                  </div>
                <TaskTipTapEditor
                  ref={commentWysiwygRef}
                  documentKey={t.id}
                  markdown={commentText}
                  onMarkdownChange={setCommentText}
                  debounceMs={0}
                  placeholder="Add a comment…"
                  className="w-full"
                  minEditorHeightClass="min-h-[240px]"
                  onPasteImageBlob={async (blob) => {
                    setImageUploadBusy('comment')
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
                {imageUploadBusy === 'comment' ? (
                  <p className="text-muted-foreground mt-1.5 text-[11px] font-medium normal-case tracking-normal opacity-90">
                    Finishing image upload…
                  </p>
                ) : null}
                <Button
                  type="button"
                  className="mt-3 w-full rounded-lg font-semibold shadow-sm"
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
                      commentWysiwygRef.current?.clearDocument()
                      onSaved()
                    })
                  }}
                >
                  Comment
                </Button>
                </section>
              </div>
            </TabsContent>

            <TabsContent value="files" className="mt-0">
              <section className={detailSection}>
                <h3 className={cn(detailSectionHeading, 'mb-3')}>Upload</h3>
                <Input
                  type="file"
                  className={cn(detailControl, 'h-auto cursor-pointer py-2 text-[13px]')}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (!f) return
                    void uploadTaskFile(uid, projectId, t.id, f).then(onSaved)
                  }}
                />
                <h3 className={cn(detailSectionHeading, 'mb-3 mt-6')}>
                  Attachments
                </h3>
                <div className="grid gap-2">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-stretch gap-2.5">
                      <a
                        href={a.downloadURL}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-[13px] font-semibold text-foreground no-underline shadow-sm transition-colors hover:bg-muted/35"
                      >
                        {a.name} · {(a.size / 1024).toFixed(1)} KB
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(detailSecondaryAction, 'shrink-0 self-center text-destructive hover:bg-destructive/10')}
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
              </section>
            </TabsContent>
          </div>
        </Tabs>
    </>
  )

  if (presentation === 'dialog') {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          showCloseButton
          className={cn(
            'flex h-[80vh] max-h-[80dvh] w-[min(90vw,36rem)] max-w-[min(90vw,36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(90vw,36rem)]',
            'rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-2xl ring-1 ring-black/5 dark:bg-popover dark:ring-white/10',
          )}
        >
          {panel}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <DialogPrimitive.Root
      modal={false}
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        {/* Modal sheet overlay uses react-remove-scroll and breaks nested page scroll; plain backdrop + non-modal root avoids that. */}
        <div
          aria-hidden
          className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-51 flex h-full w-3/4 max-w-full flex-col gap-0 overflow-hidden border-l border-border/70 bg-popover p-0 text-sm text-popover-foreground outline-none',
            'shadow-[-24px_0_48px_-24px_rgba(0,0,0,0.18)] dark:shadow-[-24px_0_56px_-24px_rgba(0,0,0,0.55)]',
            'duration-200 ease-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-10',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-10',
            'sm:max-w-[min(56vw,560px)]',
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {t.title.trim() || 'Task details'}
          </DialogPrimitive.Title>
          {panel}
          <DialogPrimitive.Close asChild>
            <Button
              variant="ghost"
              className="absolute top-3 right-3"
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
