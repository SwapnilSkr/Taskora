import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CommandPalette } from '../CommandPalette'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false)

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

  return (
    <div className="bg-background flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenSearch={onOpenSearch} />
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
