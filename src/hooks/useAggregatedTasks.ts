import { useEffect, useMemo, useState } from 'react'
import { subscribeProjects, subscribeTasks } from '../services/db'
import type { ProjectDoc, TaskDoc } from '../types/models'

export function useAggregatedTasks(uid: string | undefined) {
  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const [byProject, setByProject] = useState<Record<string, TaskDoc[]>>({})

  useEffect(() => {
    if (!uid) return
    return subscribeProjects(uid, setProjects)
  }, [uid])

  const ids = useMemo(
    () =>
      projects
        .map((p) => p.id)
        .slice()
        .sort()
        .join('|'),
    [projects],
  )

  useEffect(() => {
    if (!uid || projects.length === 0) return
    const list = projects
    const unsubs = list.map((p) =>
      subscribeTasks(uid, p.id, (nextTasks) => {
        setByProject((prev) => ({ ...prev, [p.id]: nextTasks }))
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [uid, ids]) // eslint-disable-line react-hooks/exhaustive-deps -- `ids` tracks membership; `projects` read from latest render

  const rows = useMemo(() => {
    const out: { project: ProjectDoc; task: TaskDoc }[] = []
    for (const p of projects) {
      const list = byProject[p.id] ?? []
      for (const t of list) {
        if (!t.parentTaskId) out.push({ project: p, task: t })
      }
    }
    return out
  }, [projects, byProject])

  return { projects, byProject, rows }
}
