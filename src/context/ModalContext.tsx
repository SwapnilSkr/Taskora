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
import clsx from 'clsx'

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
  | (ConfirmOptions & { kind: 'confirm'; resolve: (v: boolean) => void })
  | (PromptOptions & {
      kind: 'prompt'
      resolve: (v: string | null) => void
    })
  | (AlertOptions & { kind: 'alert'; resolve: () => void })

export function ModalProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Active | null>(null)
  const [promptValue, setPromptValue] = useState('')
  const seq = useRef(0)

  const close = useCallback(() => setActive(null), [])

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      seq.current += 1
      setActive({ kind: 'confirm', resolve, ...opts })
    })
  }, [])

  const promptFn = useCallback((opts: PromptOptions) => {
    setPromptValue(opts.defaultValue ?? '')
    return new Promise<string | null>((resolve) => {
      seq.current += 1
      setActive({ kind: 'prompt', resolve, ...opts })
    })
  }, [])

  const alert = useCallback((opts: AlertOptions) => {
    return new Promise<void>((resolve) => {
      seq.current += 1
      setActive({ kind: 'alert', resolve, ...opts })
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
    active.resolve(trimmed === '' ? null : trimmed)
    close()
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      {active ? (
        <div
          className="pointer-events-none fixed inset-0 z-500 grid place-items-center p-6"
          role="presentation"
        >
          <button
            type="button"
            className="pointer-events-auto fixed inset-0 z-0 cursor-default border-none bg-black/55 p-0"
            aria-label="Close"
            onClick={() => {
              if (active.kind === 'confirm') active.resolve(false)
              else if (active.kind === 'prompt') active.resolve(null)
              else active.resolve()
              close()
            }}
          />
          <div
            className="pointer-events-auto relative z-1 max-h-[min(80vh,560px)] w-full max-w-[420px] overflow-auto rounded-xl border border-border bg-raised p-[22px] pb-[18px] shadow-popover"
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-modal-title"
          >
            <h2
              id="app-modal-title"
              className="m-0 mb-3 text-lg font-bold leading-tight tracking-tight"
            >
              {active.title}
            </h2>
            {active.kind === 'confirm' ? (
              <>
                <p className="m-0 mb-[18px] text-sm leading-normal text-muted">
                  {active.message}
                </p>
                <div className="flex flex-wrap justify-end gap-2.5">
                  <button
                    type="button"
                    className="rounded-pill border border-border bg-transparent px-[18px] py-2 text-[13px] font-semibold transition-colors hover:bg-hover-surface"
                    onClick={() => {
                      active.resolve(false)
                      close()
                    }}
                  >
                    {active.cancelLabel ?? 'Cancel'}
                  </button>
                  <button
                    type="button"
                    className={clsx(
                      'rounded-pill px-[18px] py-2 text-[13px] font-bold text-white transition-colors',
                      active.danger
                        ? 'bg-danger hover:bg-danger-hover'
                        : 'bg-share hover:bg-share-hover',
                    )}
                    onClick={() => {
                      active.resolve(true)
                      close()
                    }}
                  >
                    {active.confirmLabel ?? 'Confirm'}
                  </button>
                </div>
              </>
            ) : null}
            {active.kind === 'alert' ? (
              <>
                <p className="m-0 mb-[18px] text-sm leading-normal text-muted">
                  {active.message}
                </p>
                <div className="flex flex-wrap justify-end gap-2.5">
                  <button
                    type="button"
                    className="rounded-pill bg-share px-[18px] py-2 text-[13px] font-bold text-white hover:bg-share-hover"
                    onClick={() => {
                      active.resolve()
                      close()
                    }}
                  >
                    {active.okLabel ?? 'OK'}
                  </button>
                </div>
              </>
            ) : null}
            {active.kind === 'prompt' ? (
              <form onSubmit={handlePromptSubmit}>
                {active.message ? (
                  <p className="mb-2.5 text-sm leading-normal text-muted">
                    {active.message}
                  </p>
                ) : null}
                {active.label ? (
                  <label className="mb-1.5 mt-1 block text-[11px] font-bold uppercase tracking-wider text-muted">
                    {active.label}
                  </label>
                ) : null}
                <input
                  className="mb-[18px] w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]"
                  autoFocus
                  placeholder={active.placeholder}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                />
                <div className="flex flex-wrap justify-end gap-2.5">
                  <button
                    type="button"
                    className="rounded-pill border border-border bg-transparent px-[18px] py-2 text-[13px] font-semibold transition-colors hover:bg-hover-surface"
                    onClick={() => {
                      active.resolve(null)
                      close()
                    }}
                  >
                    {active.cancelLabel ?? 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="rounded-pill bg-share px-[18px] py-2 text-[13px] font-bold text-white hover:bg-share-hover"
                  >
                    {active.confirmLabel ?? 'Save'}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useModals(): ModalCtx {
  const x = useContext(Ctx)
  if (!x) throw new Error('useModals must be used within ModalProvider')
  return x
}
