import { Link, Stack } from 'expo-router'
import { Text, View } from 'react-native'
import { colors, space } from '@/lib/theme'

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space.lg, justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>This screen is gone.</Text>
        <Link href="/" style={{ marginTop: 16 }}>
          <Text style={{ color: colors.clay }}>Go home</Text>
        </Link>
      </View>
    </>
  )
}
