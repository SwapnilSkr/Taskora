import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Button } from '@/components/ui/button'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { NON_MODAL_DIALOG_OUTSIDE_GUARD_MS } from '@/utils/nonModalDialogGuard'

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

/** Centered dialog without Radix modal overlay (avoids react-remove-scroll resetting nested page scroll). */
function ModalGlass({
  open,
  onOpenChange,
  showCloseButton,
  contentClassName,
  role = 'dialog',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  showCloseButton?: boolean
  contentClassName?: string
  role?: 'dialog' | 'alertdialog'
  children: React.ReactNode
}) {
  const suppressOutsideDismissUntilRef = useRef(0)
  useLayoutEffect(() => {
    if (open) {
      suppressOutsideDismissUntilRef.current =
        Date.now() + NON_MODAL_DIALOG_OUTSIDE_GUARD_MS
    }
  }, [open])

  const onInteractOutside = useCallback(
    (event: { preventDefault: () => void }) => {
      if (Date.now() < suppressOutsideDismissUntilRef.current) {
        event.preventDefault()
      }
    },
    [],
  )

  return (
    <DialogPrimitive.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <div
          aria-hidden
          className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs"
        />
        <DialogPrimitive.Content
          role={role}
          onInteractOutside={onInteractOutside}
          className={cn(
            'fixed top-1/2 left-1/2 z-51 grid max-h-[min(calc(100vh-2rem),100%)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-md',
            'duration-100 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            contentClassName,
          )}
        >
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

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

  const confirmFooterClass =
    '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end'

  return (
    <Ctx.Provider value={value}>
      {children}

      <ModalGlass
        open={active?.kind === 'confirm'}
        onOpenChange={(open) => {
          if (!open) finishConfirm(false)
        }}
        role="alertdialog"
        contentClassName="sm:text-left"
      >
        {active?.kind === 'confirm' ? (
          <>
            <DialogHeader className="text-left sm:text-left">
              <DialogTitle>{active.title}</DialogTitle>
              <DialogDescription>{active.message}</DialogDescription>
            </DialogHeader>
            <div className={confirmFooterClass}>
              <Button
                type="button"
                variant="outline"
                onClick={() => finishConfirm(false)}
              >
                {active.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                type="button"
                variant={active.danger ? 'destructive' : 'default'}
                onClick={() => finishConfirm(true)}
              >
                {active.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </>
        ) : null}
      </ModalGlass>

      <ModalGlass
        open={active?.kind === 'alert'}
        onOpenChange={(open) => {
          if (!open) finishAlert()
        }}
        role="alertdialog"
        contentClassName="sm:text-left"
      >
        {active?.kind === 'alert' ? (
          <>
            <DialogHeader className="text-left sm:text-left">
              <DialogTitle>{active.title}</DialogTitle>
              <DialogDescription>{active.message}</DialogDescription>
            </DialogHeader>
            <div className={confirmFooterClass}>
              <Button type="button" onClick={() => finishAlert()}>
                {active.okLabel ?? 'OK'}
              </Button>
            </div>
          </>
        ) : null}
      </ModalGlass>

      <ModalGlass
        open={active?.kind === 'prompt'}
        onOpenChange={(open) => {
          if (!open) finishPrompt(null)
        }}
        showCloseButton
      >
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
      </ModalGlass>
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useModals(): ModalCtx {
  const x = useContext(Ctx)
  if (!x) throw new Error('useModals must be used within ModalProvider')
  return x
}
