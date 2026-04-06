import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

function requireConfig(): void {
  const keys = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ] as const
  for (const k of keys) {
    if (!import.meta.env[k]) {
      throw new Error(
        `Missing ${k}. Copy .env.local from the project root and restart Vite.`,
      )
    }
  }
}

let app: FirebaseApp
let auth: Auth
let db: Firestore
let storage: FirebaseStorage
let analytics: Analytics | null = null

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    requireConfig()
    app = initializeApp(firebaseConfig)
  }
  return app
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp())
  return auth
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp())
  return db
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) storage = getStorage(getFirebaseApp())
  return storage
}

export async function initAnalytics(): Promise<void> {
  if (analytics || !import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return
  if (await isSupported()) {
    analytics = getAnalytics(getFirebaseApp())
  }
}
