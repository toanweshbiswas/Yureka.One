import { Banner, PrimaryButton } from '@/components/Ui'
import { TERMS_URL } from '@/lib/config'
import { formatInr, giftCardAmountOk } from '@/lib/format'
import { colors, space } from '@/lib/theme'
import { BottomSheet, Host, RNHostView } from '@expo/ui'
import * as WebBrowser from 'expo-web-browser'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'

export type GiftCardProduct = {
  id: string
  title: string
  brand: string
  description: string
  denominations: number[]
  minAmount: number | null
  maxAmount: number | null
  redeemSites?: Array<{ label: string; url: string }>
}

export function GiftCardBuySheet({
  selected,
  amount,
  setAmount,
  name,
  setName,
  phone,
  setPhone,
  buying,
  buyError,
  canBuy,
  onBuy,
  onClose,
}: {
  selected: GiftCardProduct | null
  amount: number | null
  setAmount: (n: number | null) => void
  name: string
  setName: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  buying: boolean
  buyError: string | null
  canBuy: boolean
  onBuy: () => void
  onClose: () => void
}) {
  const chips = selected?.denominations?.length
    ? selected.denominations
    : [500, 1000, 2000].filter((n) => (selected ? giftCardAmountOk(selected, n) : false))

  if (!selected) return null

  return (
    <Host colorScheme="dark" seedColor={colors.clay}>
      <BottomSheet isPresented onDismiss={onClose} snapPoints={['full']} showDragIndicator>
        <RNHostView matchContents>
          <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 48 }}>
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.clay, fontWeight: '700' }}>Close</Text>
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>{selected?.title}</Text>
            {selected?.description ? <Text style={{ color: colors.muted }}>{selected.description}</Text> : null}

            <Text style={{ color: colors.faint, fontSize: 11, letterSpacing: 2, fontWeight: '800' }}>AMOUNT</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {chips.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setAmount(d)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: amount === d ? colors.clay : colors.border,
                    backgroundColor: amount === d ? colors.clayDim : colors.card,
                  }}
                >
                  <Text style={{ color: amount === d ? colors.clay : colors.muted, fontWeight: '700' }}>{formatInr(d)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              keyboardType="number-pad"
              placeholder="Custom amount"
              placeholderTextColor={colors.faint}
              value={amount != null ? String(amount) : ''}
              onChangeText={(t) => setAmount(t ? Number(t) : null)}
              style={inputStyle}
            />
            {selected?.minAmount != null && selected.maxAmount != null ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Any amount from {formatInr(selected.minAmount)} to {formatInr(selected.maxAmount)}
              </Text>
            ) : null}

            {!!selected?.redeemSites?.length && (
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.faint, fontSize: 11, letterSpacing: 2, fontWeight: '800' }}>REDEEM AT</Text>
                {selected.redeemSites.map((s) => (
                  <Pressable key={s.url} onPress={() => void WebBrowser.openBrowserAsync(s.url)}>
                    <Text style={{ color: colors.clay, fontWeight: '700' }}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <TextInput placeholder="Your name" placeholderTextColor={colors.faint} value={name} onChangeText={setName} style={inputStyle} />
            <TextInput
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="10-digit mobile"
              placeholderTextColor={colors.faint}
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
              style={inputStyle}
            />
            {buyError ? <Banner text={buyError} tone="danger" /> : null}
            <PrimaryButton
              label={buying ? 'Opening payment…' : amount != null ? `Pay ${formatInr(amount)}` : 'Pay'}
              disabled={!canBuy}
              onPress={onBuy}
            />
            <Pressable onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)}>
              <Text style={{ color: colors.clay, textAlign: 'center' }}>Terms & conditions</Text>
            </Pressable>
          </ScrollView>
        </RNHostView>
      </BottomSheet>
    </Host>
  )
}

const inputStyle = {
  backgroundColor: colors.card,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: 14,
  color: colors.text,
  paddingHorizontal: 16,
  paddingVertical: 14,
  fontSize: 16,
} as const
