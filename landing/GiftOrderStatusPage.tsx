import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Copy, Loader2, XCircle } from 'lucide-react'
import type { StoredOrder } from '@backend/lib/hubble/types'
import Navbar from '@landing/home-v2/Navbar'
import Footer from '@landing/home-v2/Footer'
import SEO from '@shared/SEO'

const formatInr = (n: number) => `₹${n.toLocaleString('en-IN')}`

const GiftOrderStatusPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [order, setOrder] = useState<StoredOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/giftcards/guest/orders/${encodeURIComponent(token)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to load order')
      setOrder(json.data)
      setError(null)
    } catch (e: any) {
      setError(String(e?.message || 'Could not load order'))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!order || (order.status !== 'PROCESSING' && order.status !== 'PENDING')) return
    const t = setInterval(() => void load(), 8000)
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

  return (
    <div className="min-h-dvh bg-black text-white">
      <SEO title="Gift order · Yureka" description="Track your Yureka gift card order." />
      <Navbar />
      <main className="mx-auto max-w-xl px-6 pb-20 pt-28">
        <Link to="/#gifting" className="text-sm text-white/45 hover:text-white">
          ← Back to gifting
        </Link>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-24">
            <Loader2 className="animate-spin text-[#5fae52]" size={32} />
            <p className="text-[12px] uppercase tracking-[0.2em] text-white/40">Loading order</p>
          </div>
        ) : error || !order ? (
          <div className="mt-8 rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-4 text-sm text-red-200">
            {error || 'Order not found'}
          </div>
        ) : (
          <div className="mt-8 space-y-5 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Gift order</p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-white">{order.productTitle}</h1>
              <p className="mt-1 text-sm text-white/45">
                {formatInr(order.amountInr)} · {order.status}
              </p>
            </div>

            {order.isGift && (
              <div className="rounded-xl border border-[#5fae52]/30 bg-[#5fae52]/10 px-4 py-3 text-sm text-white/70">
                Sent to <span className="font-semibold text-white">{order.recipientName}</span>
                {order.recipientEmail ? (
                  <span className="text-white/45"> ({order.recipientEmail})</span>
                ) : null}
                {order.giftMessage ? (
                  <p className="mt-2 italic text-white/50">“{order.giftMessage}”</p>
                ) : null}
              </div>
            )}

            {(order.status === 'PROCESSING' || order.status === 'PENDING') && (
              <div className="flex items-center gap-3 text-sm text-white/55">
                <Loader2 className="animate-spin text-[#5fae52]" size={18} />
                {order.paymentStatus === 'paid'
                  ? 'Payment received. Generating voucher…'
                  : 'Waiting for payment confirmation…'}
              </div>
            )}

            {order.status === 'FAILED' && (
              <div className="flex gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                <XCircle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Order failed</p>
                  <p className="mt-1 text-red-200/80">
                    {order.failureReason || 'Please try again from the gifting section.'}
                  </p>
                </div>
              </div>
            )}

            {order.status === 'SUCCESS' && !!order.vouchers?.length && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#5fae52]">
                  <CheckCircle2 size={18} />
                  {order.isGift
                    ? 'Codes emailed to recipient — also saved here'
                    : 'Vouchers ready'}
                </div>
                {order.vouchers.map((v, i) => (
                  <div key={v.id || i} className="rounded-xl border border-white/10 bg-black/40 p-4">
                    {v.cardNumber && (
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-white/30">Card number</p>
                          <p className="mt-0.5 break-all font-mono text-sm text-white">{v.cardNumber}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copy(`n-${i}`, v.cardNumber!)}
                          className="rounded-lg border border-white/10 p-2 text-white/40"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    )}
                    {v.cardPin && (
                      <div className="mt-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-white/30">PIN</p>
                          <p className="mt-0.5 font-mono text-sm text-white">{v.cardPin}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copy(`p-${i}`, v.cardPin!)}
                          className="rounded-lg border border-white/10 p-2 text-white/40"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    )}
                    {copied && <p className="mt-2 text-[11px] text-[#5fae52]">Copied</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

export default GiftOrderStatusPage
