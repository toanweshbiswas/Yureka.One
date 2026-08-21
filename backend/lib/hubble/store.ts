import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { HubbleOrderRaw, HubbleOrderStatus, StoredOrder, StoredVoucher } from './types.js'

type PaymentStatus = StoredOrder['paymentStatus']

function emptyPayment(): Pick<StoredOrder, 'paymentStatus' | 'razorpayOrderId' | 'razorpayPaymentId'> {
  return {
    paymentStatus: 'unpaid',
    razorpayOrderId: null,
    razorpayPaymentId: null,
  }
}

function paymentFromRow(row: any): Pick<StoredOrder, 'paymentStatus' | 'razorpayOrderId' | 'razorpayPaymentId'> {
  const nested = row?.raw_response?.payment || {}
  const status = String(row.payment_status || nested.status || 'unpaid') as PaymentStatus
  return {
    paymentStatus: ['unpaid', 'paid', 'failed', 'refunded'].includes(status) ? status : 'unpaid',
    razorpayOrderId: row.razorpay_order_id || nested.razorpayOrderId || null,
    razorpayPaymentId: row.razorpay_payment_id || nested.razorpayPaymentId || null,
  }
}

function giftFromRow(row: any): Pick<StoredOrder, 'isGift' | 'recipientName' | 'recipientEmail' | 'giftMessage' | 'guestToken'> {
  const nested = row?.raw_response?.gift || {}
  return {
    isGift: Boolean(row.is_gift ?? nested.isGift),
    recipientName: row.recipient_name || nested.recipientName || null,
    recipientEmail: row.recipient_email || nested.recipientEmail || null,
    giftMessage: row.gift_message || nested.giftMessage || null,
    guestToken: row.guest_token || row?.raw_response?.guestToken || nested.guestToken || null,
  }
}

type FileStore = {
  orders: Array<Omit<StoredOrder, 'vouchers'> & { vouchers: StoredVoucher[] }>
  webhookKeys: string[]
}

let supabaseSchemaUnavailable = false

function filePath() {
  return path.join(process.cwd(), 'data', 'hubble_orders_store.json')
}

function emptyStore(): FileStore {
  return { orders: [], webhookKeys: [] }
}

function readFileStore(): FileStore {
  const p = filePath()
  try {
    if (!fs.existsSync(p)) {
      const snap = emptyStore()
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, JSON.stringify(snap, null, 2))
      return snap
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as FileStore
  } catch {
    const snap = emptyStore()
    writeFileStore(snap)
    return snap
  }
}

function writeFileStore(snap: FileStore) {
  fs.mkdirSync(path.dirname(filePath()), { recursive: true })
  fs.writeFileSync(filePath(), JSON.stringify(snap, null, 2))
}

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function isMissingSchemaError(message: string | undefined) {
  const text = String(message || '').toLowerCase()
  return (
    text.includes('could not find the table') ||
    text.includes('schema cache') ||
    text.includes('does not exist')
  )
}

function disableSupabaseSchema(reason: unknown) {
  supabaseSchemaUnavailable = true
  console.warn(
    '[giftcards] supabase schema unavailable, falling back to file store:',
    (reason as Error)?.message || reason,
  )
}

/** Prefer Supabase when tables exist; otherwise file store (same pattern as waitlist/goldback). */
function sbClient(): SupabaseClient | null {
  if (supabaseSchemaUnavailable) return null
  return getSupabase()
}

export function hubbleOrdersBackendMode(): 'supabase' | 'file' {
  return sbClient() ? 'supabase' : 'file'
}

function mapVouchersFromRaw(_orderId: string, raw: HubbleOrderRaw): StoredVoucher[] {
  return (raw.vouchers || []).map((v) => ({
    id: randomUUID(),
    hubbleVoucherId: v.id || null,
    cardType: v.cardType || null,
    cardNumber: v.cardNumber || null,
    cardPin: v.cardPin || null,
    amount: v.amount != null ? Number(v.amount) : null,
    validTill: v.validTill || null,
  }))
}

