import { Menu, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { initials } from '@/utils/format'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'

type TopBarProps = {
  onOpenSearch: () => void
  onOpenMobileNav?: () => void
}

export function TopBar({ onOpenSearch, onOpenMobileNav }: TopBarProps) {
  const { user } = useAuth()
  const label = initials(user?.displayName || user?.email || 'You')

  return (
    <header className="border-border bg-background sticky top-0 z-20 flex h-header min-w-0 shrink-0 items-center gap-2 border-b py-0 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top,0px)] sm:gap-3">
      {onOpenMobileNav ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          title="Open menu"
          aria-label="Open menu"
          onClick={onOpenMobileNav}
        >
          <Menu className="size-[18px]" />
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="text-muted-foreground mx-auto h-9 min-w-0 max-w-[560px] flex-1 justify-start gap-2.5 rounded-full px-3.5 text-[13px] font-normal shadow-none"
        onClick={onOpenSearch}
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search Taskora</span>
        <Kbd className="ml-auto hidden shrink-0 rounded border px-1.5 py-0.5 font-sans text-[11px] sm:inline-flex">
          ⌘K
        </Kbd>
      </Button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Avatar className="size-7" title={user?.email ?? ''}>
          <AvatarFallback className="bg-linear-to-br from-[#5b6cfb] to-[#9b6dff] text-[11px] font-bold text-white">
            {label}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
