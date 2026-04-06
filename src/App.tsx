import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AuthProvider, useAuth } from './context/AuthContext'
import { HomePage } from './pages/HomePage'
import { InboxPage } from './pages/InboxPage'
import { LoginPage } from './pages/LoginPage'
import { MyTasksPage } from './pages/MyTasksPage'
import { ProjectPage } from './pages/ProjectPage'
import { ProjectRedirect } from './pages/ProjectRedirect'

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <div style={{ padding: 32, color: 'var(--text-muted)' }}>Loading…</div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
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
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
