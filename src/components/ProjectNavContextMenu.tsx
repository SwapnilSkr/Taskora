import type { ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useModals } from '@/context/ModalContext'
import { deleteProject, updateProject } from '@/services/db'
import type { ProjectDoc } from '@/types/models'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { deferContextMenuAction } from '@/utils/listTaskRowOpen'

type ProjectNavContextMenuProps = {
  uid: string
  project: ProjectDoc
  children: ReactElement
}

export function ProjectNavContextMenu({
  uid,
  project,
  children,
}: ProjectNavContextMenuProps) {
  const nav = useNavigate()
  const loc = useLocation()
  const { prompt, confirm } = useModals()
  const pid = project.id

  async function runRename() {
    const name = await prompt({
      title: 'Rename project',
      message: 'This name appears in the sidebar, home, and command palette.',
      label: 'Project name',
      defaultValue: project.name,
      confirmLabel: 'Save',
    })
    if (!name?.trim()) return
    await updateProject(uid, pid, { name: name.trim() })
  }

  async function runDelete() {
    const ok = await confirm({
      title: 'Delete project',
      message: `Permanently delete “${project.name}” and all of its sections, tasks, subtasks, comments, and attachments? This cannot be undone.`,
      confirmLabel: 'Delete project',
      danger: true,
    })
    if (!ok) return
    await deleteProject(uid, pid)
    if (loc.pathname.startsWith(`/project/${pid}`)) {
      nav('/home', { replace: true })
    }
  }

  return (
    <ContextMenu modal={false}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() =>
            deferContextMenuAction(() => nav(`/project/${pid}/list`))
          }
        >
          Open list
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() =>
            deferContextMenuAction(() => nav(`/project/${pid}/board`))
          }
        >
          Open board
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() =>
            deferContextMenuAction(() =>
              void updateProject(uid, pid, { starred: !project.starred }),
            )
          }
        >
          {project.starred ? 'Remove star' : 'Star project'}
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => deferContextMenuAction(() => void runRename())}
        >
          Rename project…
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onSelect={() => deferContextMenuAction(() => void runDelete())}
        >
          Delete project…
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
