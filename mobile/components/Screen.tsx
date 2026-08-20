import { colors } from '@/lib/theme'
import { ActivityIndicator, View } from 'react-native'

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>{children}</View>
  )
}

export function CenteredSpinner() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.clay} />
    </View>
  )
}
