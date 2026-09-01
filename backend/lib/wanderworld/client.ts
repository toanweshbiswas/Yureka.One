import { getAuthAccessToken } from '@shared/auth'
import type {
  WwAnalytics,
  WwInstallment,
  WwMember,
  WwMembership,
  WwOrg,
  WwPromoterLink,
  WwRegistration,
  WwTrip,
  WwTripPublic,
} from './types'

interface Envelope<T> {
  data: T | null
  status: number
  error?: string
  timestamp?: string
}

async function wwFetch<T>(path: string, userId?: string, init?: RequestInit): Promise<Envelope<T>> {
  try {
    const token = getAuthAccessToken()
    const res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    })
    let json: any = null
    try {
      json = await res.json()
    } catch {
      return {
        data: null,
        status: res.status || 502,
        error: res.ok ? 'Invalid response' : `API error (${res.status})`,
      }
    }
    if (!res.ok) {
      return {
        data: null,
        status: res.status,
        error: json?.error || `API error (${res.status})`,
        timestamp: json?.timestamp,
      }
    }
    return json as Envelope<T>
  } catch {
    return { data: null, status: 503, error: 'WanderWorld API unreachable' }
  }
}

export const wwApi = {
  trips: () => wwFetch<{ trips: WwTripPublic[] }>('/api/wanderworld/trips'),
  trip: (slug: string) =>
    wwFetch<{ trip: WwTripPublic }>(`/api/wanderworld/trips/${encodeURIComponent(slug)}`),
  resolveRef: (code: string) =>
    wwFetch<{ code: string; tripId: string | null }>(
      `/api/wanderworld/ref/${encodeURIComponent(code)}`,
    ),
  groupInvite: (code: string) =>
    wwFetch<{
      joinCode: string
      joinUrl: string
      trip: {
        id: string
        title: string
        slug: string
        coverImageUrl?: string | null
        startDate: string
        endDate: string
        priceInr: number
      }
      groupSize: number
      perSeatInr: number
      amountDueInr: number
      discountInr: number
      leadName: string
      status: string
      seatsClaimed: number
      seatsPaid: number
      seatsOpen: number
      shares: {
        sequence: number
        label: string
        amountInr: number
        status: string
        claimed: boolean
        claimedName: string | null
        isPaid: boolean
      }[]
    }>(`/api/wanderworld/group/${encodeURIComponent(code)}`),
  joinGroup: (
    userId: string,
    code: string,
    body?: { name?: string; email?: string },
  ) =>
    wwFetch<{
      registration: WwRegistration
      installment: WwInstallment
      installments: WwInstallment[]
      trip: WwTrip
      alreadyJoined?: boolean
      alreadyPaid?: boolean
      paymentsUnavailable?: boolean
      keyId?: string
      razorpayOrderId?: string
      amountPaise?: number
      currency?: string
      tripTitle?: string
      installmentId?: string
      prefill?: { name: string; email: string; contact: string }
    }>(`/api/wanderworld/group/${encodeURIComponent(code)}/join`, userId, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  bookings: (userId: string) =>
    wwFetch<{
      bookings: {
        registration: WwRegistration
        trip: WwTrip | null
        installments: WwInstallment[]
      }[]
    }>('/api/wanderworld/my/bookings', userId),
  checkout: (userId: string, body: Record<string, unknown>) =>
    wwFetch<{
      registrationId: string
      installmentId: string
      keyId: string
      razorpayOrderId: string
      amountPaise: number
      currency: string
      tripTitle: string
      paymentMode: string
      installments: WwInstallment[]
      prefill: { name: string; email: string; contact: string }
    }>('/api/wanderworld/checkout', userId, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  verify: (userId: string, body: Record<string, unknown>) =>
    wwFetch<{
      registration: WwRegistration
      installment: WwInstallment
      installments: WwInstallment[]
    }>('/api/wanderworld/payments/verify', userId, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  payInstallment: (userId: string, installmentId: string) =>
    wwFetch<{
      registrationId: string
      installmentId: string
      keyId: string
      razorpayOrderId: string
      amountPaise: number
      currency: string
      tripTitle: string
      prefill: { name: string; email: string; contact: string }
    }>('/api/wanderworld/payments/installment', userId, {
      method: 'POST',
      body: JSON.stringify({ installmentId }),
    }),
  me: (userId: string) =>
    wwFetch<{ memberships: WwMembership[]; current: WwMembership | null; org: WwOrg }>(
      '/api/wanderworld/me',
      userId,
    ),
  adminTrips: (userId: string) =>
    wwFetch<{ trips: WwTrip[] }>('/api/wanderworld/admin/trips', userId),
  createTrip: (userId: string, body: Record<string, unknown>) =>
    wwFetch<{ trip: WwTrip }>('/api/wanderworld/admin/trips', userId, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  uploadCover: async (userId: string, file: File) => {
    try {
      const token = getAuthAccessToken()
      const res = await fetch('/api/wanderworld/admin/upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
          'X-Filename': file.name,
          'X-Content-Type': file.type || 'image/jpeg',
          ...(userId ? { 'x-user-id': userId } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: file,
      })
      let json: any = null
      try {
        json = await res.json()
      } catch {
        return {
          data: null as { url: string; path: string; bucket: string } | null,
          status: res.status || 502,
          error: res.ok ? 'Invalid response' : `API error (${res.status})`,
        }
      }
      if (!res.ok) {
        return {
          data: null as { url: string; path: string; bucket: string } | null,
          status: res.status,
          error: json?.error || `API error (${res.status})`,
          timestamp: json?.timestamp,
        }
      }
      return json as Envelope<{ url: string; path: string; bucket: string }>
    } catch {
      return {
        data: null as { url: string; path: string; bucket: string } | null,
        status: 503,
        error: 'WanderWorld API unreachable',
      }
    }
  },
  updateTrip: (userId: string, id: string, body: Record<string, unknown>) =>
    wwFetch<{ trip: WwTrip }>(`/api/wanderworld/admin/trips/${encodeURIComponent(id)}`, userId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  announceTrip: (
    userId: string,
    tripId: string,
    body: {
      title?: string
      body: string
      audience?: 'booked' | 'unpaid' | 'promoters' | 'related'
      sendInbox?: boolean
      sendEmail?: boolean
    },
  ) =>
    wwFetch<{
      sent: number
      recipients: number
      tripId: string
      tripTitle: string
      audience: string
      channels: string[]
    }>(`/api/wanderworld/admin/trips/${encodeURIComponent(tripId)}/announce`, userId, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteTrip: (userId: string, id: string) =>
    wwFetch<{ deleted: boolean }>(
      `/api/wanderworld/admin/trips/${encodeURIComponent(id)}`,
      userId,
      { method: 'DELETE' },
    ),
  registrations: (userId: string, q?: { tripId?: string; promoterCode?: string }) => {
    const params = new URLSearchParams()
    if (q?.tripId) params.set('tripId', q.tripId)
    if (q?.promoterCode) params.set('promoterCode', q.promoterCode)
    const qs = params.toString()
    return wwFetch<{
      registrations: {
        registration: WwRegistration
        trip: WwTrip | null
        installments: WwInstallment[]
      }[]
    }>(`/api/wanderworld/admin/registrations${qs ? `?${qs}` : ''}`, userId)
  },
  cancelRegistration: (userId: string, id: string) =>
    wwFetch<{
      registration: WwRegistration
      installments: WwInstallment[]
      trip: WwTrip | null
    }>(`/api/wanderworld/admin/registrations/${encodeURIComponent(id)}/cancel`, userId, {
      method: 'POST',
    }),
  adminCollectCash: (userId: string, installmentId: string, note?: string) =>
    wwFetch<{
      registration: WwRegistration
      installment: WwInstallment
      installments: WwInstallment[]
    }>(`/api/wanderworld/admin/installments/${encodeURIComponent(installmentId)}/cash`, userId, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  analytics: (userId: string) => wwFetch<WwAnalytics>('/api/wanderworld/admin/analytics', userId),
  members: (userId: string) =>
    wwFetch<{ members: WwMember[] }>('/api/wanderworld/admin/members', userId),
  inviteMember: (userId: string, body: { email: string; role: string; tripIds?: string[] }) =>
    wwFetch<{ member: WwMember; emailed?: boolean }>('/api/wanderworld/admin/members', userId, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMemberRole: (
    userId: string,
    memberId: string,
    body: { role: string; tripIds?: string[] },
  ) =>
    wwFetch<{ member: WwMember }>(
      `/api/wanderworld/admin/members/${encodeURIComponent(memberId)}/role`,
      userId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  deleteMember: (userId: string, id: string) =>
    wwFetch<{ deleted: boolean }>(
      `/api/wanderworld/admin/members/${encodeURIComponent(id)}`,
      userId,
      { method: 'DELETE' },
    ),
  promoterDashboard: (userId: string) =>
    wwFetch<{
      role: string
      links: WwPromoterLink[]
      shareLinks: (WwPromoterLink & { url: string })[]
      registrations: number
      uniqueBuyers: number
      paid: number
      partial: number
      pending: number
      revenueInr: number
      outstandingInr: number
      cashCollectedInr: number
      onlineCollectedInr: number
      clicks: number
      byBuyer: {
        userId: string
        buyerEmail: string
        buyerName: string
        registrations: number
        paid: number
        revenueInr: number
        outstandingInr: number
      }[]
      payments: {
        installment: WwInstallment
        registration: WwRegistration
        trip: WwTrip | null
      }[]
      rows: {
        registration: WwRegistration
        trip: WwTrip | null
        installments: WwInstallment[]
        joinUrl?: string | null
      }[]
      getawayBase: string
    }>('/api/wanderworld/promoter/dashboard', userId),
  updatePromoterCode: (
    userId: string,
    body: { code: string; linkId?: string; memberId?: string; tripId?: string | null },
  ) =>
    wwFetch<{ link: WwPromoterLink; url: string }>('/api/wanderworld/promoter/code', userId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  collectCash: (userId: string, body: { installmentId: string; note?: string }) =>
    wwFetch<{ registration: WwRegistration; installment: WwInstallment }>(
      '/api/wanderworld/promoter/cash',
      userId,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  groupTrips: (userId: string) =>
    wwFetch<{
      trips: (WwTrip & {
        seatsLeft: number
        groupSeatsLeft: number
        pricingSample: { listPriceInr: number; discountInr: number; amountDueInr: number }
      })[]
    }>('/api/wanderworld/promoter/group-trips', userId),
  createGroupBooking: (
    userId: string,
    body: {
      tripId: string
      groupSize: number
      buyerName: string
      buyerEmail: string
      buyerPhone?: string
      city?: string
      notes?: string
      paymentMode?: 'full' | 'plan'
      promoterCode?: string
    },
  ) =>
    wwFetch<{
      registration: WwRegistration
      installments: WwInstallment[]
      trip: WwTrip
      pricing: {
        listPriceInr: number
        discountInr: number
        amountDueInr: number
        perSeatInr?: number
      }
      joinCode?: string
      joinUrl?: string
    }>('/api/wanderworld/promoter/group-booking', userId, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  notifyGroupBooking: (userId: string, registrationId: string) =>
    wwFetch<{ sent: boolean; joinUrl: string }>(
      `/api/wanderworld/promoter/group-booking/${encodeURIComponent(registrationId)}/notify`,
      userId,
      { method: 'POST' },
    ),
  cancelMyRegistration: (userId: string, id: string) =>
    wwFetch<{
      registration: WwRegistration
      installments: WwInstallment[]
      trip: WwTrip | null
    }>(`/api/wanderworld/promoter/registrations/${encodeURIComponent(id)}/cancel`, userId, {
      method: 'POST',
    }),
  updateMyRegistration: (
    userId: string,
    id: string,
    body: {
      buyerName?: string
      buyerEmail?: string
      buyerPhone?: string | null
      notes?: string | null
      city?: string | null
    },
  ) =>
    wwFetch<{
      registration: WwRegistration
      installments: WwInstallment[]
      joinUrl?: string | null
    }>(`/api/wanderworld/promoter/registrations/${encodeURIComponent(id)}`, userId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  releaseGroupShare: (userId: string, installmentId: string) =>
    wwFetch<{
      installment: WwInstallment
      registration: WwRegistration
      installments: WwInstallment[]
    }>(`/api/wanderworld/promoter/shares/${encodeURIComponent(installmentId)}/release`, userId, {
      method: 'POST',
    }),
  updateGroupShare: (
    userId: string,
    installmentId: string,
    body: { claimedByName?: string | null; claimedByEmail?: string | null },
  ) =>
    wwFetch<{
      installment: WwInstallment
      registration: WwRegistration
      installments: WwInstallment[]
    }>(`/api/wanderworld/promoter/shares/${encodeURIComponent(installmentId)}`, userId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteMyRegistration: (userId: string, id: string) =>
    wwFetch<{ deleted: true; trip: WwTrip | null }>(
      `/api/wanderworld/promoter/registrations/${encodeURIComponent(id)}`,
      userId,
      { method: 'DELETE' },
    ),
  updatePromoterProfile: (
    userId: string,
    body: {
      displayName?: string
      phone?: string
      city?: string
      bio?: string
      instagram?: string
    },
  ) =>
    wwFetch<{ member: WwMember }>('/api/wanderworld/promoter/profile', userId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  assignMemberTrips: (userId: string, memberId: string, tripIds: string[]) =>
    wwFetch<{ member: WwMember }>(
      `/api/wanderworld/admin/members/${encodeURIComponent(memberId)}/trips`,
      userId,
      { method: 'PATCH', body: JSON.stringify({ tripIds }) },
    ),
  chatThreads: (userId: string) =>
    wwFetch<{ threads: import('./types').WwChatThread[] }>('/api/wanderworld/chat/threads', userId),
  chatMessages: (userId: string, tripId: string, since?: string) => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : ''
    return wwFetch<{
      trip: { id: string; title: string; slug: string }
      messages: import('./types').WwChatMessage[]
    }>(`/api/wanderworld/chat/trips/${encodeURIComponent(tripId)}/messages${qs}`, userId)
  },
  sendChatMessage: (userId: string, tripId: string, body: string, name?: string) =>
    wwFetch<{ message: import('./types').WwChatMessage }>(
      `/api/wanderworld/chat/trips/${encodeURIComponent(tripId)}/messages`,
      userId,
      { method: 'POST', body: JSON.stringify({ body, name }) },
    ),
}

export type {
  WwAnalytics,
  WwInstallment,
  WwMember,
  WwMembership,
  WwOrg,
  WwPromoterLink,
  WwRegistration,
  WwTrip,
  WwTripPublic,
}
