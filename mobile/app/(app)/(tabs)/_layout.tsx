import { colors } from '@/lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import { Platform, type ColorValue } from 'react-native'

type TabIconProps = {
  color: ColorValue
  sf: React.ComponentProps<typeof SymbolView>['name']
  ion: React.ComponentProps<typeof Ionicons>['name']
}

function TabIcon({ color, sf, ion }: TabIconProps) {
  if (Platform.OS === 'ios') {
    return <SymbolView name={sf} size={22} tintColor={String(color)} weight="semibold" />
  }
  return <Ionicons name={ion} size={22} color={String(color)} />
}

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.clay,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon color={color} sf="house.fill" ion="home" />,
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          title: 'Offers',
          tabBarIcon: ({ color }) => <TabIcon color={color} sf="bag.fill" ion="bag" />,
        }}
      />
      <Tabs.Screen
        name="giftcards"
        options={{
          title: 'Gift cards',
          tabBarIcon: ({ color }) => <TabIcon color={color} sf="gift.fill" ion="gift" />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <TabIcon color={color} sf="ellipsis.circle.fill" ion="ellipsis-horizontal" />,
        }}
      />
    </Tabs>
  )
}
