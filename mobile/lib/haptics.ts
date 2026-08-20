import * as Haptics from 'expo-haptics'
import { AccessibilityInfo } from 'react-native'

export async function hapticLight() {
  const reduce = await AccessibilityInfo.isReduceMotionEnabled()
  if (reduce) return
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

export async function hapticSuccess() {
  const reduce = await AccessibilityInfo.isReduceMotionEnabled()
  if (reduce) return
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}

export async function hapticError() {
  const reduce = await AccessibilityInfo.isReduceMotionEnabled()
  if (reduce) return
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
}
