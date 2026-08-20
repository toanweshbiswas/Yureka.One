import { Banner } from '@/components/Ui'
import { CenteredSpinner } from '@/components/Screen'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatPaise } from '@/lib/format'
import { hapticLight } from '@/lib/haptics'
import { colors, space } from '@/lib/theme'
import { Host } from '@expo/ui'
import SegmentedControl from '@expo/ui/community/segmented-control'
import { FlashList } from '@shopify/flash-list'
import { useNavigation } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Image, Pressable, RefreshControl, Text, View } from 'react-native'

type Tab = 'marketplace' | 'goldback'

type MarketOffer = {
  id: string
  merchant: string
  title: string
  description: string
  couponCode: string | null
  imageUrl: string | null
  affiliateUrl: string
  url: string
  categories: string[]
}

type GoldbackOffer = {
  id: string
  title: string
  merchant: string
  category: string
  description: string
  url: string
  imageUrl?: string | null
  rewardPaise: number
  rewardLabel: string
  active: boolean
}

export default function OffersScreen() {
  const { user } = useAuth()
  const navigation = useNavigation()
  const userId = user?.id || user?.email || ''
  const [tab, setTab] = useState<Tab>('marketplace')
  const [query, setQuery] = useState('')
  const [market, setMarket] = useState<MarketOffer[]>([])
  const [gold, setGold] = useState<GoldbackOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: 'Search offers',
        hideWhenScrolling: false,
        autoCapitalize: 'none',
        onChangeText: (e: { nativeEvent: { text: string } }) => setQuery(e.nativeEvent.text),
        onCancelButtonPress: () => setQuery(''),
      },
    })
  }, [navigation])

  const load = useCallback(
    async (silent?: boolean) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        const [m, g] = await Promise.all([
          apiFetch<{ items?: MarketOffer[] }>('/api/marketplace/offers'),
          userId
            ? apiFetch<GoldbackOffer[]>('/api/goldback/offers', { userId })
            : Promise.resolve({ data: [] as GoldbackOffer[] | null, status: 200 }),
        ])
        setMarket(m.data?.items || [])
        setGold((g.data || []).filter((o) => o.active !== false))
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not load offers')
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

  const q = query.trim().toLowerCase()
  const marketRows = useMemo(
    () => market.filter((o) => !q || `${o.title} ${o.merchant}`.toLowerCase().includes(q)),
    [market, q],
  )
  const goldRows = useMemo(
    () => gold.filter((o) => !q || `${o.title} ${o.merchant}`.toLowerCase().includes(q)),
    [gold, q],
  )

  const openOffer = async (url: string) => {
    await hapticLight()
    if (url) await WebBrowser.openBrowserAsync(url)
  }

  if (loading && !market.length && !gold.length) return <CenteredSpinner />

  const rows: Array<MarketOffer | GoldbackOffer> = tab === 'marketplace' ? marketRows : goldRows

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.sm }}>
        <Host matchContents colorScheme="dark" seedColor={colors.clay}>
          <SegmentedControl
            values={['Marketplace', 'Goldback']}
            selectedIndex={tab === 'marketplace' ? 0 : 1}
            onChange={(e) => setTab(e.nativeEvent.selectedSegmentIndex === 0 ? 'marketplace' : 'goldback')}
          />
        </Host>
        {error ? <View style={{ marginTop: space.sm }}><Banner text={error} tone="danger" /></View> : null}
      </View>
      <FlashList
        style={{ flex: 1 }}
        data={rows}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: space.md, paddingBottom: 40 }}
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
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>No offers match that filter.</Text>
        }
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (tab === 'marketplace') {
            const o = item as MarketOffer
            return (
              <Pressable
                onPress={() => void openOffer(o.affiliateUrl || o.url)}
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
                {o.imageUrl ? (
                  <Image source={{ uri: o.imageUrl }} style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#fff' }} />
                ) : (
                  <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.clayDim }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={2}>
                    {o.title}
                  </Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }} numberOfLines={1}>
                    {o.merchant}
                  </Text>
                  {o.couponCode ? <Text style={{ color: colors.clay, marginTop: 4 }}>{o.couponCode}</Text> : null}
                </View>
              </Pressable>
            )
          }
          const o = item as unknown as GoldbackOffer
          return (
            <Pressable
              onPress={() => void openOffer(o.url)}
              style={{
                padding: 14,
                backgroundColor: colors.card,
                borderRadius: 16,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>{o.title}</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{o.merchant}</Text>
              <Text style={{ color: colors.clay, marginTop: 8 }}>{o.rewardLabel || formatPaise(o.rewardPaise)}</Text>
            </Pressable>
          )
        }}
      />
    </View>
  )
}
