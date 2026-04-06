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
import '../components/layout/layout.css'

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
    <div style={{ padding: '28px 32px 48px', maxWidth: 800 }}>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: 26, letterSpacing: '-0.02em' }}>Status tags</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Manage the status options available for your tasks and subtasks.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={onAddStatus}>
          <IconPlus width={18} height={18} />
          Add status
        </button>
      </header>

      <div style={{ display: 'grid', gap: 12 }}>
        {statuses.map((s) => (
          <div key={s.id} className="status-settings-card">
            <div className="status-color-picker-wrap">
              <input 
                type="color" 
                value={s.color} 
                onChange={(e) => updateStatus(uid, s.id, { color: e.target.value })}
                title="Change color"
              />
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <button 
                type="button"
                className="linkish-btn-inline"
                style={{ fontWeight: 700, fontSize: 16, display: 'block', padding: '2px 6px', margin: '-2px -6px', borderRadius: 6, transition: 'background 0.15s' }}
                onClick={() => onRename(s)}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                title="Rename status"
              >
                {s.name}
              </button>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <label className="status-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={s.isDefault} 
                    onChange={() => onToggleDefault(s)}
                  />
                  Default
                </label>
                <label className="status-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={s.isCompleted} 
                    onChange={() => onToggleCompleted(s)}
                  />
                  Completed
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="status-badge" style={{ backgroundColor: s.color, opacity: 0.85, padding: '6px 12px' }}>
                {s.name}
              </span>
              <button 
                type="button" 
                className="btn-icon" 
                onClick={() => onDelete(s)}
                style={{ color: 'var(--text-muted)' }}
                title="Delete status"
              >
                <IconTrash width={18} height={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {statuses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', border: '1px dashed var(--border-subtle)', borderRadius: 12 }}>
          <p style={{ color: 'var(--text-muted)' }}>No status tags found. Add one to get started!</p>
        </div>
      )}
    </div>
  )
}
