import type { ExpoConfig, ConfigContext } from 'expo/config'

import appJson from './app.json'

type YurekaExpoConfig = ExpoConfig & {
  autolinking?: { exclude?: string[] }
}

const PRODUCTION_BUNDLE_ID = 'one.yureka.app'
/** Personal Team cannot register the production bundle — use a unique dev ID locally. */
const PERSONAL_TEAM_BUNDLE_ID =
  process.env.EXPO_PUBLIC_IOS_BUNDLE_ID?.trim() || 'one.yureka.app.dev'

const base = appJson.expo as YurekaExpoConfig

/** Paid Apple Developer Program — enables Sign in with Apple + Universal Links. */
function isPaidTeamBuild() {
  return process.env.EXPO_PUBLIC_IOS_PAID_TEAM === '1' || process.env.IOS_PAID_TEAM === '1'
}

function withPaidIosCapabilities(config: YurekaExpoConfig): YurekaExpoConfig {
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
      bundleIdentifier: PRODUCTION_BUNDLE_ID,
      usesAppleSignIn: true,
      associatedDomains: ['applinks:app.yureka.one'],
    },
    plugins,
  }
}

function withPersonalTeamAutolinking(config: YurekaExpoConfig): YurekaExpoConfig {
  const existing = (config.autolinking as { exclude?: string[] } | undefined)?.exclude ?? []
  const exclude = existing.includes('expo-apple-authentication')
    ? existing
    : [...existing, 'expo-apple-authentication']

  return {
    ...config,
    autolinking: { ...(config.autolinking as object), exclude },
    ios: {
      ...(config.ios ?? {}),
      bundleIdentifier: PERSONAL_TEAM_BUNDLE_ID,
    },
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const merged: YurekaExpoConfig = { ...base, ...config }
  return isPaidTeamBuild() ? withPaidIosCapabilities(merged) : withPersonalTeamAutolinking(merged)
}
