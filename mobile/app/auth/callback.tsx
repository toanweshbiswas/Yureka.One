import { CenteredSpinner } from '@/components/Screen'
import { supabase } from '@/lib/supabase'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'

/** OAuth / magic-link landing — exchange PKCE code before routing home. */
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>()
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (!code) {
        if (alive) setReady(true)
        return
      }
      if (!supabase) {
        if (alive) {
          setFailed(true)
          setReady(true)
        }
        return
      }
      const { error } = await supabase.auth.exchangeCodeForSession(String(code))
      if (!alive) return
      if (error) setFailed(true)
      setReady(true)
    }
    void run()
    return () => {
      alive = false
    }
  }, [code])

  if (!ready) return <CenteredSpinner />
  if (failed) return <Redirect href="/(auth)/login" />
  return <Redirect href="/" />
}
