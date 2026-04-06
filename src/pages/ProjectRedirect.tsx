import { Navigate, useParams } from 'react-router-dom'

export function ProjectRedirect() {
  const { projectId } = useParams<{ projectId: string }>()
  if (!projectId) return <Navigate to="/home" replace />
  return <Navigate to={`/project/${projectId}/list`} replace />
}
