import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { WwSnapshot } from './types.js'

let sb: SupabaseClient | null = null

function client(): SupabaseClient | null {
  if (sb) return sb
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  sb = createClient(url, key, { auth: { persistSession: false } })
  return sb
}

function isMissingTable(msg: string | undefined) {
  const t = String(msg || '').toLowerCase()
  return t.includes('does not exist') || t.includes('could not find') || t.includes('schema cache')
}

export function wwStoreMode(): 'file' | 'supabase' | 'dual' {
  const raw = String(process.env.WANDERWORLD_STORE || 'dual').trim().toLowerCase()
  if (raw === 'supabase' || raw === 'dual' || raw === 'file') return raw
  return 'dual'
}

export async function syncSnapshotToSupabase(snap: WwSnapshot): Promise<void> {
  if (wwStoreMode() === 'file') return
  const c = client()
  if (!c) return

  try {
    await c.from('wanderworld_orgs').upsert({
      id: snap.org.id,
      name: snap.org.name,
      slug: snap.org.slug,
      created_at: snap.org.createdAt,
    })

    if (snap.members.length) {
      await c.from('wanderworld_members').upsert(
        snap.members.map((m) => ({
          id: m.id,
          org_id: m.orgId,
          email: m.email,
          user_id: m.userId || null,
          role: m.role,
          invited_at: m.invitedAt,
          joined_at: m.joinedAt || null,
          display_name: m.displayName || null,
          phone: m.phone || null,
          city: m.city || null,
          bio: m.bio || null,
          instagram: m.instagram || null,
          assigned_trip_ids: m.assignedTripIds || [],
        })),
        { onConflict: 'id' },
      )
    }

    if (snap.trips.length) {
      await c.from('wanderworld_trips').upsert(
        snap.trips.map((t) => ({
          id: t.id,
          org_id: t.orgId,
          title: t.title,
          slug: t.slug,
          description: t.description,
          itinerary: t.itinerary,
          price_inr: t.priceInr,
          seats: t.seats,
          seats_taken: t.seatsTaken,
          start_date: t.startDate || null,
          end_date: t.endDate || null,
          cover_image_url: t.coverImageUrl || null,
          status: t.status,
          payment_plans_enabled: t.paymentPlansEnabled,
          plan_template: t.planTemplate,
          group_booking_enabled: Boolean(t.groupBookingEnabled),
          group_seats: t.groupSeats ?? 0,
          group_seats_taken: t.groupSeatsTaken ?? 0,
          group_discount_type: t.groupDiscountType || 'percent',
          group_discount_value: t.groupDiscountValue ?? 0,
          group_min_size: t.groupMinSize ?? 2,
          group_max_size: t.groupMaxSize ?? 20,
          created_at: t.createdAt,
          updated_at: t.updatedAt,
        })),
        { onConflict: 'id' },
      )
    }

    if (snap.promoterLinks.length) {
      await c.from('wanderworld_promoter_links').upsert(
        snap.promoterLinks.map((l) => ({
          id: l.id,
          org_id: l.orgId,
          member_id: l.memberId,
          code: l.code,
          trip_id: l.tripId || null,
          previous_codes: l.previousCodes || [],
          click_count: l.clickCount ?? 0,
          last_clicked_at: l.lastClickedAt || null,
          created_at: l.createdAt,
        })),
        { onConflict: 'id' },
      )
    }

    if (snap.registrations.length) {
      await c.from('wanderworld_registrations').upsert(
        snap.registrations.map((r) => ({
          id: r.id,
          org_id: r.orgId,
          trip_id: r.tripId,
          user_id: r.userId,
          buyer_email: r.buyerEmail,
          buyer_name: r.buyerName,
          buyer_phone: r.buyerPhone || null,
          promoter_code: r.promoterCode || null,
          payment_mode: r.paymentMode,
          status: r.status,
          amount_due_inr: r.amountDueInr,
          amount_paid_inr: r.amountPaidInr,
          notes: r.notes || null,
          city: r.city || null,
          group_size: r.groupSize ?? null,
          is_group: Boolean(r.isGroup),
          join_code: r.joinCode || null,
          per_seat_inr: r.perSeatInr ?? null,
          list_price_inr: r.listPriceInr ?? null,
          discount_inr: r.discountInr ?? null,
          booked_by_member_id: r.bookedByMemberId || null,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        })),
        { onConflict: 'id' },
      )
    }

    if (snap.installments.length) {
      await c.from('wanderworld_installments').upsert(
        snap.installments.map((i) => ({
          id: i.id,
          registration_id: i.registrationId,
          sequence: i.sequence,
          label: i.label,
          amount_inr: i.amountInr,
          due_at: i.dueAt,
          status: i.status,
          razorpay_order_id: i.razorpayOrderId || null,
          razorpay_payment_id: i.razorpayPaymentId || null,
          paid_at: i.paidAt || null,
          payment_method: i.paymentMethod || null,
          collected_by_member_id: i.collectedByMemberId || null,
          cash_note: i.cashNote || null,
          claimed_by_user_id: i.claimedByUserId || null,
          claimed_by_email: i.claimedByEmail || null,
          claimed_by_name: i.claimedByName || null,
          claimed_at: i.claimedAt || null,
        })),
        { onConflict: 'id' },
      )
    }
  } catch (e: any) {
    if (!isMissingTable(e?.message)) {
      console.warn('[wanderworld] supabase sync failed:', e?.message || e)
    }
  }
}

