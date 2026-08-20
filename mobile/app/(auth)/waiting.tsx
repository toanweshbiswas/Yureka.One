import { Banner, GhostButton, PrimaryButton } from '@/components/Ui'
import { useAuth } from '@/lib/auth'
import { APP_URL, CONTACT_URL } from '@/lib/config'
import { colors, space } from '@/lib/theme'
import { Redirect } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function WaitingScreen() {
  const { session, status, canEnterApp, refreshStatus, signOut } = useAuth()
  if (!session) return <Redirect href="/(auth)/login" />
  if (canEnterApp) return <Redirect href="/(app)/(tabs)/index" />

  const copy =
    status === 'rejected'
      ? 'This account is not approved. Write to support if that looks wrong.'
      : status === 'on-hold'
        ? 'Your membership is on hold. We’ll email you when it opens.'
        : status === 'none'
          ? 'You’re signed in, but not on the waitlist yet.'
          : 'You’re on the waitlist. We’ll let you in as soon as a seat opens.'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, padding: space.lg, justifyContent: 'center', gap: space.md }}>
        <Text style={{ color: colors.text, fontSize: 32, fontWeight: '800' }}>Almost there</Text>
        <Banner text={copy} />
        {status === 'none' ? (
          <PrimaryButton
            label="Join the waitlist"
            onPress={() => void WebBrowser.openBrowserAsync(`${APP_URL}/join-waitlist`)}
          />
        ) : null}
        <PrimaryButton label="Refresh status" onPress={() => void refreshStatus()} />
        <GhostButton label="Contact support" onPress={() => void WebBrowser.openBrowserAsync(CONTACT_URL)} />
        <GhostButton label="Sign out" onPress={() => void signOut()} />
      </View>
    </SafeAreaView>
  )
}
