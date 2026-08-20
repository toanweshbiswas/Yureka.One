import { colors } from '@/lib/theme'
import { NativeTabs } from 'expo-router/unstable-native-tabs'

export default function AppTabs() {
  return (
    <NativeTabs tintColor={colors.clay} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="offers">
        <NativeTabs.Trigger.Icon sf="bag.fill" md="shopping_bag" />
        <NativeTabs.Trigger.Label>Offers</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="giftcards">
        <NativeTabs.Trigger.Icon sf="gift.fill" md="card_giftcard" />
        <NativeTabs.Trigger.Label>Gift cards</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more" role="more">
        <NativeTabs.Trigger.Icon sf="ellipsis.circle.fill" md="more_horiz" />
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
