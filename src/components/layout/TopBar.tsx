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
import './layout.css'

type TopBarProps = {
  onOpenSearch: () => void
}

export function TopBar({ onOpenSearch }: TopBarProps) {
  const { user } = useAuth()
  const label = initials(user?.displayName || user?.email || 'You')

  return (
    <header className="top-header">
      <div className="header-nav-cluster">
        <button type="button" className="icon-btn" title="Back">
          <IconArrowLeft />
        </button>
        <button type="button" className="icon-btn" title="Forward">
          <IconArrowRight />
        </button>
        <button type="button" className="icon-btn" title="History">
          <IconClock />
        </button>
      </div>

      <button type="button" className="search-pill" onClick={onOpenSearch}>
        <IconSearch />
        <span>Search Taskora</span>
        <kbd>⌘K</kbd>
      </button>

      <div className="header-actions">
        <button type="button" className="icon-btn" title="Help">
          <IconHelp />
        </button>
        <div className="avatar" title={user?.email ?? ''}>
          {label}
        </div>
        <button type="button" className="btn-share">
          <IconUserPlus />
          Share
        </button>
        <button type="button" className="btn-ghost">
          <IconSliders />
          Customize
        </button>
      </div>
    </header>
  )
}
