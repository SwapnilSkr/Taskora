import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useModals } from '@/context/ModalContext'
import { createProject, subscribeProjects } from '@/services/db'
import type { ProjectDoc } from '@/types/models'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function HomePage() {
  const { user } = useAuth()
  const { prompt } = useModals()
  const nav = useNavigate()
  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const uid = user?.uid ?? ''

  useEffect(() => {
    if (!uid) return
    return subscribeProjects(uid, setProjects)
  }, [uid])

  async function onCreate() {
    if (!uid) return
    const name = await prompt({
      title: 'Create project',
      message:
        'Projects hold sections, tasks, and every view (list, board, Gantt, and more).',
      label: 'Project name',
      defaultValue: 'New project',
      confirmLabel: 'Create',
    })
    if (!name?.trim()) return
    const id = await createProject(uid, name.trim())
    nav(`/project/${id}/list`)
  }

  return (
    <div className="px-8 pb-12 pt-7">
      <h1 className="text-foreground mb-2 mt-0 text-[26px] font-bold tracking-tight">
        Home
      </h1>
      <p className="text-muted-foreground m-0 max-w-[640px] leading-relaxed">
        Taskora mirrors the Asana-style workflows you expect — list, board, timeline, Gantt, approvals, workload, time tracking, dependencies, and attachments via Firebase Storage.
      </p>

      <div className="mt-7">
        <Button className="rounded-full font-semibold" onClick={() => void onCreate()}>
          New project
        </Button>
      </div>

      <div className="mt-7 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
        {projects.map((p) => (
          <Card
            key={p.id}
            className="border-border bg-card cursor-pointer transition-colors hover:border-primary/30"
            role="button"
            tabIndex={0}
            onClick={() => nav(`/project/${p.id}/list`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                nav(`/project/${p.id}/list`)
              }
            }}
          >
            <CardContent className="p-4 text-left">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-[3px]"
                  style={{ background: p.color }}
                />
                <span className="font-bold">{p.name}</span>
              </div>
              <div className="text-muted-foreground mt-2 text-xs">Open list view</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
