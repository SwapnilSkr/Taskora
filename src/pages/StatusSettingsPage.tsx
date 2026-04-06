import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useModals } from '@/context/ModalContext'
import {
  createStatus,
  deleteStatus,
  seedDefaultStatuses,
  subscribeStatuses,
  updateStatus,
} from '@/services/db'
import type { StatusDoc } from '@/types/models'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export function StatusSettingsPage() {
  const { user } = useAuth()
  const { confirm, prompt } = useModals()
  const [statuses, setStatuses] = useState<StatusDoc[]>([])
  const uid = user?.uid ?? ''

  useEffect(() => {
    if (!uid) return
    seedDefaultStatuses(uid).then(() => subscribeStatuses(uid, setStatuses))
  }, [uid])

  async function onAddStatus() {
    const name = await prompt({
      title: 'New status',
      label: 'Status name',
      placeholder: 'e.g. In Review',
      confirmLabel: 'Add',
    })
    if (!name?.trim()) return

    const maxSort =
      statuses.length > 0 ? Math.max(...statuses.map((s) => s.sortOrder)) : -1

    await createStatus(uid, {
      name: name.trim(),
      color: '#94a3b8',
      isCompleted: false,
      isDefault: false,
      sortOrder: maxSort + 1,
    })
  }

  async function onDelete(s: StatusDoc) {
    const ok = await confirm({
      title: 'Delete status',
      message: `Are you sure you want to delete "${s.name}"? Tasks using this status will have no status assigned.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) {
      await deleteStatus(uid, s.id)
    }
  }

  async function onToggleDefault(s: StatusDoc) {
    for (const other of statuses) {
      if (other.isDefault && other.id !== s.id) {
        await updateStatus(uid, other.id, { isDefault: false })
      }
    }
    await updateStatus(uid, s.id, { isDefault: true })
  }

  async function onToggleCompleted(s: StatusDoc) {
    await updateStatus(uid, s.id, { isCompleted: !s.isCompleted })
  }

  async function onRename(s: StatusDoc) {
    const name = await prompt({
      title: 'Rename status',
      label: 'New name',
      defaultValue: s.name,
      confirmLabel: 'Save',
    })
    if (name && name.trim() !== s.name) {
      await updateStatus(uid, s.id, { name: name.trim() })
    }
  }

  return (
    <div className="max-w-[800px] px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-7 md:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground mb-2 mt-0 text-[26px] font-bold tracking-tight">
            Status tags
          </h1>
          <p className="text-muted-foreground m-0">
            Manage the status options available for your tasks and subtasks.
          </p>
        </div>
        <Button className="shrink-0 font-bold" onClick={onAddStatus}>
          <Plus className="size-[18px]" />
          Add status
        </Button>
      </header>

      <div className="grid gap-3">
        {statuses.map((s) => (
          <Card
            key={s.id}
            className="border-border hover:border-primary/25 transition-colors"
          >
            <CardContent className="flex items-center gap-4 px-5 py-4">
              <div className="border-border relative size-8 shrink-0 overflow-hidden rounded-md border transition-transform active:scale-95">
                <input
                  className="absolute -left-2.5 -top-2.5 h-header w-header cursor-pointer border-none bg-transparent p-0"
                  type="color"
                  value={s.color}
                  onChange={(e) =>
                    updateStatus(uid, s.id, { color: e.target.value })
                  }
                  title="Change color"
                />
              </div>

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  className="hover:bg-accent -m-1.5 block rounded-md px-1.5 py-0.5 text-left text-base font-bold transition-colors"
                  onClick={() => onRename(s)}
                  title="Rename status"
                >
                  {s.name}
                </button>
                <div className="mt-2.5 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`def-${s.id}`}
                      checked={s.isDefault}
                      onCheckedChange={(c) => {
                        if (c === true) void onToggleDefault(s)
                      }}
                    />
                    <Label
                      htmlFor={`def-${s.id}`}
                      className="text-muted-foreground cursor-pointer text-xs font-medium"
                    >
                      Default
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`done-${s.id}`}
                      checked={s.isCompleted}
                      onCheckedChange={() => void onToggleCompleted(s)}
                    />
                    <Label
                      htmlFor={`done-${s.id}`}
                      className="text-muted-foreground cursor-pointer text-xs font-medium"
                    >
                      Completed
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge
                  className="border-transparent font-bold uppercase tracking-wide text-white opacity-90"
                  style={{ backgroundColor: s.color }}
                >
                  {s.name}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => onDelete(s)}
                  title="Delete status"
                >
                  <Trash2 className="size-[18px]" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {statuses.length === 0 && (
        <Card className="border-border border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No status tags found. Add one to get started!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
