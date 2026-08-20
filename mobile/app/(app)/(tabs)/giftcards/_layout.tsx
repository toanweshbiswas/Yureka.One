import { colors } from '@/lib/theme'
import { Stack } from 'expo-router'

export default function GiftCardsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerLargeTitle: true,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Gift cards' }} />
      <Stack.Screen name="[orderId]" options={{ title: 'Order', headerLargeTitle: false }} />
    </Stack>
  )
}
