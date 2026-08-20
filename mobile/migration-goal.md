Goal: migrate Yureka.One (consumer dashboard at app.yureka.one) from web to a native Expo app by following the expo-web-to-native skill, one screen per iteration, until done.

Each iteration, FIRST re-read the playbook, then:
1. If migration-progress.md doesn't exist yet, do the skill's step 1 (Assess) to
   create the worklist, then stop. Otherwise open it and take the top unchecked
   item under "nativize-now"; if none are left unresolved (every nativize-now is
   done or blocked), STOP and summarize what shipped + what's blocked and why.
2. Redesign that screen native per the skill's step 4 — reach for @expo/ui FIRST
   (real SwiftUI/Compose), then expo-router (NativeTabs, large titles);
   RN primitives only for custom layouts. NEVER a webview port.
   Use references/native-patterns.md (UX patterns) and references/false-friends.md
   (idioms). Match the web screen's content and behavior.
3. Verify per references/verify-on-device.md: compare the running web original
   against the native screen — content and behavior parity, NOT pixels.
4. Check the item off in migration-progress.md.

Rules: one screen per pass; the app builds green each iteration; @expo/ui before RN primitives; never touch "nativize-later" items.
Base API URL for native (no relative paths): EXPO_PUBLIC_API_URL (https://app.yureka.one)
Support: support@yureka.one
Terms: https://yureka.one/terms-of-service
Privacy: https://yureka.one/privacy-policy
