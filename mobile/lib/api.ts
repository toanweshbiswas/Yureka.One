import { API_URL } from './config'

export type Envelope<T> = {
  data: T | null
  status: number
  error?: string
  timestamp?: string
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type AuthGetter = () => string | null

let tokenGetter: AuthGetter = () => null

export function setApiTokenGetter(fn: AuthGetter) {
  tokenGetter = fn
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { userId?: string; timeoutMs?: number },
): Promise<Envelope<T>> {
  const { userId, timeoutMs = 20000, ...rest } = init || {}
  const token = tokenGetter()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(userId ? { 'x-user-id': userId } : {}),
        ...(rest.headers || {}),
      },
      signal: controller.signal,
    })
    const text = await res.text()
    let json: Envelope<T> = { data: null, status: res.status }
    try {
      json = text ? (JSON.parse(text) as Envelope<T>) : json
    } catch {
      throw new ApiError(
        res.status === 401 ? 'Please sign in again' : `Server error (${res.status})`,
        res.status,
      )
    }
    if (!res.ok || json.error) {
      throw new ApiError(json.error || `Request failed (${res.status})`, res.status)
    }
    return json
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError('Network error — try again', 503)
  } finally {
    clearTimeout(timer)
  }
}
