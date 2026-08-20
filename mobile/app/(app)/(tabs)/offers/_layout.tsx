import { colors } from '@/lib/theme'
import { Stack } from 'expo-router'

export default function OffersStack() {
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
      <Stack.Screen
        name="index"
        options={{
          title: 'Offers',
          headerSearchBarOptions: {
            placeholder: 'Search offers',
            hideWhenScrolling: false,
            autoCapitalize: 'none',
          },
        }}
      />
    </Stack>
  )
}
