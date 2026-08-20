import { CenteredSpinner } from '@/components/Screen'
import { markCodeExchanged, wasCodeExchanged } from '@/lib/oauthCallback'
import { supabase } from '@/lib/supabase'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'

/** OAuth / magic-link landing — sole PKCE code exchange (Quithero-style single callback). */
export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>()
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const run = async () => {
      const authCode = code ? String(code) : ''
      if (!authCode) {
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
      if (wasCodeExchanged(authCode)) {
        const { data } = await supabase.auth.getSession()
        if (!alive) return
        if (data.session) {
          setReady(true)
          return
        }
      }
      markCodeExchanged(authCode)
      const { error } = await supabase.auth.exchangeCodeForSession(authCode)
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
