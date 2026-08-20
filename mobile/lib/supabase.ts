import '@/lib/cryptoPolyfill'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { createClient, type Session, type User } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

/** SecureStore caps values at ~2KB; chunk session JSON across keys. */
const CHUNK = 1800

function canUseSecureStore() {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false
  return typeof SecureStore.getItemAsync === 'function'
}

const memory = new Map<string, string>()

const secureStorage = {
  async getItem(key: string) {
    const meta = await SecureStore.getItemAsync(key)
    if (!meta) return null
    try {
      const parsed = JSON.parse(meta) as { chunks?: number }
      if (parsed && typeof parsed.chunks === 'number') {
        const parts: string[] = []
        for (let i = 0; i < parsed.chunks; i++) {
          parts.push((await SecureStore.getItemAsync(`${key}.${i}`)) ?? '')
        }
        return parts.join('')
      }
    } catch {
      return meta
    }
    return meta
  },
  async setItem(key: string, value: string) {
    if (value.length <= CHUNK) {
      await SecureStore.setItemAsync(key, value)
      return
    }
    const chunks = Math.ceil(value.length / CHUNK)
    await SecureStore.setItemAsync(key, JSON.stringify({ chunks }))
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK))
    }
  },
  async removeItem(key: string) {
    const meta = await SecureStore.getItemAsync(key)
    if (meta) {
      try {
        const parsed = JSON.parse(meta) as { chunks?: number }
        if (parsed && typeof parsed.chunks === 'number') {
          for (let i = 0; i < parsed.chunks; i++) {
            await SecureStore.deleteItemAsync(`${key}.${i}`)
          }
        }
      } catch {
        /* plain value */
      }
    }
    await SecureStore.deleteItemAsync(key)
  },
}

/** In-memory fallback for Metro SSR / Node where SecureStore is unavailable. */
const memoryStorage = {
  async getItem(key: string) {
    return memory.get(key) ?? null
  },
  async setItem(key: string, value: string) {
    memory.set(key, value)
  },
  async removeItem(key: string) {
    memory.delete(key)
  },
}

const storage = canUseSecureStore() ? secureStorage : memoryStorage

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null

export type { Session, User }
