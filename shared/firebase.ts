import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  getAnalytics,
  isSupported,
  setAnalyticsCollectionEnabled,
  type Analytics,
} from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyDI5yOnee4j1ImLn821Yy24qkj0i71jSRk',
  authDomain: 'yureka-92525.firebaseapp.com',
  projectId: 'yureka-92525',
  storageBucket: 'yureka-92525.firebasestorage.app',
  messagingSenderId: '64148459191',
  appId: '1:64148459191:web:7d40e216f58370a07f8732',
  measurementId: 'G-J3CZVL9BPW',
} as const

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)

let analyticsPromise: Promise<Analytics | null> | null = null

export function initializeFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (analyticsPromise) return analyticsPromise

  analyticsPromise = isSupported()
    .then((supported) => {
      if (!supported) return null
      const analytics = getAnalytics(firebaseApp)
      setAnalyticsCollectionEnabled(analytics, import.meta.env.PROD)
      return analytics
    })
    .catch(() => null)

  return analyticsPromise
}
