import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { GiftCard } from '@backend/lib/hubble/types'
import {
  giftCardAmountAllowed,
  normalizeDenominations,
} from '@backend/lib/hubble/denominations'

const formatInr = (n: number) => `₹${n.toLocaleString('en-IN')}`
const spring = { type: 'spring' as const, bounce: 0, duration: 0.4 }

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void }
  }
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  return new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    )
    if (existing) {
      if (window.Razorpay) return resolve(true)
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => resolve(false))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function GiftingSection() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [cards, setCards] = useState<GiftCard[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutEnabled, setCheckoutEnabled] = useState(false)
  const [selected, setSelected] = useState<GiftCard | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const [senderName, setSenderName] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [buying, setBuying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [healthRes, listRes] = await Promise.all([
          fetch('/api/giftcards/health'),
          fetch('/api/giftcards?status=ACTIVE&limit=24'),
        ])
        const health = await healthRes.json().catch(() => ({}))
        const list = await listRes.json().catch(() => ({}))
        if (cancelled) return
        const mode = String(health?.data?.checkout || 'disabled')
        setCheckoutEnabled(Boolean(health?.data?.checkoutEnabled) && mode === 'razorpay')
        const items = Array.isArray(list?.data?.items)
          ? (list.data.items as GiftCard[])
          : Array.isArray(list?.data)
            ? (list.data as GiftCard[])
            : []
        setCards(items.filter((c) => c.status === 'ACTIVE').slice(0, 12))
      } catch {
        if (!cancelled) setCards([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selected) {
      setAmount(null)
      setError(null)
      return
    }
    const denoms = normalizeDenominations(selected.denominations)
    if (selected.minAmount != null) setAmount(selected.minAmount)
    else if (denoms.length) setAmount(denoms[0])
    else setAmount(null)
    setError(null)
  }, [selected])

  const denoms = useMemo(
    () => (selected ? normalizeDenominations(selected.denominations) : []),
    [selected],
  )
  const phoneDigits = senderPhone.replace(/\D/g, '').slice(-10)
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail.trim())
  const recipientOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())
  const amountOk = Boolean(selected && amount != null && giftCardAmountAllowed(selected, amount).ok)
  const canBuy =
    checkoutEnabled &&
    !!selected &&
    amountOk &&
    senderName.trim().length >= 2 &&
    emailOk &&
    phoneDigits.length === 10 &&
    recipientName.trim().length >= 2 &&
    recipientOk &&
    !buying

  const placeOrder = useCallback(async () => {
    if (!selected || amount == null || !canBuy) return
    setBuying(true)
    setError(null)
    try {
      const ready = await loadRazorpayScript()
      if (!ready || !window.Razorpay) {
        throw new Error('Could not load payment checkout. Check your connection and try again.')
      }

      const startRes = await fetch('/api/giftcards/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestCheckout: true,
          isGift: true,
          productId: selected.id,
          denomination: amount,
          quantity: 1,
          customerName: senderName.trim(),
          customerEmail: senderEmail.trim().toLowerCase(),
          customerPhone: phoneDigits,
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim().toLowerCase(),
          giftMessage: giftMessage.trim() || undefined,
        }),
      })
      const startJson = await startRes.json().catch(() => ({}))
      if (!startRes.ok || startJson.error) {
        throw new Error(startJson.error || 'Could not start checkout')
      }
      const data = startJson.data || {}

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: data.keyId,
          amount: data.amountPaise,
          currency: data.currency || 'INR',
          name: 'Yureka',
          description: data.productTitle || selected.title,
          order_id: data.razorpayOrderId,
          prefill: data.prefill || {
            name: senderName.trim(),
            email: senderEmail.trim(),
            contact: phoneDigits,
          },
          theme: { color: '#00933b' },
          handler: async (response: Record<string, string>) => {
            try {
              const verifyRes = await fetch('/api/giftcards/checkout/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: data.orderId,
                  guestToken: data.guestToken,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              })
              const verifyJson = await verifyRes.json().catch(() => ({}))
              if (!verifyRes.ok || verifyJson.error) {
                throw new Error(verifyJson.error || 'Payment verification failed')
              }
              const token = verifyJson.data?.guestToken || data.guestToken
              setSelected(null)
              resolve()
              if (token) navigate(`/gift/orders/${token}`)
              else reject(new Error('Missing order status link'))
            } catch (e: any) {
              reject(e)
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
        })
        rzp.open()
      })
    } catch (e: any) {
      const msg = String(e?.message || 'Checkout failed')
      if (!/cancelled/i.test(msg)) setError(msg)
    } finally {
      setBuying(false)
    }
  }, [
    selected,
    amount,
    canBuy,
    senderName,
    senderEmail,
    phoneDigits,
    recipientName,
    recipientEmail,
    giftMessage,
    navigate,
  ])

  return (
    <section id="gifting" className="relative w-full scroll-mt-24 bg-black px-6 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-5xl md:max-w-[60vw]">
        <p
          style={{ fontFamily: 'Inter, sans-serif' }}
          className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40"
        >
          Gift cards
        </p>
        <h2
          style={{ fontFamily: 'Inter, sans-serif' }}
          className="mt-3 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] text-white sm:text-[40px]"
        >
          Send a gift{' '}
          <span
            style={{ fontFamily: '"Playfair Display", serif' }}
            className="italic font-semibold text-[#5fae52]"
          >
            without signing up
          </span>
        </h2>
        <p
          style={{ fontFamily: 'Inter, sans-serif' }}
          className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/50 sm:text-[16px]"
        >
          Pick a brand, pay securely, and we email the voucher codes to your person — no Yureka
          account required.
        </p>

        {loading ? (
          <div className="mt-12 flex justify-center py-16">
            <Loader2 className="animate-spin text-[#5fae52]" size={28} />
          </div>
        ) : cards.length === 0 ? (
          <p className="mt-10 text-sm text-white/40">Gift cards are temporarily unavailable.</p>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card, index) => (
              <motion.button
                key={card.id}
                type="button"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ ...spring, delay: reduceMotion ? 0 : Math.min(index * 0.03, 0.2) }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelected(card)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04] text-left backdrop-blur-xl active:scale-[0.98]"
              >
                <div className="flex aspect-[4/3] items-center justify-center bg-white/95 p-4">
                  {card.imageUrl || card.logoUrl ? (
                    <img
                      src={card.imageUrl || card.logoUrl || ''}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-black/40">{card.brand}</span>
                  )}
                </div>
                <div className="px-3 py-3">
                  <p className="truncate text-[13px] font-semibold tracking-[-0.02em] text-white">
                    {card.title}
                  </p>
                  <p className="mt-1 text-[11px] text-white/40">
                    {card.minAmount != null
                      ? `From ${formatInr(card.minAmount)}`
                      : denomsPreview(card)}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {!checkoutEnabled && !loading && (
          <p className="mt-6 text-[13px] text-amber-200/80">
            Checkout is temporarily paused. You can still browse brands above.
          </p>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <>
            <motion.button
              type="button"
              aria-label="Close"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => !buying && setSelected(null)}
            />
            <motion.aside
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
              transition={spring}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[1.75rem] border border-white/15 bg-[#0c0c0c] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-6 sm:w-full sm:max-w-md sm:rounded-[1.75rem]"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                    Gift someone
                  </p>
                  <h3 className="mt-1 text-[18px] font-bold tracking-[-0.02em] text-white">
                    {selected.title}
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={buying}
                  onClick={() => setSelected(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/70 active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                    Amount
                  </p>
                  {denoms.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {denoms.slice(0, 8).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setAmount(d)}
                          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                            amount === d
                              ? 'bg-[#5fae52] text-black'
                              : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {formatInr(d)}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    type="number"
                    min={1}
                    value={amount ?? ''}
                    onChange={(e) => setAmount(e.target.value ? Math.ceil(Number(e.target.value)) : null)}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white"
                    placeholder="Custom amount"
                  />
                </div>

                <Field label="Your name" value={senderName} onChange={setSenderName} placeholder="Your name" />
                <Field
                  label="Your email"
                  value={senderEmail}
                  onChange={setSenderEmail}
                  placeholder="you@email.com"
                  type="email"
                />
                <Field
                  label="Your mobile"
                  value={senderPhone}
                  onChange={(v) => setSenderPhone(v.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                />
                <Field
                  label="Recipient name"
                  value={recipientName}
                  onChange={setRecipientName}
                  placeholder="Who is this for?"
                />
                <Field
                  label="Recipient email"
                  value={recipientEmail}
                  onChange={setRecipientEmail}
                  placeholder="friend@email.com"
                  type="email"
                />
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                    Message (optional)
                  </p>
                  <textarea
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value.slice(0, 280))}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white"
                    placeholder="Happy birthday — enjoy this on me"
                  />
                </div>

                {error && (
                  <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  disabled={!canBuy}
                  onClick={() => void placeOrder()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5fae52] py-3.5 text-[12px] font-bold uppercase tracking-[0.16em] text-black disabled:opacity-40 active:scale-[0.98]"
                >
                  {buying ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Opening payment…
                    </>
                  ) : (
                    <>Gift {amount != null ? formatInr(amount) : ''}</>
                  )}
                </button>
                <p className="pb-2 text-[11px] leading-relaxed text-white/35">
                  No account needed. After payment, we email the codes to your recipient and confirm
                  to you.
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </section>
  )
}

function denomsPreview(card: GiftCard) {
  const d = normalizeDenominations(card.denominations)
  if (!d.length) return 'Choose amount'
  return `From ${formatInr(d[0])}`
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  type?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">{label}</p>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white"
      />
    </div>
  )
}
