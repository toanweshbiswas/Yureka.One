import { useAuth } from '@/lib/auth'
import { CONTACT_URL, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/lib/config'
import { hapticLight } from '@/lib/haptics'
import { colors, space } from '@/lib/theme'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Children } from 'react'

const WEB_LINKS = [
  { label: 'Expenses', path: '/dashboard/expenses' },
  { label: 'Planning', path: '/dashboard/planning' },
  { label: 'Bills', path: '/dashboard/bills' },
  { label: 'Referrals', path: '/dashboard/referrals' },
  { label: 'Profile', path: '/dashboard/profile' },
  { label: 'Full web dashboard', path: '/dashboard/home' },
]

export default function MoreScreen() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      <Text style={{ color: colors.muted, paddingHorizontal: space.md, paddingTop: 8 }}>{user?.email}</Text>
      <View style={{ paddingHorizontal: space.md, paddingTop: space.md, gap: space.md }}>
        <SettingsGroup>
          {WEB_LINKS.map((item) => (
            <SettingsRow
              key={item.label}
              label={item.label}
              onPress={() => {
                void hapticLight()
                router.push({ pathname: '/(app)/web', params: { path: item.path } })
              }}
            />
          ))}
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow label="Terms of Service" onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)} />
          <SettingsRow label="Privacy Policy" onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)} />
          <SettingsRow
            label="Contact support"
            detail={SUPPORT_EMAIL}
            onPress={() => void WebBrowser.openBrowserAsync(CONTACT_URL)}
          />
        </SettingsGroup>
        <SettingsGroup>
          <SettingsRow
            label="Sign out"
            onPress={() => {
              void hapticLight()
              void signOut()
            }}
          />
        </SettingsGroup>
      </View>
      <Text style={{ color: colors.faint, fontSize: 13, marginTop: 12, paddingHorizontal: space.md }}>
        The Chrome extension is desktop-only. Open yureka.one on a computer to install it.
      </Text>
    </ScrollView>
  )
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  const rows = Children.toArray(children)
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      }}
    >
      {rows.map((child, index) => (
        <View key={index} style={{ borderTopWidth: index > 0 ? 1 : 0, borderTopColor: colors.border }}>
          {child}
        </View>
      ))}
    </View>
  )
}

function SettingsRow({
  label,
  detail,
  onPress,
}: {
  label: string
  detail?: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: space.md,
        paddingVertical: 14,
        backgroundColor: pressed ? colors.clayDim : 'transparent',
      })}
    >
      <Text style={{ color: colors.text, fontWeight: '600', fontSize: 17 }}>{label}</Text>
      {detail ? <Text style={{ color: colors.muted, marginTop: 2, fontSize: 13 }}>{detail}</Text> : null}
    </Pressable>
  )
}
