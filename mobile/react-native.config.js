/**
 * Personal Team builds must not link expo-apple-authentication natively
 * (Sign in with Apple requires paid program + breaks module maps on free accounts).
 * JS still lazy-imports the module when available (paid-team / EAS builds).
 */
const paidTeam =
  process.env.EXPO_PUBLIC_IOS_PAID_TEAM === '1' || process.env.IOS_PAID_TEAM === '1'

module.exports = {
  dependencies: paidTeam
    ? {}
    : {
        'expo-apple-authentication': {
          platforms: {
            ios: null,
            android: null,
          },
        },
      },
}
