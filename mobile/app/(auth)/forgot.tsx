import { Banner, PrimaryButton } from '@/components/Ui'
import { useAuth } from '@/lib/auth'
import { colors, space } from '@/lib/theme'
import { Link } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function ForgotScreen() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, padding: space.lg, justifyContent: 'center', gap: space.md }}>
        <Text style={{ color: colors.text, fontSize: 32, fontWeight: '800' }}>Reset password</Text>
        {error ? <Banner text={error} tone="danger" /> : null}
        {info ? <Banner text={info} /> : null}
        <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.faint} value={email} onChangeText={setEmail} style={inputStyle} />
        <PrimaryButton
          label={busy ? 'Sending…' : 'Send reset link'}
          disabled={busy || !email}
          onPress={() => {
            setBusy(true)
            setError(null)
            void resetPassword(email)
              .then(() => setInfo('If that email is on Yureka, a reset link is on the way.'))
              .catch((e) => setError(e?.message || 'Could not send reset'))
              .finally(() => setBusy(false))
          }}
        />
        <Link href="/(auth)/login" asChild>
          <Pressable><Text style={{ color: colors.clay, textAlign: 'center' }}>Back to sign in</Text></Pressable>
        </Link>
      </View>
    </SafeAreaView>
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
