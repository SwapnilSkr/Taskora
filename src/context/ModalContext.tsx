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
import '../components/layout/layout.css'

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
        <div className="app-modal-root" role="presentation">
          <button
            type="button"
            className="app-modal-backdrop"
            aria-label="Close"
            onClick={() => {
              if (active.kind === 'confirm') active.resolve(false)
              else if (active.kind === 'prompt') active.resolve(null)
              else active.resolve()
              close()
            }}
          />
          <div className="app-modal-panel" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
            <h2 id="app-modal-title" className="app-modal-title">
              {active.title}
            </h2>
            {active.kind === 'confirm' ? (
              <>
                <p className="app-modal-body">{active.message}</p>
                <div className="app-modal-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      active.resolve(false)
                      close()
                    }}
                  >
                    {active.cancelLabel ?? 'Cancel'}
                  </button>
                  <button
                    type="button"
                    className={`btn-primary ${active.danger ? 'btn-danger' : ''}`}
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
                <p className="app-modal-body">{active.message}</p>
                <div className="app-modal-actions">
                  <button
                    type="button"
                    className="btn-primary"
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
                  <p className="app-modal-body app-modal-body-tight">{active.message}</p>
                ) : null}
                {active.label ? (
                  <label className="field-label" style={{ marginTop: 4 }}>
                    {active.label}
                  </label>
                ) : null}
                <input
                  className="input app-modal-input"
                  autoFocus
                  placeholder={active.placeholder}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                />
                <div className="app-modal-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      active.resolve(null)
                      close()
                    }}
                  >
                    {active.cancelLabel ?? 'Cancel'}
                  </button>
                  <button type="submit" className="btn-primary">
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
