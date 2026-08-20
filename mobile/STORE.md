# App Store / Play listing

Do not submit until TestFlight / Play internal builds are verified.

## Support & legal

- Support email: `support@yureka.one`
- Support URL: https://yureka.one/contact
- Terms: https://yureka.one/terms-of-service
- Privacy: https://yureka.one/privacy-policy
- Marketing site: https://yureka.one

## Privacy nutrition (App Store)

- Email (account)
- Purchase history (gift cards)
- Optional Gmail (expenses) — not used until native Gmail consent ships; do not claim it in v1

## Bundle

- iOS / Android: `one.yureka.app`
- Scheme: `yureka`
- **Required** Supabase Auth redirect URL: `yureka://auth/callback`
- Also keep existing `https://app.yureka.one/login` for web only

Google Sign-In: add `yureka://auth/callback` to the Google Cloud OAuth client **and** Supabase → Authentication → URL configuration → Redirect URLs.

## Run the native app (not Safari)

1. Build/run **Yureka** from Xcode (`mobile/ios/Yureka.xcworkspace`) or `pnpm ios`
2. Start Metro: `cd mobile && pnpm start`
3. Open the **Yureka** icon on the simulator home screen — do **not** browse to `app.yureka.one` in Safari

Native home shows **Goldback** (`Hi {name}`, live balance). If you see "Good evening" and a Safari URL bar, you're on the website, not the app.

## Commands

```bash
cd Yureka.One/mobile
npx eas-cli login
npx eas-cli init          # paste project id into app.json extra.eas.projectId
npx eas-cli build --profile preview --platform ios
npx eas-cli build --profile preview --platform android
npx eas-cli submit --profile production --platform ios
npx eas-cli submit --profile production --platform android
```

Set EAS secrets (do not commit): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

App Store listing copy lives in `store.config.json` (privacy, support, terms URLs). Push with `npx eas-cli metadata:push` after the first binary exists.

Apple Sign-In: enable the capability in Apple Developer + Expo plugin (already in app.json).
Set `APPLE_TEAM_ID` on the Express host so `/.well-known/apple-app-site-association` matches.
Google Sign-In: add `yureka://auth/callback` to the Google Cloud OAuth client and Supabase redirect URLs.
Android App Links: set `ANDROID_SHA256_FINGERPRINTS` (Play app-signing cert) for `/.well-known/assetlinks.json`.
