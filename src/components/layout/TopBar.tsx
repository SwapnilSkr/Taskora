import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CircleHelp,
  Search,
  SlidersHorizontal,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { initials } from '@/utils/format'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'

type TopBarProps = {
  onOpenSearch: () => void
}

export function TopBar({ onOpenSearch }: TopBarProps) {
  const { user } = useAuth()
  const label = initials(user?.displayName || user?.email || 'You')

  return (
    <header className="border-border bg-background sticky top-0 z-20 flex h-header shrink-0 items-center gap-3 border-b py-0 pl-3 pr-4">
      <div className="flex items-center gap-0.5">
        <Button type="button" variant="ghost" size="icon" title="Back">
          <ArrowLeft className="size-[18px]" />
        </Button>
        <Button type="button" variant="ghost" size="icon" title="Forward">
          <ArrowRight className="size-[18px]" />
        </Button>
        <Button type="button" variant="ghost" size="icon" title="History">
          <Clock className="size-[18px]" />
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        className="text-muted-foreground mx-auto h-9 max-w-[560px] flex-1 justify-start gap-2.5 rounded-full px-3.5 text-[13px] font-normal shadow-none"
        onClick={onOpenSearch}
      >
        <Search className="size-4 shrink-0" />
        <span>Search Taskora</span>
        <Kbd className="ml-auto rounded border px-1.5 py-0.5 font-sans text-[11px]">
          ⌘K
        </Kbd>
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" title="Help">
          <CircleHelp className="size-[18px]" />
        </Button>
        <Avatar className="size-7" title={user?.email ?? ''}>
          <AvatarFallback className="bg-linear-to-br from-[#5b6cfb] to-[#9b6dff] text-[11px] font-bold text-white">
            {label}
          </AvatarFallback>
        </Avatar>
        <Button type="button" size="sm" className="rounded-full gap-1.5">
          <UserPlus className="size-4" />
          Share
        </Button>
        <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5">
          <SlidersHorizontal className="size-[18px]" />
          Customize
        </Button>
      </div>
    </header>
  )
}
