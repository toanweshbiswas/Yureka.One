import { Banner, PrimaryButton } from '@/components/Ui'
import { useAuth } from '@/lib/auth'
import { colors, space } from '@/lib/theme'
import { Link, Redirect } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function SignupScreen() {
  const { session, canEnterApp, signUpWithEmail } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (session && canEnterApp) return <Redirect href="/(app)/(tabs)/index" />

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, padding: space.lg, justifyContent: 'center', gap: space.md }}>
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: '800' }}>Join Yureka</Text>
          {error ? <Banner text={error} tone="danger" /> : null}
          {info ? <Banner text={info} /> : null}
          <TextInput placeholder="Full name" placeholderTextColor={colors.faint} value={fullName} onChangeText={setFullName} style={inputStyle} />
          <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.faint} value={email} onChangeText={setEmail} style={inputStyle} />
          <TextInput secureTextEntry placeholder="Password" placeholderTextColor={colors.faint} value={password} onChangeText={setPassword} style={inputStyle} />
          <PrimaryButton
            label={busy ? 'Creating…' : 'Create account'}
            disabled={busy || !email || password.length < 6}
            onPress={() => {
              setBusy(true)
              setError(null)
              void signUpWithEmail(email, password, fullName)
                .then((r) => {
                  if (r.needsConfirm) setInfo('Check your email to confirm, then sign in.')
                })
                .catch((e) => setError(e?.message || 'Could not sign up'))
                .finally(() => setBusy(false))
            }}
          />
          <Link href="/(auth)/login" asChild>
            <Pressable><Text style={{ color: colors.clay, textAlign: 'center' }}>Already have an account</Text></Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
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
