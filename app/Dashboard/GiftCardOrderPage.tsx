import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, Loader2, XCircle } from 'lucide-react'
import { useSupabase } from '@shared/SupabaseProvider'
import { getAuthAccessToken } from '@shared/auth'
import type { GiftCard, StoredOrder } from '@backend/lib/hubble/types'

const formatInr = (n: number) => `₹${n.toLocaleString('en-IN')}`

const GiftCardOrderPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const { user } = useSupabase()
  const [order, setOrder] = useState<StoredOrder | null>(null)
  const [card, setCard] = useState<GiftCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  const userId = user?.id || user?.email || ''

  const load = useCallback(async () => {
    if (!orderId) return
    try {
      const token = getAuthAccessToken()
      const res = await fetch(`/api/giftcards/orders/${orderId}`, {
        headers: {
          'x-user-id': userId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      const text = await res.text()
      let json: any = {}
      try {
        json = text ? JSON.parse(text) : {}
      } catch {
        throw new Error(`Could not load order (server ${res.status})`)
      }
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to load order')
      setOrder(json.data)
      setError(null)
    } catch (e: any) {
      const msg = String(e?.message || 'Could not load order')
      setError(
        msg.includes('DOCTYPE') || msg.includes('Unexpected token')
          ? 'Could not load this order. Please refresh and try again.'
          : msg,
      )
    } finally {
      setLoading(false)
    }
  }, [orderId, userId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const productId = order?.productId
    if (!productId) return
    let cancelled = false
    fetch(`/api/giftcards/${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.data) setCard(json.data as GiftCard)
      })
      .catch(() => {
        /* redeem sites are optional */
      })
    return () => {
      cancelled = true
    }
  }, [order?.productId])

  useEffect(() => {
    if (!order || order.status !== 'PROCESSING') return
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [order?.status, load])

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4">
        <Loader2 className="animate-spin text-clay" size={36} />
        <span className="text-[11px] font-black uppercase tracking-[0.35em] text-white/35">
          Loading order
        </span>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard/giftcards" className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white">
          <ArrowLeft size={16} /> Back to gift cards
        </Link>
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {error || 'Order not found'}
        </div>
      </div>
    )
  }

  const terminal = order.status === 'SUCCESS' || order.status === 'FAILED'
  const processing = order.status === 'PROCESSING' || order.status === 'PENDING'

  return (
    <div className="space-y-6 max-w-xl">
      <Link to="/dashboard/giftcards" className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white">
        <ArrowLeft size={16} /> Back to gift cards
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[1.5rem] border border-white/10 bg-[#0d0d0d] p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35">Order</p>
            <h2 className="text-xl font-black tracking-tight text-white mt-1">{order.productTitle}</h2>
            <p className="text-sm text-white/40 mt-1">
              {formatInr(order.amountInr)} · {order.quantity}× {formatInr(order.denomination)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
              order.status === 'SUCCESS'
                ? 'bg-clay/15 text-clay border border-clay/25'
                : order.status === 'FAILED'
                  ? 'bg-red-500/15 text-red-300 border border-red-500/25'
                  : 'bg-white/5 text-white/50 border border-white/10'
            }`}
          >
            {order.status}
          </span>
        </div>

        {processing && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/55">
            <Loader2 className="animate-spin text-clay shrink-0" size={18} />
            {order.paymentStatus === 'paid'
              ? 'Payment received. Generating your voucher…'
              : 'Waiting for payment / voucher. This page refreshes automatically.'}
          </div>
        )}

        {order.status === 'FAILED' && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <XCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Order failed</p>
              <p className="text-red-200/80 mt-1">{order.failureReason || 'Please try again with a new order.'}</p>
            </div>
          </div>
        )}

        {order.status === 'SUCCESS' && !!order.vouchers.length && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-clay text-sm font-bold">
              <CheckCircle2 size={18} /> Vouchers ready
            </div>
            {order.vouchers.map((v, i) => (
              <div
                key={v.id || i}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
                  Voucher {i + 1}
                  {v.amount != null ? ` · ${formatInr(v.amount)}` : ''}
                  {v.validTill ? ` · expires ${v.validTill}` : ''}
                </p>
                {v.cardNumber && (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/30">Card number</p>
                      <p className="font-mono text-white text-sm mt-0.5 break-all">{v.cardNumber}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(`n-${i}`, v.cardNumber!)}
                      className="rounded-xl border border-white/10 p-2 text-white/40 hover:text-white"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                )}
                {v.cardPin && (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/30">PIN</p>
                      <p className="font-mono text-white text-sm mt-0.5">{v.cardPin}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(`p-${i}`, v.cardPin!)}
                      className="rounded-xl border border-white/10 p-2 text-white/40 hover:text-white"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                )}
                {copied && (
                  <p className="text-[11px] text-clay">Copied</p>
                )}
              </div>
            ))}
          </div>
        )}

        {!!card?.redeemSites?.length && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/35 mb-2">Redeem at</p>
            <div className="flex flex-col gap-2">
              {card.redeemSites.map((site) => (
                <a
                  key={site.url}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-clay text-sm font-bold hover:underline break-all"
                >
                  {site.label} <ExternalLink size={14} className="shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {terminal && order.status === 'SUCCESS' && !order.vouchers.length && (
          <p className="text-sm text-white/45">Order succeeded but no voucher payload yet — refresh shortly.</p>
        )}

        <p className="text-[11px] text-white/25 break-all">Ref {order.referenceId}</p>
      </motion.div>
    </div>
  )
}

export default GiftCardOrderPage
