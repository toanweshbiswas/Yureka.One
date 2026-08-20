# Yureka mobile (iOS + Android)

Expo app for Yureka members. Day-one shell wraps `https://app.yureka.one`; Home, Offers, and Gift cards are native.

Bundle ID: `one.yureka.app`. Scheme: `yureka`.

```bash
cp .env.example .env.local
# fill EXPO_PUBLIC_SUPABASE_* from the web app (anon key only)
pnpm install
pnpm prebuild        # generates ios/ and android/ (first time or after native config changes)
pnpm pods            # CocoaPods for Xcode (macOS only)
pnpm start           # Metro bundler
```

**EAS / TestFlight:** set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS secrets (they are not in `eas.json`). For App Store builds, prebuild with `EXPO_PUBLIC_IOS_PAID_TEAM=1` so Sign in with Apple and Universal Links work.

### Personal Team (free Apple ID) — local device/simulator

Production bundle `one.yureka.app` is registered to the org account. On a Personal Team use the dev bundle instead:

```bash
pnpm prebuild:personal-team   # bundle one.yureka.app.dev, no Apple Sign-In entitlements
pnpm pods
pnpm start                    # Metro — keep running
pnpm open:ios                 # opens Yureka.xcworkspace
```

In Xcode → **Signing & Capabilities** → select **your** Personal Team. Do **not** add “Sign in with Apple” manually.

**Module map / `No such module 'Expo'` errors:** almost always means Xcode opened **`Yureka.xcodeproj`** instead of **`Yureka.xcworkspace`**, or Pods are stale. Run:

```bash
pnpm repair:ios    # clean DerivedData + pod install + signing fixes
pnpm start         # Metro — keep running
pnpm open:ios      # opens the .xcworkspace
```

Then Product → Clean Build Folder (⇧⌘K) → Run (⌘R). Build for **simulator** first; switch to a physical device after simulator succeeds.

**Xcode 26 + Swift 6.2 `JavaScriptCodable+Date.swift` error:** run `pnpm patch:ios` (applies upstream `Swift.abs` fix to `expo-modules-jsi`).

## Open in Xcode or Android Studio

This is an **Expo / React Native** app (not Flutter). Native projects live in `ios/` and `android/` after `pnpm prebuild`.

> **Important (iOS):** Open **`mobile/ios/Yureka.xcworkspace`**, not `Yureka.xcodeproj`.  
> Opening `.xcodeproj` causes `module map file ... not found` build errors.

| Platform | Open in IDE | Run |
|---|---|---|
| **iOS** | `pnpm open:ios` → opens `Yureka.xcworkspace` | Select a simulator → Run (⌘R). Start Metro first: `pnpm start` |
| **Android** | `pnpm open:android` or open `mobile/android/` in Android Studio | Sync Gradle → Run. Start Metro first: `pnpm start` |

If Xcode still shows stale errors after opening the workspace:

```bash
pnpm clean:ios   # clears DerivedData for Yureka
pnpm pods        # reinstall CocoaPods
pnpm open:ios
```

Then in Xcode: Product → Clean Build Folder (⇧⌘K) → Run (⌘R).

CLI alternative (builds + launches simulator):

```bash
pnpm ios       # expo run:ios
pnpm android   # expo run:android
```

Re-run `pnpm prebuild:clean` if you change `app.json` plugins, bundle ID, or icons.

Store listing, privacy, and EAS commands: `STORE.md`.
Migration worklist: `migration-progress.md`.
