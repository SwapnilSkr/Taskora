import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../components/layout/layout.css'

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
    <div className="login-page">
      <div className="login-card">
        <h1>Welcome to Taskora</h1>
        <p>Pro-grade tasks, timelines, and workloads — anchored to your Firebase project.</p>
        <button
          type="button"
          className="btn-google"
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
        <div className="login-divider">or email</div>
        <form onSubmit={(e) => void onSubmit(e)}>
          {mode === 'up' ? (
            <div className="field-label" style={{ marginTop: 0 }}>
              Display name
            </div>
          ) : null}
          {mode === 'up' ? (
            <input
              className="input"
              placeholder="Ada Lovelace"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : null}
          <div className="field-label">Email</div>
          <input
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="field-label">Password</div>
          <input
            className="input"
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error ? (
            <div style={{ color: '#ff9c9c', marginTop: 10, fontSize: 13 }}>
              {error}
            </div>
          ) : null}
          <div className="login-actions">
            <button className="btn-primary" type="submit" disabled={busy}>
              {mode === 'in' ? 'Sign in' : 'Create account'}
            </button>
            <button
              className="btn-secondary"
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
