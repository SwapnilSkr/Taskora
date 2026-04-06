import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Outlet } from 'react-router-dom'
import { CommandPalette } from '../CommandPalette'
import { SidebarContent, SidebarDesktop } from './Sidebar'
import { TopBar } from './TopBar'
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet'

const MD_UP_MQL = '(min-width: 768px)'

function useMdUp() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(MD_UP_MQL)
      mql.addEventListener('change', onStoreChange)
      return () => mql.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(MD_UP_MQL).matches,
    () => false,
  )
}

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const mdUp = useMdUp()

  const onOpenSearch = useCallback(() => setSearchOpen(true), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    function onGlobalSearch() {
      setSearchOpen(true)
    }
    window.addEventListener('taskora:open-search', onGlobalSearch)
    return () => window.removeEventListener('taskora:open-search', onGlobalSearch)
  }, [])

  const mobileSheetOpen = mobileNavOpen && !mdUp

  return (
    <div className="bg-background flex min-h-screen">
      {mdUp ? <SidebarDesktop /> : null}
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          showCloseButton
          className="border-border bg-sidebar text-sidebar-foreground w-[min(var(--spacing-sidebar),88vw)] max-w-none gap-0 border-r p-0 sm:w-sidebar [&>button]:text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <div className="flex h-full min-h-0 flex-1 flex-col pt-2">
            <SidebarContent
              onNavigate={() => setMobileNavOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onOpenSearch={onOpenSearch}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
