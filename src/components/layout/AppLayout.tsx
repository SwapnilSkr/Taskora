import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CommandPalette } from '../CommandPalette'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import './layout.css'

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
    <div className="app-shell">
      <Sidebar />
      <div className="main-col">
        <TopBar onOpenSearch={onOpenSearch} />
        <main className="main-scroll">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
