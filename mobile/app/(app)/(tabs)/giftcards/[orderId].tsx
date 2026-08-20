import { Banner } from '@/components/Ui'
import { CenteredSpinner } from '@/components/Screen'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatInr } from '@/lib/format'
import { hapticSuccess } from '@/lib/haptics'
import { colors, space } from '@/lib/theme'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

type Voucher = {
  id: string
  cardNumber: string | null
  cardPin: string | null
  amount: number | null
  validTill: string | null
}

type Order = {
  id: string
  productTitle: string
  amountInr: number
  denomination: number
  quantity: number
  status: string
  failureReason: string | null
  productId: string
  vouchers: Voucher[]
}

type Card = { redeemSites?: Array<{ label: string; url: string }> }

export default function GiftCardOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const { user } = useAuth()
  const userId = user?.id || user?.email || ''
  const [order, setOrder] = useState<Order | null>(null)
  const [card, setCard] = useState<Card | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await apiFetch<Order>(`/api/giftcards/orders/${orderId}`, { userId })
      setOrder(res.data)
      if (res.data?.productId) {
        const c = await apiFetch<Card>(`/api/giftcards/${res.data.productId}`)
        setCard(c.data)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load order')
    } finally {
      setLoading(false)
    }
  }, [orderId, userId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <CenteredSpinner />
  if (error || !order) {
    return (
      <View style={{ padding: space.lg }}>
        <Banner text={error || 'Order not found'} tone="danger" />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
    >
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{order.productTitle}</Text>
      <Text style={{ color: colors.muted }}>
        {formatInr(order.amountInr)} · {order.status}
      </Text>
      {order.status === 'FAILED' ? <Banner text={order.failureReason || 'Order failed'} tone="danger" /> : null}
      {order.vouchers.map((v) => (
        <View
          key={v.id}
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: space.md,
            gap: 10,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {v.cardNumber ? (
            <Pressable
              onPress={() => {
                void Clipboard.setStringAsync(v.cardNumber!)
                void hapticSuccess()
              }}
            >
              <Text style={{ color: colors.faint, fontSize: 11 }}>CARD NUMBER</Text>
              <Text style={{ color: colors.text, fontFamily: 'Menlo', marginTop: 4 }}>{v.cardNumber}</Text>
              <Text style={{ color: colors.clay, marginTop: 6 }}>Tap to copy</Text>
            </Pressable>
          ) : null}
          {v.cardPin ? (
            <Pressable
              onPress={() => {
                void Clipboard.setStringAsync(v.cardPin!)
                void hapticSuccess()
              }}
            >
              <Text style={{ color: colors.faint, fontSize: 11 }}>PIN</Text>
              <Text style={{ color: colors.text, fontFamily: 'Menlo', marginTop: 4 }}>{v.cardPin}</Text>
              <Text style={{ color: colors.clay, marginTop: 6 }}>Tap to copy</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {card?.redeemSites?.map((s) => (
        <Pressable key={s.url} onPress={() => void WebBrowser.openBrowserAsync(s.url)}>
          <Text style={{ color: colors.clay, fontWeight: '700' }}>Redeem at {s.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}
