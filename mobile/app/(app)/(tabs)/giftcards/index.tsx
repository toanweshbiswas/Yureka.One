import { Banner } from '@/components/Ui'
import { CenteredSpinner } from '@/components/Screen'
import { GiftCardBuySheet, type GiftCardProduct } from '@/components/GiftCardBuySheet'
import { RazorpayCheckoutModal, type RazorpayCheckoutParams } from '@/components/RazorpayCheckout'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatInr, giftCardAmountOk } from '@/lib/format'
import { hapticError, hapticLight, hapticSuccess } from '@/lib/haptics'
import { colors, space } from '@/lib/theme'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, Pressable, RefreshControl, Text, TextInput, View } from 'react-native'

type GiftCard = GiftCardProduct & {
  imageUrl: string | null
  logoUrl: string | null
  redemptionType: string
  howToUse: string[]
}

export default function GiftCardsScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const userId = user?.id || user?.email || ''
  const [items, setItems] = useState<GiftCard[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<GiftCard | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [buying, setBuying] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [rzp, setRzp] = useState<RazorpayCheckoutParams | null>(null)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)

  const load = useCallback(
    async (silent?: boolean) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        const res = await apiFetch<{ items?: GiftCard[] }>('/api/giftcards?status=ACTIVE', { userId })
        setItems(res.data?.items || [])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not load gift cards')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [userId],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selected) return
    setAmount(selected.minAmount ?? selected.denominations[0] ?? null)
    setName(String(user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''))
    setBuyError(null)
  }, [selected, user])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((c) => `${c.title} ${c.brand}`.toLowerCase().includes(q))
  }, [items, query])

  const amountOk = selected && amount != null && giftCardAmountOk(selected, amount)
  const phoneDigits = phone.replace(/\D/g, '').slice(-10)
  const canBuy = Boolean(amountOk && name.trim().length >= 2 && phoneDigits.length === 10 && !buying)

  const buy = async () => {
    if (!selected || amount == null) return
    setBuying(true)
    setBuyError(null)
    try {
      await hapticLight()
      const json = await apiFetch<{
        orderId: string
        keyId: string
        razorpayOrderId: string
        amountPaise: number
        currency: string
        productTitle: string
        prefill?: { name?: string; email?: string; contact?: string }
      }>('/api/giftcards/checkout', {
        method: 'POST',
        userId,
        body: JSON.stringify({
          productId: selected.id,
          denomination: amount,
          quantity: 1,
          customerName: name.trim(),
          customerEmail: user?.email || 'noreply@yureka.one',
          customerPhone: phoneDigits,
        }),
      })
      const data = json.data
      if (!data) throw new Error('Checkout failed')
      setPendingOrderId(data.orderId)
      setRzp({
        keyId: data.keyId,
        amountPaise: data.amountPaise,
        currency: data.currency,
        razorpayOrderId: data.razorpayOrderId,
        description: data.productTitle,
        prefill: data.prefill,
      })
    } catch (e: unknown) {
      await hapticError()
      setBuyError(e instanceof Error ? e.message : 'Could not start checkout')
    } finally {
      setBuying(false)
    }
  }

  if (loading && !items.length) return <CenteredSpinner />

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TextInput
        placeholder="Search brands"
        placeholderTextColor={colors.faint}
        value={query}
        onChangeText={setQuery}
        style={{
          margin: space.md,
          backgroundColor: colors.card,
          borderRadius: 12,
          color: colors.text,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />
      {error ? (
        <View style={{ paddingHorizontal: space.md }}>
          <Banner text={error} tone="danger" />
        </View>
      ) : null}
      <FlashList
        style={{ flex: 1 }}
        data={visible}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            tintColor={colors.clay}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void load(true)
            }}
          />
        }
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelected(item)}
            style={{
              flexDirection: 'row',
              gap: 12,
              padding: 12,
              backgroundColor: colors.card,
              borderRadius: 16,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {item.imageUrl || item.logoUrl ? (
              <Image source={{ uri: item.imageUrl || item.logoUrl || '' }} style={{ width: 56, height: 56, borderRadius: 12 }} />
            ) : (
              <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.clayDim }} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }} numberOfLines={1}>
                {item.minAmount != null && item.maxAmount != null
                  ? `${formatInr(item.minAmount)}–${formatInr(item.maxAmount)}`
                  : item.redemptionType.replace(/_/g, ' ').toLowerCase()}
              </Text>
            </View>
          </Pressable>
        )}
      />

      <GiftCardBuySheet
        selected={selected}
        amount={amount}
        setAmount={setAmount}
        name={name}
        setName={setName}
        phone={phone}
        setPhone={setPhone}
        buying={buying}
        buyError={buyError}
        canBuy={canBuy}
        onBuy={() => void buy()}
        onClose={() => setSelected(null)}
      />

      <RazorpayCheckoutModal
        visible={!!rzp}
        params={rzp}
        onCancel={() => setRzp(null)}
        onSuccess={(response) => {
          const orderId = pendingOrderId
          setRzp(null)
          if (!orderId) return
          void apiFetch('/api/giftcards/checkout/verify', {
            method: 'POST',
            userId,
            body: JSON.stringify({
              orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }),
          })
            .then(async () => {
              await hapticSuccess()
              setSelected(null)
              router.push(`/(app)/(tabs)/giftcards/${orderId}`)
            })
            .catch(async (e: unknown) => {
              await hapticError()
              setBuyError(e instanceof Error ? e.message : 'Payment verification failed')
            })
        }}
      />
    </View>
  )
}