export type CreateLocalOrderInput = {
  userId: string
  referenceId: string
  productId: string
  productTitle: string
  amountInr: number
  denomination: number
  quantity: number
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  isGift?: boolean
  recipientName?: string | null
  recipientEmail?: string | null
  giftMessage?: string | null
  guestToken?: string | null
  paymentStatus?: StoredOrder['paymentStatus']
  razorpayOrderId?: string | null
  razorpayPaymentId?: string | null
}

function createFileOrder(order: StoredOrder): StoredOrder {
  const snap = readFileStore()
  snap.orders.unshift(order)
  writeFileStore(snap)
  return order
}

export async function createLocalOrder(input: CreateLocalOrderInput): Promise<StoredOrder> {
  const now = new Date().toISOString()
  const isGift = Boolean(input.isGift)
  const guestToken = input.guestToken || randomUUID().replace(/-/g, '')
  const order: StoredOrder = {
    id: randomUUID(),
    userId: input.userId,
    referenceId: input.referenceId,
    hubbleOrderId: null,
    productId: input.productId,
    productTitle: input.productTitle,
    amountInr: input.amountInr,
    denomination: input.denomination,
    quantity: input.quantity,
    status: 'PENDING',
    failureReason: null,
    customerName: input.customerName || null,
    customerEmail: input.customerEmail || null,
    customerPhone: input.customerPhone || null,
    isGift,
    recipientName: isGift ? input.recipientName || null : null,
    recipientEmail: isGift ? input.recipientEmail || null : null,
    giftMessage: isGift ? input.giftMessage || null : null,
    guestToken,
    paymentStatus: input.paymentStatus || 'unpaid',
    razorpayOrderId: input.razorpayOrderId || null,
    razorpayPaymentId: input.razorpayPaymentId || null,
    vouchers: [],
    createdAt: now,
    updatedAt: now,
  }

  const giftPayload = isGift
    ? {
        isGift: true,
        recipientName: order.recipientName,
        recipientEmail: order.recipientEmail,
        giftMessage: order.giftMessage,
        guestToken: order.guestToken,
      }
    : { guestToken: order.guestToken }

  const sb = sbClient()
  if (sb) {
    const baseRow: Record<string, unknown> = {
      id: order.id,
      user_id: order.userId,
      reference_id: order.referenceId,
      product_id: order.productId,
      product_title: order.productTitle,
      amount_inr: order.amountInr,
      denomination: order.denomination,
      quantity: order.quantity,
      status: order.status,
      customer_name: order.customerName,
      customer_email: order.customerEmail,
      customer_phone: order.customerPhone,
      razorpay_order_id: order.razorpayOrderId,
      razorpay_payment_id: order.razorpayPaymentId,
      payment_status: order.paymentStatus,
      raw_response: {
        payment: {
          status: order.paymentStatus,
          razorpayOrderId: order.razorpayOrderId,
          razorpayPaymentId: order.razorpayPaymentId,
        },
        guestToken: order.guestToken,
        ...(isGift
          ? {
              gift: {
                isGift: true,
                recipientName: order.recipientName,
                recipientEmail: order.recipientEmail,
                giftMessage: order.giftMessage,
              },
            }
          : {}),
      },
    }

    const withGiftCols = {
      ...baseRow,
      is_gift: order.isGift,
      recipient_name: order.recipientName,
      recipient_email: order.recipientEmail,
      gift_message: order.giftMessage,
      guest_token: order.guestToken,
    }

    let data: any = null
    let error: { message?: string } | null = null
    ;({ data, error } = await sb.from('hubble_orders').insert(withGiftCols).select('*').single())
    if (error && /is_gift|recipient_name|recipient_email|gift_message|guest_token|column/i.test(String(error.message || ''))) {
      ;({ data, error } = await sb.from('hubble_orders').insert(baseRow).select('*').single())
    }
    if (error) {
      if (isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
        return createFileOrder(order)
      }
      throw new Error(error.message)
    }
    return {
      ...order,
      id: data.id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  return createFileOrder(order)
}

export async function patchLocalOrder(
  id: string,
  patch: Partial<
    Pick<StoredOrder, 'paymentStatus' | 'razorpayOrderId' | 'razorpayPaymentId' | 'status' | 'failureReason'>
  >,
): Promise<StoredOrder | null> {
  const now = new Date().toISOString()
  const sb = sbClient()
  if (sb) {
    const { data: existing, error: findErr } = await sb.from('hubble_orders').select('*').eq('id', id).maybeSingle()
    if (findErr) {
      if (isMissingSchemaError(findErr.message)) {
        disableSupabaseSchema(findErr)
      } else {
        throw new Error(findErr.message)
      }
    } else if (existing) {
      const prevPay = paymentFromRow(existing)
      const nextPay = {
        paymentStatus: patch.paymentStatus || prevPay.paymentStatus,
        razorpayOrderId: patch.razorpayOrderId !== undefined ? patch.razorpayOrderId : prevPay.razorpayOrderId,
        razorpayPaymentId: patch.razorpayPaymentId !== undefined ? patch.razorpayPaymentId : prevPay.razorpayPaymentId,
      }
      const raw = {
        ...(existing.raw_response && typeof existing.raw_response === 'object' ? existing.raw_response : {}),
        payment: {
          status: nextPay.paymentStatus,
          razorpayOrderId: nextPay.razorpayOrderId,
          razorpayPaymentId: nextPay.razorpayPaymentId,
        },
      }
      const { error: updErr } = await sb
        .from('hubble_orders')
        .update({
          payment_status: nextPay.paymentStatus,
          razorpay_order_id: nextPay.razorpayOrderId,
          razorpay_payment_id: nextPay.razorpayPaymentId,
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.failureReason !== undefined ? { failure_reason: patch.failureReason } : {}),
          raw_response: raw,
          updated_at: now,
        })
        .eq('id', id)
      if (updErr) {
        if (isMissingSchemaError(updErr.message)) {
          disableSupabaseSchema(updErr)
        } else {
          throw new Error(updErr.message)
        }
      } else {
        return getOrderById(id)
      }
    }
  }

  const snap = readFileStore()
  const idx = snap.orders.findIndex((o) => o.id === id)
  if (idx < 0) return null
  snap.orders[idx] = {
    ...emptyPayment(),
    ...snap.orders[idx],
    ...patch,
    updatedAt: now,
  }
  writeFileStore(snap)
  return snap.orders[idx]
}

export async function getOrderByRazorpayOrderId(razorpayOrderId: string): Promise<StoredOrder | null> {
  if (!razorpayOrderId) return null
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('hubble_orders')
      .select('*')
      .eq('razorpay_order_id', razorpayOrderId)
      .maybeSingle()
    if (error) {
      if (isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      } else {
        throw new Error(error.message)
      }
    } else if (data) {
      return getOrderById(data.id)
    }
  }
  const snap = readFileStore()
  return snap.orders.find((o) => o.razorpayOrderId === razorpayOrderId) || null
}

