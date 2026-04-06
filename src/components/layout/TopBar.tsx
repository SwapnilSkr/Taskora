import { useAuth } from '../../context/AuthContext'
import { initials } from '../../utils/format'
import {
  IconArrowLeft,
  IconArrowRight,
  IconClock,
  IconHelp,
  IconSearch,
  IconSliders,
  IconUserPlus,
} from '../icons'

type TopBarProps = {
  onOpenSearch: () => void
}

const iconBtn =
  'grid size-8 place-items-center rounded-card text-muted transition-colors hover:bg-hover-surface hover:text-fg [&_svg]:size-[18px]'

export function TopBar({ onOpenSearch }: TopBarProps) {
  const { user } = useAuth()
  const label = initials(user?.displayName || user?.email || 'You')

  return (
    <header className="sticky top-0 z-20 flex h-header shrink-0 items-center gap-3 border-b border-border-subtle bg-app py-0 pl-3 pr-4">
      <div className="flex items-center gap-0.5">
        <button type="button" className={iconBtn} title="Back">
          <IconArrowLeft />
        </button>
        <button type="button" className={iconBtn} title="Forward">
          <IconArrowRight />
        </button>
        <button type="button" className={iconBtn} title="History">
          <IconClock />
        </button>
      </div>

      <button
        type="button"
        className="mx-auto flex max-w-[560px] flex-1 cursor-pointer items-center gap-2.5 rounded-pill border border-border bg-raised px-3.5 py-2 text-[13px] text-placeholder transition-colors hover:border-[#4a4b50] [&_svg]:size-4 [&_svg]:shrink-0"
        onClick={onOpenSearch}
      >
        <IconSearch />
        <span>Search Taskora</span>
        <kbd className="ml-auto rounded border border-border bg-app px-1.5 py-0.5 font-sans text-[11px] text-muted">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button type="button" className={iconBtn} title="Help">
          <IconHelp />
        </button>
        <div
          className="grid size-7 place-items-center rounded-pill bg-linear-to-br from-[#5b6cfb] to-[#9b6dff] text-[11px] font-bold text-white"
          title={user?.email ?? ''}
        >
          {label}
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-pill bg-share px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-share-hover [&_svg]:size-4"
        >
          <IconUserPlus />
          Share
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-pill border border-border bg-transparent px-2.5 py-1.5 text-[13px] font-semibold text-fg transition-colors hover:bg-hover-surface [&_svg]:size-[18px]"
        >
          <IconSliders />
          Customize
        </button>
      </div>
    </header>
  )
}
