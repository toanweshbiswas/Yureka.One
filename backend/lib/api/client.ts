import type { YurekaResponse } from './types'
export { isApiError, isValidationError } from './types'
import { getAuthAccessToken } from '@shared/auth'

// Empty string → relative URLs, which Netlify/Express proxy to the backend.
const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// Guard: a deployed (non-local) site must never call a localhost/private API —
// browsers block that as a "Private Network Access" request and pop up a
// "wants to access other apps and services on this device" permission prompt.
// If a localhost base URL was baked into a production build, ignore it here and
// fall back to relative /api/* paths (proxied to the real backend).
const onLocalhost =
  typeof window !== 'undefined' &&
  /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/.test(window.location.hostname)
const pointsAtLocalhost = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/i.test(RAW_BASE)
const BASE_URL = !onLocalhost && pointsAtLocalhost ? '' : RAW_BASE

function errorResponse<T>(status: number, error: string): YurekaResponse<T> {
  return { data: null, status, error, timestamp: new Date().toISOString() }
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string; skipAuth?: boolean; timeoutMs?: number }
): Promise<YurekaResponse<T>> {
  const { token: explicitToken, skipAuth, timeoutMs = 5000, ...init } = options ?? {}

  const token = skipAuth ? undefined : explicitToken ?? (typeof window !== 'undefined' ? getAuthAccessToken() : null)

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers ?? {}),
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers, signal: controller.signal })
  } catch {
    // ECONNREFUSED / timeout / no network — must be >= 400 so isApiError() triggers fallback
    return errorResponse<T>(503, 'Network error — backend unreachable')
  } finally {
    clearTimeout(timer)
  }

  let text: string
  try {
    text = await res.text()
  } catch {
    return errorResponse<T>(502, 'Invalid response from server')
  }

  try {
    return JSON.parse(text) as YurekaResponse<T>
  } catch {
    // Backend returned non-JSON (HTML 404, Netlify 504 empty body, Suspended page).
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 120)
    const hint =
      res.status === 504 || res.status === 502
        ? 'API timed out — please try again in a moment'
        : snippet
          ? `Invalid response from server (${res.status}): ${snippet}`
          : `Invalid response from server (${res.status})`
    return errorResponse<T>(res.status >= 400 ? res.status : 502, hint)
  }
}

type ApiOptions = { token?: string; skipAuth?: boolean; timeoutMs?: number; headers?: HeadersInit }

export const api = {
  get: <T>(path: string, options?: ApiOptions) =>
    apiFetch<T>(path, { method: 'GET', ...options }),

  post: <T>(path: string, body: unknown, options?: ApiOptions) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), ...options }),

  put: <T>(path: string, body: unknown, options?: ApiOptions) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body), ...options }),

  patch: <T>(path: string, body: unknown, options?: ApiOptions) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...options }),

  delete: <T>(path: string, options?: ApiOptions) =>
    apiFetch<T>(path, { method: 'DELETE', ...options }),
}
