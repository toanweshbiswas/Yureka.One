import { Host, Button } from '@expo/ui'
import { colors, space } from '@/lib/theme'
import { Text, View } from 'react-native'

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Host matchContents colorScheme="dark" seedColor={colors.clay}>
      <Button label={label} onPress={onPress} disabled={disabled} variant="filled" />
    </Host>
  )
}

export function GhostButton({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  return (
    <Host matchContents colorScheme="dark" seedColor={colors.clay}>
      <Button label={label} onPress={onPress} variant="text" />
    </Host>
  )
}

export function Banner({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'danger' | 'warn' }) {
  const bg = tone === 'danger' ? colors.dangerDim : tone === 'warn' ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.04)'
  const fg = tone === 'danger' ? colors.danger : tone === 'warn' ? '#fbbf24' : colors.muted
  return (
    <View style={{ backgroundColor: bg, borderRadius: 14, padding: space.md, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: fg, fontSize: 13, lineHeight: 18 }}>{text}</Text>
    </View>
  )
}
