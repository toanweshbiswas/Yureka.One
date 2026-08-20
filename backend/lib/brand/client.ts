import { getAuthAccessToken } from '@shared/auth'
import type {
  Brand,
  BrandListRow,
  BrandMember,
  BrandMembership,
  BrandOffer,
  BrandOverview,
} from './types'

interface Envelope<T> {
  data: T | null
  status: number
  error?: string
  timestamp?: string
}

async function brandFetch<T>(
  path: string,
  userId: string,
  init?: RequestInit & { brandId?: string },
): Promise<Envelope<T>> {
  try {
    const token = getAuthAccessToken()
    const { brandId, ...rest } = init || {}
    const res = await fetch(path, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
        ...(brandId ? { 'x-brand-id': brandId } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(rest.headers || {}),
      },
    })
    let json: any = null
    try {
      json = await res.json()
    } catch {
      return {
        data: null,
        status: res.status || 502,
        error: res.ok ? 'Invalid brand response' : `Brand API error (${res.status})`,
      }
    }
    if (!res.ok) {
      return {
        data: null,
        status: res.status,
        error: json?.error || `Brand API error (${res.status})`,
        timestamp: json?.timestamp,
      }
    }
    return json as Envelope<T>
  } catch {
    return { data: null, status: 503, error: 'Brand API unreachable' }
  }
}

export const brandApi = {
  me: (userId: string, brandId?: string) =>
    brandFetch<{ memberships: BrandMembership[]; current: BrandMembership | null }>(
      `/api/v1/brands/me${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`,
      userId,
      { brandId },
    ),
  overview: (userId: string, brandId?: string) =>
    brandFetch<BrandOverview>(
      `/api/v1/brands/overview${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`,
      userId,
      { brandId },
    ),
  offers: (userId: string, brandId?: string) =>
    brandFetch<{ offers: BrandOffer[] }>(
      `/api/v1/brands/offers${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`,
      userId,
      { brandId },
    ),
  createOffer: (userId: string, body: Record<string, unknown>, brandId?: string) =>
    brandFetch<{ offer: BrandOffer }>('/api/v1/brands/offers', userId, {
      method: 'POST',
      body: JSON.stringify(body),
      brandId,
    }),
  updateOffer: (userId: string, id: string, body: Record<string, unknown>) =>
    brandFetch<{ offer: BrandOffer }>(`/api/v1/brands/offers/${encodeURIComponent(id)}`, userId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  members: (userId: string, brandId?: string) =>
    brandFetch<{ members: BrandMember[] }>(
      `/api/v1/brands/members${brandId ? `?brandId=${encodeURIComponent(brandId)}` : ''}`,
      userId,
      { brandId },
    ),
  catalog: (userId: string) =>
    brandFetch<{ offers: BrandOffer[] }>('/api/v1/brands/catalog', userId),
  track: (userId: string, offerId: string, type: 'impression' | 'click' | 'copy') =>
    brandFetch<{ event: unknown }>('/api/v1/brands/events', userId, {
      method: 'POST',
      body: JSON.stringify({ offerId, type }),
    }),
}

export type { Brand, BrandListRow, BrandMember, BrandMembership, BrandOffer, BrandOverview }
