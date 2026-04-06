import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function GoogleMark() {
  return (
    <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.705 32.657 29.232 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C33.834 5.897 29.18 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.962 3.038l5.657-5.657C33.834 5.897 29.18 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.197 0-9.66-3.168-11.314-7.684l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  )
}

const fieldLabel =
  'mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-wider text-muted first:mt-0'

const input =
  'w-full rounded-card border border-border bg-app px-3 py-2 text-[13px]'

export function LoginPage() {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'in') await signInEmail(email.trim(), password)
      else await signUpEmail(email.trim(), password, name.trim())
      nav('/home', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(1200px_600px_at_20%_0%,var(--color-login-gradient-start)_0%,var(--color-app)_55%)] p-6">
      <div className="w-full max-w-[420px] rounded-login border border-border bg-[rgba(37,39,40,0.92)] p-7 shadow-popover backdrop-blur-md">
        <h1 className="m-0 mb-1.5 text-[22px] font-bold tracking-tight">
          Welcome to Taskora
        </h1>
        <p className="mb-[18px] text-muted">
          Pro-grade tasks, timelines, and workloads — anchored to your Firebase project.
        </p>
        <button
          type="button"
          className="mb-[18px] flex w-full items-center justify-center gap-2.5 rounded-pill border border-border bg-white px-3.5 py-2.5 text-[13px] font-semibold text-google-btn transition-colors hover:border-google-border-hover hover:bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-[0.65] [&_svg]:shrink-0"
          disabled={busy}
          onClick={() => {
            setError(null)
            setBusy(true)
            void signInGoogle()
              .then(() => nav('/home', { replace: true }))
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : 'Google sign-in failed'),
              )
              .finally(() => setBusy(false))
          }}
        >
          <GoogleMark />
          Continue with Google
        </button>
        <div className="my-1 mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
          or email
        </div>
        <form onSubmit={(e) => void onSubmit(e)}>
          {mode === 'up' ? (
            <div className={`${fieldLabel} mt-0!`}>Display name</div>
          ) : null}
          {mode === 'up' ? (
            <input
              className={input}
              placeholder="Ada Lovelace"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : null}
          <div className={fieldLabel}>Email</div>
          <input
            className={input}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className={fieldLabel}>Password</div>
          <input
            className={input}
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error ? (
            <div className="mt-2.5 text-[13px] text-[#ff9c9c]">{error}</div>
          ) : null}
          <div className="mt-3.5 flex gap-2.5">
            <button
              className="flex-1 rounded-pill bg-share px-3.5 py-2.5 font-bold text-white transition-colors hover:bg-share-hover disabled:opacity-60"
              type="submit"
              disabled={busy}
            >
              {mode === 'in' ? 'Sign in' : 'Create account'}
            </button>
            <button
              className="flex-1 rounded-pill border border-border px-3.5 py-2.5 font-bold transition-colors hover:bg-hover-surface"
              type="button"
              onClick={() => {
                setMode(mode === 'in' ? 'up' : 'in')
                setError(null)
              }}
            >
              {mode === 'in' ? 'Need an account?' : 'Have an account?'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
