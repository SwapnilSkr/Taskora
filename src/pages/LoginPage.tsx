import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

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
    <div className="bg-background grid min-h-screen place-items-center bg-[radial-gradient(1200px_600px_at_20%_0%,var(--color-login-gradient-start)_0%,var(--color-app)_55%)] p-6">
      <Card className="border-border w-full max-w-[420px] border bg-card/95 shadow-lg backdrop-blur-md">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-[22px] font-bold tracking-tight">
            Welcome to Taskora
          </CardTitle>
          <CardDescription className="text-[13px] leading-relaxed">
            Pro-grade tasks, timelines, and workloads — anchored to your Firebase project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="bg-background text-foreground h-11 w-full gap-2.5 border shadow-sm hover:bg-accent"
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
          </Button>

          <div className="text-muted-foreground flex items-center gap-3 text-xs font-semibold uppercase tracking-widest">
            <Separator className="flex-1" />
            or email
            <Separator className="flex-1" />
          </div>

          <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
            {mode === 'up' ? (
              <div className="space-y-2">
                <Label htmlFor="login-name">Display name</Label>
                <Input
                  id="login-name"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex gap-2.5 pt-1">
              <Button className="flex-1 font-bold" type="submit" disabled={busy}>
                {mode === 'in' ? 'Sign in' : 'Create account'}
              </Button>
              <Button
                className="flex-1 font-bold"
                type="button"
                variant="outline"
                onClick={() => {
                  setMode(mode === 'in' ? 'up' : 'in')
                  setError(null)
                }}
              >
                {mode === 'in' ? 'Need an account?' : 'Have an account?'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
