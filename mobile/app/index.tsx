import { CenteredSpinner } from '@/components/Screen'
import { useAuth } from '@/lib/auth'
import { Redirect } from 'expo-router'

export default function Index() {
  const { ready, session, canEnterApp, status } = useAuth()
  if (!ready || status === 'loading') return <CenteredSpinner />
  if (!session) return <Redirect href="/(auth)/login" />
  if (!canEnterApp) return <Redirect href="/(auth)/waiting" />
  return <Redirect href="/(app)/(tabs)/index" />
}
