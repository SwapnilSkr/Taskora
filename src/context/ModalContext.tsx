import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type ConfirmOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export type PromptOptions = {
  title: string
  message?: string
  label?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
}

export type AlertOptions = {
  title: string
  message: string
  okLabel?: string
}

type ModalCtx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  prompt: (opts: PromptOptions) => Promise<string | null>
  alert: (opts: AlertOptions) => Promise<void>
}

const Ctx = createContext<ModalCtx | null>(null)

type Active =
  | (ConfirmOptions & { kind: 'confirm' })
  | (PromptOptions & { kind: 'prompt' })
  | (AlertOptions & { kind: 'alert' })

export function ModalProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null)
  const [promptValue, setPromptValue] = useState('')
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null)
  const promptResolveRef = useRef<((v: string | null) => void) | null>(null)
  const alertResolveRef = useRef<(() => void) | null>(null)

  const finishConfirm = useCallback((value: boolean) => {
    const r = confirmResolveRef.current
    if (!r) return
    r(value)
    confirmResolveRef.current = null
    setActive(null)
  }, [])

  const finishPrompt = useCallback((value: string | null) => {
    const r = promptResolveRef.current
    if (!r) return
    r(value)
    promptResolveRef.current = null
    setActive(null)
  }, [])

  const finishAlert = useCallback(() => {
    const r = alertResolveRef.current
    if (!r) return
    r()
    alertResolveRef.current = null
    setActive(null)
  }, [])

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve
      setActive({ kind: 'confirm', ...opts })
    })
  }, [])

  const promptFn = useCallback((opts: PromptOptions) => {
    setPromptValue(opts.defaultValue ?? '')
    return new Promise<string | null>((resolve) => {
      promptResolveRef.current = resolve
      setActive({ kind: 'prompt', ...opts })
    })
  }, [])

  const alert = useCallback((opts: AlertOptions) => {
    return new Promise<void>((resolve) => {
      alertResolveRef.current = resolve
      setActive({ kind: 'alert', ...opts })
    })
  }, [])

  const value = useMemo(
    () => ({ confirm, prompt: promptFn, alert }),
    [confirm, promptFn, alert],
  )

  function handlePromptSubmit(e: FormEvent) {
    e.preventDefault()
    if (active?.kind !== 'prompt') return
    const trimmed = promptValue.trim()
    finishPrompt(trimmed === '' ? null : trimmed)
  }

  return (
    <Ctx.Provider value={value}>
      {children}

      <AlertDialog
        open={active?.kind === 'confirm'}
        onOpenChange={(open) => {
          if (!open) finishConfirm(false)
        }}
      >
        <AlertDialogContent className="max-w-md sm:text-left">
          {active?.kind === 'confirm' ? (
            <>
              <AlertDialogHeader className="text-left sm:text-left">
                <AlertDialogTitle>{active.title}</AlertDialogTitle>
                <AlertDialogDescription>{active.message}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{active.cancelLabel ?? 'Cancel'}</AlertDialogCancel>
                <AlertDialogAction
                  variant={active.danger ? 'destructive' : 'default'}
                  onClick={() => finishConfirm(true)}
                >
                  {active.confirmLabel ?? 'Confirm'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={active?.kind === 'alert'}
        onOpenChange={(open) => {
          if (!open) finishAlert()
        }}
      >
        <AlertDialogContent className="max-w-md sm:text-left">
          {active?.kind === 'alert' ? (
            <>
              <AlertDialogHeader className="text-left sm:text-left">
                <AlertDialogTitle>{active.title}</AlertDialogTitle>
                <AlertDialogDescription>{active.message}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogAction onClick={() => finishAlert()}>
                  {active.okLabel ?? 'OK'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={active?.kind === 'prompt'}
        onOpenChange={(open) => {
          if (!open) finishPrompt(null)
        }}
      >
        <DialogContent className="max-w-md" showCloseButton>
          {active?.kind === 'prompt' ? (
            <form onSubmit={handlePromptSubmit}>
              <DialogHeader>
                <DialogTitle>{active.title}</DialogTitle>
                {active.message ? (
                  <DialogDescription>{active.message}</DialogDescription>
                ) : null}
              </DialogHeader>
              {active.label ? (
                <div className="grid gap-2 py-2">
                  <Label htmlFor="app-prompt-input">{active.label}</Label>
                  <Input
                    id="app-prompt-input"
                    autoFocus
                    placeholder={active.placeholder}
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                  />
                </div>
              ) : (
                <Input
                  id="app-prompt-input"
                  className="mt-2"
                  autoFocus
                  placeholder={active.placeholder}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                />
              )}
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => finishPrompt(null)}
                >
                  {active.cancelLabel ?? 'Cancel'}
                </Button>
                <Button type="submit">{active.confirmLabel ?? 'Save'}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useModals(): ModalCtx {
  const x = useContext(Ctx)
  if (!x) throw new Error('useModals must be used within ModalProvider')
  return x
}
