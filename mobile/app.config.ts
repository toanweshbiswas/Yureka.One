import type { ExpoConfig, ConfigContext } from 'expo/config'

import appJson from './app.json'

const base = appJson.expo as ExpoConfig

/** Paid Apple Developer Program — enables Sign in with Apple + Universal Links. */
function isPaidTeamBuild() {
  return process.env.EXPO_PUBLIC_IOS_PAID_TEAM === '1' || process.env.IOS_PAID_TEAM === '1'
}

function withPaidIosCapabilities(config: ExpoConfig): ExpoConfig {
  const plugins = [...(config.plugins ?? [])]
  if (!plugins.includes('expo-apple-authentication')) {
    plugins.splice(2, 0, 'expo-apple-authentication')
  }

  return {
    ...config,
    autolinking: {
      ...(config.autolinking as object),
      exclude: ((config.autolinking as { exclude?: string[] })?.exclude ?? []).filter(
        (name) => name !== 'expo-apple-authentication',
      ),
    },
    ios: {
      ...(config.ios ?? {}),
      usesAppleSignIn: true,
      associatedDomains: ['applinks:app.yureka.one'],
    },
    plugins,
  }
}

function withPersonalTeamAutolinking(config: ExpoConfig): ExpoConfig {
  const existing = (config.autolinking as { exclude?: string[] } | undefined)?.exclude ?? []
  const exclude = existing.includes('expo-apple-authentication')
    ? existing
    : [...existing, 'expo-apple-authentication']

  return {
    ...config,
    autolinking: { ...(config.autolinking as object), exclude },
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const merged = { ...base, ...config }
  return isPaidTeamBuild() ? withPaidIosCapabilities(merged) : withPersonalTeamAutolinking(merged)
}