function applyFileOrderResult(localId: string, raw: HubbleOrderRaw): StoredOrder | null {
  const status = String(raw.status || 'FAILED').toUpperCase() as HubbleOrderStatus
  const vouchers = status === 'SUCCESS' ? mapVouchersFromRaw(localId, raw) : []
  const now = new Date().toISOString()
  const snap = readFileStore()
  const idx = snap.orders.findIndex((o) => o.id === localId)
  if (idx < 0) return null
  const prev = snap.orders[idx]
  snap.orders[idx] = {
    ...prev,
    hubbleOrderId: raw.id || prev.hubbleOrderId,
    status,
    failureReason: raw.failureReason || null,
    vouchers: vouchers.length ? vouchers : status === 'SUCCESS' ? prev.vouchers : [],
    updatedAt: now,
  }
  writeFileStore(snap)
  return snap.orders[idx]
}

export async function applyHubbleOrderResult(
  localId: string,
  raw: HubbleOrderRaw,
): Promise<StoredOrder | null> {
  const status = String(raw.status || 'FAILED').toUpperCase() as HubbleOrderStatus
  const vouchers = status === 'SUCCESS' ? mapVouchersFromRaw(localId, raw) : []
  const now = new Date().toISOString()

  const sb = sbClient()
  if (sb) {
    const { data: existing, error: findErr } = await sb
      .from('hubble_orders')
      .select('*')
      .eq('id', localId)
      .maybeSingle()
    if (findErr) {
      if (isMissingSchemaError(findErr.message)) {
        disableSupabaseSchema(findErr)
        return applyFileOrderResult(localId, raw)
      }
      throw new Error(findErr.message)
    }
    if (!existing) {
      // Local order may live only on file after a prior schema fallback.
      return applyFileOrderResult(localId, raw)
    }

    const { error: updErr } = await sb
      .from('hubble_orders')
      .update({
        hubble_order_id: raw.id,
        status,
        failure_reason: raw.failureReason || null,
        raw_response: raw,
        updated_at: now,
      })
      .eq('id', localId)
    if (updErr) {
      if (isMissingSchemaError(updErr.message)) {
        disableSupabaseSchema(updErr)
        return applyFileOrderResult(localId, raw)
      }
      throw new Error(updErr.message)
    }

    if (vouchers.length) {
      await sb.from('hubble_vouchers').delete().eq('order_id', localId)
      const { error: vErr } = await sb.from('hubble_vouchers').insert(
        vouchers.map((v) => ({
          id: v.id,
          order_id: localId,
          hubble_voucher_id: v.hubbleVoucherId,
          card_type: v.cardType,
          card_number: v.cardNumber,
          card_pin: v.cardPin,
          amount: v.amount,
          valid_till: v.validTill,
        })),
      )
      if (vErr && !isMissingSchemaError(vErr.message)) throw new Error(vErr.message)
      if (vErr) disableSupabaseSchema(vErr)
    }

    return getOrderById(localId, existing.user_id)
  }

  return applyFileOrderResult(localId, raw)
}

