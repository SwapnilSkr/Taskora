import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutList } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { subscribeProjects } from '@/services/db'
import type { ProjectDoc } from '@/types/models'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'

type Props = { open: boolean; onClose: () => void }

export function CommandPalette({ open, onClose }: Props) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [projects, setProjects] = useState<ProjectDoc[]>([])

  const resetAndClose = useCallback(() => {
    setQ('')
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

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose()
      }}
      title="Search Taskora"
      description="Jump to a project or page"
      showCloseButton={false}
      className="top-[20%] max-w-[720px] translate-y-0"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Jump to project, view, or page…"
          value={q}
          onValueChange={(v) => setQ(v)}
        />
        <CommandList className="max-h-[min(560px,70vh)]">
          <CommandEmpty>No matches.</CommandEmpty>
          <CommandGroup heading="Results">
            {items.map((it) => (
              <CommandItem
                key={it.id}
                value={`${it.id}-${it.label}`}
                onSelect={() => it.run()}
              >
                <LayoutList className="size-4 shrink-0 opacity-70" />
                <span>{it.label}</span>
                {it.meta ? (
                  <CommandShortcut className="max-w-[45%] truncate">
                    {it.meta}
                  </CommandShortcut>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
