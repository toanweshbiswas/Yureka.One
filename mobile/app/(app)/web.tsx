import { AppWebView } from '@/components/AppWebView'
import { Screen } from '@/components/Screen'
import { useLocalSearchParams } from 'expo-router'

export default function WebScreen() {
  const { path } = useLocalSearchParams<{ path?: string }>()
  return (
    <Screen>
      <AppWebView path={path || '/dashboard/home'} />
    </Screen>
  )
}
