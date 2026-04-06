import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeProjects } from '../services/db'
import type { ProjectDoc } from '../types/models'
import { IconList, IconSearch } from './icons'

type Props = { open: boolean; onClose: () => void }

export function CommandPalette({ open, onClose }: Props) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const [active, setActive] = useState(0)

  const resetAndClose = useCallback(() => {
    setQ('')
    setActive(0)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!user || !open) return
    const unsub = subscribeProjects(user.uid, setProjects)
    return () => unsub()
  }, [user, open])

  const items = useMemo(() => {
    const qq = q.trim().toLowerCase()
    const rows: { id: string; label: string; run: () => void; meta?: string }[] =
      []
    for (const p of projects) {
      if (!qq || p.name.toLowerCase().includes(qq)) {
        rows.push({
          id: `p-${p.id}`,
          label: p.name,
          meta: 'Open project · List',
          run: () => {
            nav(`/project/${p.id}/list`)
            resetAndClose()
          },
        })
        rows.push({
          id: `b-${p.id}`,
          label: `${p.name} — Board`,
          meta: 'Board view',
          run: () => {
            nav(`/project/${p.id}/board`)
            resetAndClose()
          },
        })
      }
    }
    if (!qq || 'my tasks'.includes(qq) || qq.includes('my')) {
      rows.push({
        id: 'my',
        label: 'My tasks',
        meta: 'Navigation',
        run: () => {
          nav('/my-tasks')
          resetAndClose()
        },
      })
    }
    if (!qq || 'inbox'.includes(qq)) {
      rows.push({
        id: 'inbox',
        label: 'Inbox',
        meta: 'Navigation',
        run: () => {
          nav('/inbox')
          resetAndClose()
        },
      })
    }
    if (!qq || 'home'.includes(qq)) {
      rows.push({
        id: 'home',
        label: 'Home',
        meta: 'Navigation',
        run: () => {
          nav('/home')
          resetAndClose()
        },
      })
    }
    return rows
  }, [projects, q, nav, resetAndClose])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') resetAndClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const row = items[active]
        row?.run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, active, resetAndClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center p-6" role="dialog" aria-modal="true" aria-label="Search">
      <button
        type="button"
        className="fixed inset-0 z-[90] cursor-default border-none bg-black/45 p-0"
        aria-label="Close"
        onClick={resetAndClose}
      />
      <div className="relative z-[100] w-full max-w-[720px] overflow-hidden rounded-[10px] border border-border bg-raised shadow-popover">
        <div className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-3.5">
          <IconSearch width={18} height={18} />
          <input
            className="min-w-0 flex-1 border-none bg-transparent text-base font-semibold outline-none"
            autoFocus
            placeholder="Jump to project, view, or page…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
          />
        </div>
        <div className="max-h-[min(560px,70vh)] overflow-auto p-2">
          {items.length === 0 ? (
            <div className="p-3 text-muted">No matches.</div>
          ) : (
            items.map((it, idx) => (
              <button
                key={it.id}
                type="button"
                className="flex w-full items-center gap-2.5 rounded-card px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-hover-surface data-[active=true]:bg-hover-surface"
                data-active={idx === active ? 'true' : 'false'}
                onMouseEnter={() => setActive(idx)}
                onClick={() => it.run()}
              >
                <IconList width={16} height={16} />
                <span>{it.label}</span>
                {it.meta ? (
                  <span className="ml-auto text-[11px] text-muted">{it.meta}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
