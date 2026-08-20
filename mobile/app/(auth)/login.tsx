import { Banner, PrimaryButton } from '@/components/Ui'
import { CenteredSpinner } from '@/components/Screen'
import { useAuth } from '@/lib/auth'
import { APP_URL } from '@/lib/config'
import { hapticError, hapticLight } from '@/lib/haptics'
import { colors, space } from '@/lib/theme'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Link, Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as WebBrowser from 'expo-web-browser'

export default function LoginScreen() {
  const { session, canEnterApp, status, signInWithEmail, signInWithGoogle, signInWithApple } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'apple' | 'google' | 'email' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [appleSignInAvailable, setAppleSignInAvailable] = useState(false)

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    void AppleAuthentication.isAvailableAsync().then(setAppleSignInAvailable)
  }, [])

  if (session && canEnterApp) return <Redirect href="/(app)/(tabs)/index" />
  if (session && !canEnterApp && status !== 'loading') return <Redirect href="/(auth)/waiting" />
  if (session && status === 'loading') return <CenteredSpinner />

  const run = async (kind: 'apple' | 'google' | 'email', fn: () => Promise<void>) => {
    setBusy(kind)
    setError(null)
    try {
      await hapticLight()
      await fn()
    } catch (e: unknown) {
      await hapticError()
      const message = e instanceof Error ? e.message : 'Could not sign in'
      if (message.toLowerCase().includes('cancel')) {
        setError('Sign-in was interrupted. Try again.')
      } else {
        setError(message)
      }
    } finally {
      setBusy(null)
    }
  }

  const disabled = busy !== null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, padding: space.lg, justifyContent: 'center', gap: space.md }}
        >
          <Image source={require('../../assets/images/yureka-logo.png')} style={{ width: 56, height: 56, borderRadius: 16 }} />
          <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.8 }}>Welcome back</Text>
          <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 22 }}>
            Sign in to your Goldback account. New here? Create an account, then join the waitlist.
          </Text>

          {error ? <Banner text={error} tone="danger" /> : null}

          {appleSignInAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={14}
              style={{ width: '100%', height: 50 }}
              onPress={() => void run('apple', signInWithApple)}
            />
          ) : null}

          <GoogleButton
            busy={busy === 'google'}
            disabled={disabled}
            onPress={() => void run('google', signInWithGoogle)}
          />

          <OrDivider />

          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            placeholder="Email"
            placeholderTextColor={colors.faint}
            value={email}
            onChangeText={setEmail}
            editable={!disabled}
            style={inputStyle}
          />
          <TextInput
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            placeholder="Password"
            placeholderTextColor={colors.faint}
            value={password}
            onChangeText={setPassword}
            editable={!disabled}
            style={inputStyle}
          />
          <PrimaryButton
            label={busy === 'email' ? 'Signing in…' : 'Sign in with email'}
            disabled={disabled || !email || !password}
            onPress={() => void run('email', () => signInWithEmail(email, password))}
          />

          <Link href="/(auth)/signup" asChild>
            <Pressable disabled={disabled} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <Text style={{ color: colors.muted, textAlign: 'center' }}>Create an account</Text>
            </Pressable>
          </Link>
          <Link href="/(auth)/forgot" asChild>
            <Pressable disabled={disabled} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <Text style={{ color: colors.faint, textAlign: 'center' }}>Forgot password</Text>
            </Pressable>
          </Link>
          <Pressable
            disabled={disabled}
            onPress={() => void WebBrowser.openBrowserAsync(`${APP_URL}/join-waitlist`)}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ color: colors.clay, textAlign: 'center' }}>Join the waitlist</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function GoogleButton({
  busy,
  disabled,
  onPress,
}: {
  busy: boolean
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: 50,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
        opacity: disabled && !busy ? 0.5 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {busy ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>Continue with Google</Text>
      )}
    </Pressable>
  )
}

function OrDivider() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: space.xs }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ color: colors.faint, fontSize: 13, letterSpacing: 0.2 }}>or use email</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
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
