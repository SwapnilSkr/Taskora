import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getFirebaseAuth, initAnalytics } from '../lib/firebase'
import { seedDefaultStatuses, upsertUserProfile } from '../services/db'

type AuthCtx = {
  user: User | null
  ready: boolean
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>
  signInGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void initAnalytics()
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u)
      setReady(true)
      if (u) {
        void seedDefaultStatuses(u.uid)
        void upsertUserProfile(u.uid, {
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
        })
      }
    })
  }, [])

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
  }, [])

  const signUpEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      const cred = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password,
      )
      if (displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() })
      }
      await upsertUserProfile(cred.user.uid, {
        email: cred.user.email,
        displayName: cred.user.displayName,
        photoURL: cred.user.photoURL,
      })
    },
      [],
  )

  const signInGoogle = useCallback(async () => {
    const cred = await signInWithPopup(getFirebaseAuth(), googleProvider)
    await upsertUserProfile(cred.user.uid, {
      email: cred.user.email,
      displayName: cred.user.displayName,
      photoURL: cred.user.photoURL,
    })
  }, [])

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth())
  }, [])

  const value = useMemo(
    () => ({
      user,
      ready,
      signInEmail,
      signUpEmail,
      signInGoogle,
      logout,
    }),
    [user, ready, signInEmail, signUpEmail, signInGoogle, logout],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useAuth(): AuthCtx {
  const x = useContext(Ctx)
  if (!x) throw new Error('useAuth must be used within AuthProvider')
  return x
}
