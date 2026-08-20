import { Banner } from '@/components/Ui'
import { CenteredSpinner } from '@/components/Screen'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatPaise } from '@/lib/format'
import { hapticLight } from '@/lib/haptics'
import { colors, space } from '@/lib/theme'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'

type Balance = { userId: string; balancePaise: number; updatedAt: string }
type Ledger = { id: string; amountPaise: number; type: string; status: string; createdAt: string }

const ACTIONS: Array<{ label: string; supporting: string; href?: '/(app)/(tabs)/offers' | '/(app)/(tabs)/giftcards'; path?: string }> = [
  { label: 'Offers', supporting: 'Partner deals', href: '/(app)/(tabs)/offers' },
  { label: 'Gift cards', supporting: 'Buy and redeem', href: '/(app)/(tabs)/giftcards' },
  { label: 'Expenses', supporting: 'Inbox sync on the web', path: '/dashboard/expenses' },
  { label: 'Planning', supporting: 'Budgets', path: '/dashboard/planning' },
  { label: 'Bills', supporting: 'Upcoming', path: '/dashboard/bills' },
  { label: 'Referrals', supporting: 'Invite friends', path: '/dashboard/referrals' },
  { label: 'Profile', supporting: 'Account', path: '/dashboard/profile' },
]

export default function HomeScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const userId = user?.id || user?.email || ''
  const [balance, setBalance] = useState<Balance | null>(null)
  const [ledger, setLedger] = useState<Ledger[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (silent?: boolean) => {
      if (!userId) return
      if (!silent) setLoading(true)
      setError(null)
      try {
        const [b, l] = await Promise.all([
          apiFetch<Balance>(`/api/goldback/balance?userId=${encodeURIComponent(userId)}`, { userId }),
          apiFetch<Ledger[]>(`/api/goldback/ledger?userId=${encodeURIComponent(userId)}`, { userId }),
        ])
        setBalance(b.data)
        setLedger(Array.isArray(l.data) ? l.data.slice(0, 8) : [])
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not load Goldback')
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

  const name =
    String(user?.user_metadata?.full_name || user?.user_metadata?.name || '')
      .trim()
      .split(/\s+/)[0] || 'there'

  if (loading && !balance) return <CenteredSpinner />

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={
        <RefreshControl
          tintColor={colors.clay}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true)
            void hapticLight()
            void load(true)
          }}
        />
      }
    >
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.md }}>
        <Text style={{ color: colors.muted, fontSize: 15 }}>Hi {name}</Text>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 24,
            padding: space.lg,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              color: colors.faint,
              fontSize: 11,
              letterSpacing: 2,
              fontWeight: '800',
              textTransform: 'uppercase',
            }}
          >
            Live balance
          </Text>
          <Text style={{ color: colors.text, fontSize: 42, fontWeight: '800', letterSpacing: -1.2, marginTop: 8 }}>
            {formatPaise(balance?.balancePaise ?? 0)}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>Redeemable at face value</Text>
        </View>
        {error ? <Banner text={error} tone="danger" /> : null}
      </View>

      <View
        style={{
          marginHorizontal: space.lg,
          marginTop: space.md,
          backgroundColor: colors.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
        }}
      >
        {ACTIONS.map((item, index) => (
          <Pressable
            key={item.label}
            onPress={() => {
              void hapticLight()
              if (item.href) router.push(item.href)
              else if (item.path) router.push({ pathname: '/(app)/web', params: { path: item.path } })
            }}
            style={({ pressed }) => ({
              paddingHorizontal: space.lg,
              paddingVertical: 14,
              backgroundColor: pressed ? colors.clayDim : 'transparent',
              borderTopWidth: index > 0 ? 1 : 0,
              borderTopColor: colors.border,
            })}
          >
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 17 }}>{item.label}</Text>
            <Text style={{ color: colors.muted, marginTop: 2, fontSize: 13 }}>{item.supporting}</Text>
          </Pressable>
        ))}
      </View>

      {ledger.length ? (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, gap: 8 }}>
          <Text
            style={{ color: colors.faint, fontSize: 11, letterSpacing: 2, fontWeight: '800', textTransform: 'uppercase' }}
          >
            Activity
          </Text>
          {ledger.map((row) => (
            <View key={row.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ color: colors.muted }}>{row.type}</Text>
              <Text style={{ color: colors.clay, fontWeight: '700' }}>{formatPaise(row.amountPaise)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  )
}