export async function loadSnapshotFromSupabase(): Promise<WwSnapshot | null> {
  if (wwStoreMode() === 'file') return null
  const c = client()
  if (!c) return null

  try {
    const { data: orgs, error: orgErr } = await c.from('wanderworld_orgs').select('*').limit(1)
    if (orgErr || !orgs?.length) return null

    const org = orgs[0]
    const orgId = org.id

    const [members, trips, links, regs, inst] = await Promise.all([
      c.from('wanderworld_members').select('*').eq('org_id', orgId),
      c.from('wanderworld_trips').select('*').eq('org_id', orgId),
      c.from('wanderworld_promoter_links').select('*').eq('org_id', orgId),
      c.from('wanderworld_registrations').select('*').eq('org_id', orgId),
      c.from('wanderworld_installments').select('*'),
    ])

    const regIds = new Set((regs.data || []).map((r: any) => r.id))
    const installments = (inst.data || []).filter((i: any) => regIds.has(i.registration_id))

    return {
      org: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: org.created_at,
      },
      members: (members.data || []).map((m: any) => ({
        id: m.id,
        orgId: m.org_id,
        email: m.email,
        userId: m.user_id,
        role: m.role,
        invitedAt: m.invited_at,
        joinedAt: m.joined_at,
        displayName: m.display_name,
        phone: m.phone,
        city: m.city,
        bio: m.bio,
        instagram: m.instagram,
        assignedTripIds: m.assigned_trip_ids || [],
      })),
      trips: (trips.data || []).map((t: any) => ({
        id: t.id,
        orgId: t.org_id,
        title: t.title,
        slug: t.slug,
        description: t.description || '',
        itinerary: t.itinerary || '',
        priceInr: Number(t.price_inr),
        seats: t.seats,
        seatsTaken: t.seats_taken,
        startDate: t.start_date || '',
        endDate: t.end_date || '',
        coverImageUrl: t.cover_image_url,
        status: t.status,
        paymentPlansEnabled: Boolean(t.payment_plans_enabled),
        planTemplate: t.plan_template || [],
        groupBookingEnabled: Boolean(t.group_booking_enabled),
        groupSeats: t.group_seats ?? 0,
        groupSeatsTaken: t.group_seats_taken ?? 0,
        groupDiscountType: t.group_discount_type === 'flat_per_seat' ? 'flat_per_seat' : 'percent',
        groupDiscountValue: Number(t.group_discount_value) || 0,
        groupMinSize: t.group_min_size ?? 2,
        groupMaxSize: t.group_max_size ?? 20,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      })),
      promoterLinks: (links.data || []).map((l: any) => ({
        id: l.id,
        orgId: l.org_id,
        memberId: l.member_id,
        code: l.code,
        tripId: l.trip_id,
        previousCodes: l.previous_codes || [],
        clickCount: l.click_count ?? 0,
        lastClickedAt: l.last_clicked_at,
        createdAt: l.created_at,
      })),
      registrations: (regs.data || []).map((r: any) => ({
        id: r.id,
        orgId: r.org_id,
        tripId: r.trip_id,
        userId: r.user_id,
        buyerEmail: r.buyer_email,
        buyerName: r.buyer_name,
        buyerPhone: r.buyer_phone,
        promoterCode: r.promoter_code,
        paymentMode: r.payment_mode,
        status: r.status,
        amountDueInr: Number(r.amount_due_inr),
        amountPaidInr: Number(r.amount_paid_inr),
        notes: r.notes,
        city: r.city,
        groupSize: r.group_size,
        isGroup: Boolean(r.is_group),
        joinCode: r.join_code,
        perSeatInr: r.per_seat_inr != null ? Number(r.per_seat_inr) : null,
        listPriceInr: r.list_price_inr != null ? Number(r.list_price_inr) : null,
        discountInr: r.discount_inr != null ? Number(r.discount_inr) : null,
        bookedByMemberId: r.booked_by_member_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      installments: installments.map((i: any) => ({
        id: i.id,
        registrationId: i.registration_id,
        sequence: i.sequence,
        label: i.label,
        amountInr: Number(i.amount_inr),
        dueAt: i.due_at,
        status: i.status,
        razorpayOrderId: i.razorpay_order_id,
        razorpayPaymentId: i.razorpay_payment_id,
        paidAt: i.paid_at,
        paymentMethod: i.payment_method,
        collectedByMemberId: i.collected_by_member_id,
        cashNote: i.cash_note,
        claimedByUserId: i.claimed_by_user_id,
        claimedByEmail: i.claimed_by_email,
        claimedByName: i.claimed_by_name,
        claimedAt: i.claimed_at,
      })),
    }
  } catch (e: any) {
    if (!isMissingTable(e?.message)) console.warn('[wanderworld] supabase load failed:', e?.message)
    return null
  }
}
