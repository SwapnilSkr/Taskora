import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useModals } from '../context/ModalContext'
import {
  createStatus,
  deleteStatus,
  seedDefaultStatuses,
  subscribeStatuses,
  updateStatus,
} from '../services/db'
import type { StatusDoc } from '../types/models'
import { IconPlus, IconTrash } from '../components/icons'

export function StatusSettingsPage() {
  const { user } = useAuth()
  const { confirm, prompt } = useModals()
  const [statuses, setStatuses] = useState<StatusDoc[]>([])
  const uid = user?.uid ?? ''

  useEffect(() => {
    if (!uid) return
    // Seed defaults if empty
    seedDefaultStatuses(uid).then(() => {
      return subscribeStatuses(uid, setStatuses)
    })
  }, [uid])

  async function onAddStatus() {
    const name = await prompt({
      title: 'New status',
      label: 'Status name',
      placeholder: 'e.g. In Review',
      confirmLabel: 'Add',
    })
    if (!name?.trim()) return

    const maxSort = statuses.length > 0 
      ? Math.max(...statuses.map(s => s.sortOrder)) 
      : -1
    
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
    // Only one default allowed
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
    <div className="max-w-[800px] px-8 pb-12 pt-7">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="mb-2 mt-0 text-[26px] font-bold tracking-tight">
            Status tags
          </h1>
          <p className="m-0 text-muted">
            Manage the status options available for your tasks and subtasks.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-pill bg-share px-3.5 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-share-hover"
          onClick={onAddStatus}
        >
          <IconPlus width={18} height={18} />
          Add status
        </button>
      </header>

      <div className="grid gap-3">
        {statuses.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-4 rounded-xl border border-border-subtle bg-raised px-5 py-4 transition-colors duration-150 hover:border-border hover:bg-hover-surface"
          >
            <div className="relative size-8 shrink-0 overflow-hidden rounded-card border border-border-subtle transition-transform active:scale-95">
              <input
                className="absolute -left-2.5 -top-2.5 h-header w-header cursor-pointer border-none bg-transparent p-0"
                type="color"
                value={s.color}
                onChange={(e) => updateStatus(uid, s.id, { color: e.target.value })}
                title="Change color"
              />
            </div>
            
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="-m-1.5 block rounded-md px-1.5 py-0.5 text-left text-base font-bold transition-colors hover:bg-hover-surface"
                onClick={() => onRename(s)}
                title="Rename status"
              >
                {s.name}
              </button>
              <div className="mt-2.5 flex gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-hover-surface hover:text-fg">
                  <input
                    className="size-3.5 cursor-pointer rounded border-[1.5px] border-placeholder accent-share"
                    type="checkbox"
                    checked={s.isDefault}
                    onChange={() => onToggleDefault(s)}
                  />
                  Default
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-hover-surface hover:text-fg">
                  <input
                    className="size-3.5 cursor-pointer rounded border-[1.5px] border-placeholder accent-share"
                    type="checkbox"
                    checked={s.isCompleted}
                    onChange={() => onToggleCompleted(s)}
                  />
                  Completed
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className="inline-block rounded-pill border border-transparent px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white opacity-[0.85]"
                style={{ backgroundColor: s.color }}
              >
                {s.name}
              </span>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-card text-muted transition-colors hover:bg-hover-surface hover:text-fg"
                onClick={() => onDelete(s)}
                title="Delete status"
              >
                <IconTrash width={18} height={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {statuses.length === 0 && (
        <div className="rounded-xl border border-dashed border-border-subtle py-12 text-center">
          <p className="text-muted">No status tags found. Add one to get started!</p>
        </div>
      )}
    </div>
  )
}