export async function applyHubbleOrderByHubbleId(
  hubbleOrderId: string,
  raw: HubbleOrderRaw,
): Promise<StoredOrder | null> {
  const local = await getOrderByHubbleId(hubbleOrderId)
  if (!local) return null
  return applyHubbleOrderResult(local.id, raw)
}

function rowToOrder(row: any, vouchers: StoredVoucher[]): StoredOrder {
  return {
    id: row.id,
    userId: row.user_id,
    referenceId: row.reference_id,
    hubbleOrderId: row.hubble_order_id,
    productId: row.product_id,
    productTitle: row.product_title || '',
    amountInr: Number(row.amount_inr),
    denomination: Number(row.denomination),
    quantity: Number(row.quantity),
    status: row.status,
    failureReason: row.failure_reason,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    ...giftFromRow(row),
    ...paymentFromRow(row),
    vouchers,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getOrderById(id: string, userId?: string): Promise<StoredOrder | null> {
  const sb = sbClient()
  if (sb) {
    let q = sb.from('hubble_orders').select('*').eq('id', id)
    if (userId) q = q.eq('user_id', userId)
    const { data, error } = await q.maybeSingle()
    if (error) {
      if (isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      } else {
        throw new Error(error.message)
      }
    } else if (data) {
      const { data: vouchers } = await sb.from('hubble_vouchers').select('*').eq('order_id', id)
      return rowToOrder(
        data,
        (vouchers || []).map((v: any) => ({
          id: v.id,
          hubbleVoucherId: v.hubble_voucher_id,
          cardType: v.card_type,
          cardNumber: v.card_number,
          cardPin: v.card_pin,
          amount: v.amount != null ? Number(v.amount) : null,
          validTill: v.valid_till,
        })),
      )
    }
  }

  const snap = readFileStore()
  const order = snap.orders.find((o) => o.id === id && (!userId || o.userId === userId))
  return order ? { ...emptyPayment(), isGift: false, recipientName: null, recipientEmail: null, giftMessage: null, guestToken: null, ...order } : null
}

export async function getOrderByGuestToken(guestToken: string): Promise<StoredOrder | null> {
  const token = String(guestToken || '').trim()
  if (!token) return null

  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb.from('hubble_orders').select('*').eq('guest_token', token).maybeSingle()
    if (error) {
      if (isMissingSchemaError(error.message) || /guest_token|column/i.test(error.message)) {
        // Fall through to scan raw_response / file store
      } else {
        throw new Error(error.message)
      }
    } else if (data) {
      return getOrderById(data.id)
    }

    // Fallback: scan recent orders for token in raw_response (pre-migration).
    const { data: rows } = await sb
      .from('hubble_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    const hit = (rows || []).find(
      (row: any) =>
        row?.raw_response?.guestToken === token || row?.raw_response?.gift?.guestToken === token,
    )
    if (hit) return getOrderById(hit.id)
  }

  const snap = readFileStore()
  return snap.orders.find((o) => o.guestToken === token) || null
}

export async function getOrderByHubbleId(hubbleOrderId: string): Promise<StoredOrder | null> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('hubble_orders')
      .select('*')
      .eq('hubble_order_id', hubbleOrderId)
      .maybeSingle()
    if (error) {
      if (isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      } else {
        throw new Error(error.message)
      }
    } else if (data) {
      return getOrderById(data.id)
    }
  }
  const snap = readFileStore()
  return snap.orders.find((o) => o.hubbleOrderId === hubbleOrderId) || null
}

