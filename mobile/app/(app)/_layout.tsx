import { useAuth } from '@/lib/auth'
import { colors } from '@/lib/theme'
import { Redirect, Stack } from 'expo-router'

export default function AppLayout() {
  const { session, canEnterApp, ready } = useAuth()
  if (ready && !session) return <Redirect href="/(auth)/login" />
  if (ready && session && !canEnterApp) return <Redirect href="/(auth)/waiting" />

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="web" options={{ title: 'Yureka', headerBackTitle: 'Back' }} />
    </Stack>
  )
}
