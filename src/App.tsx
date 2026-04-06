import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ModalProvider } from './context/ModalContext'
import { HomePage } from './pages/HomePage'
import { InboxPage } from './pages/InboxPage'
import { LoginPage } from './pages/LoginPage'
import { MyTasksPage } from './pages/MyTasksPage'
import { ProjectPage } from './pages/ProjectPage'
import { ProjectRedirect } from './pages/ProjectRedirect'
import { StatusSettingsPage } from './pages/StatusSettingsPage'

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center p-8">
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-full opacity-60" />
        </div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <ModalProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <AppLayout />
            </Protected>
          }
        >
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<HomePage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="project/:projectId" element={<ProjectRedirect />} />
          <Route path="project/:projectId/:view" element={<ProjectPage />} />
          <Route path="status" element={<StatusSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ModalProvider>
    </AuthProvider>
  )
}
