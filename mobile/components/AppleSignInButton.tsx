import { isAppleSignInAvailable } from '@/lib/appleAuth'
import React, { useEffect, useState } from 'react'

type Props = {
  disabled?: boolean
  onPress: () => void
}

/** Renders Apple button only when native module is linked (paid-team prebuild). */
export function AppleSignInButton({ disabled, onPress }: Props) {
  const [AppleButton, setAppleButton] = useState<React.ComponentType<{
    buttonType: number
    buttonStyle: number
    cornerRadius: number
    style: object
    onPress: () => void
  }> | null>(null)
  const [buttonType, setButtonType] = useState(0)
  const [buttonStyle, setButtonStyle] = useState(0)

  useEffect(() => {
    let alive = true
    void (async () => {
      const ok = await isAppleSignInAvailable()
      if (!alive || !ok) return
      const mod = await import('expo-apple-authentication')
      if (!alive) return
      setAppleButton(() => mod.AppleAuthenticationButton)
      setButtonType(mod.AppleAuthenticationButtonType.SIGN_IN)
      setButtonStyle(mod.AppleAuthenticationButtonStyle.WHITE)
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!AppleButton) return null

  return (
    <AppleButton
      buttonType={buttonType}
      buttonStyle={buttonStyle}
      cornerRadius={14}
      style={{ width: '100%', height: 50, opacity: disabled ? 0.5 : 1 }}
      onPress={onPress}
    />
  )
}