export async function listOrdersForUser(userId: string, limit = 50): Promise<StoredOrder[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('hubble_orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      if (isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      } else {
        throw new Error(error.message)
      }
    } else {
      const out: StoredOrder[] = []
      for (const row of data || []) {
        const order = await getOrderById(row.id)
        if (order) out.push(order)
      }
      return out
    }
  }
  return readFileStore()
    .orders.filter((o) => o.userId === userId)
    .slice(0, limit)
}

/** Admin: all gift-card orders without voucher secrets. */
export async function listAllOrders(limit = 500): Promise<StoredOrder[]> {
  const sb = sbClient()
  if (sb) {
    const { data, error } = await sb
      .from('hubble_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      if (isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      } else {
        throw new Error(error.message)
      }
    } else {
      return (data || []).map((row) => rowToOrder(row, []))
    }
  }
  return readFileStore()
    .orders.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((o) => ({ ...o, vouchers: [] }))
}

/** Returns true if this event key is new (first time seen). */
export async function claimWebhookEvent(eventKey: string, kind: string, payload: unknown): Promise<boolean> {
  const sb = sbClient()
  if (sb) {
    const { error } = await sb.from('hubble_webhook_events').insert({
      event_key: eventKey,
      kind,
      payload: payload as object,
    })
    if (error) {
      if (error.code === '23505') return false
      if (isMissingSchemaError(error.message)) {
        disableSupabaseSchema(error)
      } else {
        throw new Error(error.message)
      }
    } else {
      return true
    }
  }

  const snap = readFileStore()
  if (snap.webhookKeys.includes(eventKey)) return false
  snap.webhookKeys.push(eventKey)
  if (snap.webhookKeys.length > 5000) snap.webhookKeys = snap.webhookKeys.slice(-2500)
  writeFileStore(snap)
  return true
}
