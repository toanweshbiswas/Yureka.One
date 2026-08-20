import { AuthProvider, useAuth } from '@/lib/auth'
import { colors } from '@/lib/theme'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import React, { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import 'react-native-reanimated'

SplashScreen.preventAutoHideAsync().catch(() => undefined)

function SplashGate({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth()
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])
  return children
}

export default function RootLayout() {
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg)
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <SplashGate>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="auth/callback" />
            </Stack>
          </SplashGate>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
