import { format, isPast, isToday, isTomorrow } from 'date-fns'
import type { Timestamp } from 'firebase/firestore'

export function tsToDate(t: Timestamp | null | undefined): Date | null {
  if (!t) return null
  return t.toDate()
}

export function fmtDate(d: Date | null): string {
  if (!d) return '—'
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'MMM d')
}

export function fmtDateFull(d: Date | null): string {
  if (!d) return ''
  return format(d, 'EEE, MMM d, yyyy')
}

export function dueBadgeState(
  d: Date | null,
  completed: boolean,
): 'none' | 'soon' | 'overdue' {
  if (!d || completed) return 'none'
  const day = new Date(d)
  day.setHours(23, 59, 59, 999)
  if (isPast(day)) return 'overdue'
  return 'soon'
}

export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return '?'
  const p = name.trim().split(/\s+/).slice(0, 2)
  return p.map((x) => x[0]?.toUpperCase() ?? '').join('') || '?'
}

/** HTML date input value (YYYY-MM-DD). */
export function dateToInputValue(d: Date | null): string {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
