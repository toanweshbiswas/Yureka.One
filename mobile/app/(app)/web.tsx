import { AppWebView } from '@/components/AppWebView'
import { useAuth } from '@/lib/auth'
import { colors, space } from '@/lib/theme'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'

const TITLES: Record<string, string> = {
  '/dashboard/expenses': 'Expenses',
  '/dashboard/planning': 'Planning',
  '/dashboard/bills': 'Bills',
  '/dashboard/referrals': 'Referrals',
  '/dashboard/profile': 'Profile',
  '/dashboard/home': 'Home',
}

export default function WebScreen() {
  const router = useRouter()
  const navigation = useNavigation()
  const { session } = useAuth()
  const { path, title } = useLocalSearchParams<{ path?: string; title?: string }>()

  const resolvedPath = path || '/dashboard/home'
  const label = title || TITLES[resolvedPath] || 'Yureka'

  // Set the native navigation header title to the section name
  useEffect(() => {
    navigation.setOptions({ title: label })
  }, [navigation, label])

  // If there is a valid session, inject it into the WebView so the web app
  // recognises the user and skips its own login screen.
  if (session) {
    return <AppWebView path={resolvedPath} />
  }

  // Fallback: no session — show a prompt instead of a blank WebView.
  return (
    <View style={{ flex: 1, padding: space.lg, justifyContent: 'center', gap: space.md }}>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.6 }}>
        {label}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 22 }}>
        Sign in to access {label.toLowerCase()} on Yureka.
      </Text>
      <Pressable
        onPress={() => router.replace('/(auth)/login')}
        style={({ pressed }) => ({
          marginTop: space.sm,
          height: 50,
          borderRadius: 14,
          backgroundColor: pressed ? colors.clayDim : colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Text style={{ color: colors.clay, fontSize: 17, fontWeight: '600' }}>Sign in</Text>
      </Pressable>
    </View>
  )
}
