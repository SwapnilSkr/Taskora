import type { ReactNode } from 'react'
import { updateProject } from '@/services/db'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Preset hex colors that read well as project dots on dark and light chrome. */
const PROJECT_COLOR_PRESETS = [
  '#7c5cff',
  '#5b6cfb',
  '#14b8a6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#e06d5e',
  '#ec4899',
  '#a855f7',
  '#64748b',
  '#ef4444',
  '#3b82f6',
] as const

function safeHex(color: string | undefined): string {
  if (!color) return '#7c5cff'
  const c = color.trim()
  if (/^#[0-9A-Fa-f]{6}$/.test(c)) return c
  if (/^#[0-9A-Fa-f]{3}$/.test(c)) {
    return (
      '#' +
      c[1]! +
      c[1]! +
      c[2]! +
      c[2]! +
      c[3]! +
      c[3]!
    )
  }
  return '#7c5cff'
}

type ProjectColorPickerProps = {
  uid: string
  projectId: string
  color: string
  /** Menu placement */
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  /** Optional trigger; default is a small swatch button for sidebars */
  trigger?: ReactNode
}

export function ProjectColorPicker({
  uid,
  projectId,
  color,
  align = 'start',
  side = 'right',
  sideOffset = 4,
  trigger,
}: ProjectColorPickerProps) {
  const display = color || '#7c5cff'
  const inputValue = safeHex(color)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring dark:hover:bg-white/10"
            aria-label="Change project color"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="h-2.5 w-2.5 rounded-[3px] ring-1 ring-inset ring-black/25 dark:ring-white/30"
              style={{ background: display }}
            />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={12}
        className="w-auto min-w-38 p-2"
      >
        <DropdownMenuLabel className="px-0 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Project color
        </DropdownMenuLabel>
        <div className="grid grid-cols-4 gap-1.5">
          {PROJECT_COLOR_PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              className="size-8 shrink-0 rounded-md border border-border shadow-sm outline-none ring-offset-background transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
              style={{ backgroundColor: hex }}
              title={hex}
              aria-label={`Use color ${hex}`}
              onClick={() => void updateProject(uid, projectId, { color: hex })}
            />
          ))}
        </div>
        <DropdownMenuSeparator className="my-2" />
        <div className="flex items-center justify-between gap-3 px-0.5">
          <span className="text-xs text-muted-foreground">Custom</span>
          <input
            type="color"
            value={inputValue}
            className="h-9 w-11 cursor-pointer rounded-md border border-border bg-card p-0.5"
            aria-label="Pick a custom color"
            onChange={(e) =>
              void updateProject(uid, projectId, { color: e.target.value })
            }
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
