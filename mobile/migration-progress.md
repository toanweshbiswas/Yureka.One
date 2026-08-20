# Yureka consumer app — web → native worklist

Source: `app.yureka.one` product (not landing, admin, or brand portal).
Native app: `Yureka.One/mobile`. Backend stays Express; the phone is an HTTP client.

## nativize-now

- [x] Login / signup / reset — `app/LoginPage.tsx`, `app/ResetPasswordPage.tsx` — done (native auth screens)
- [x] Waitlist / waiting — `app/WaitlistPage.tsx`, `app/WaitingPage.tsx` — done (waiting gate after sign-in)
- [x] Home (Goldback) — `app/Dashboard/GoldbackHome.tsx` — done
- [x] Offers — `app/Dashboard/OffersPage.tsx` — done
- [x] Gift cards + order — `app/Dashboard/GiftCardsPage.tsx`, `GiftCardOrderPage.tsx` — done

## nativize-later

- [ ] Expenses — `app/Dashboard/Expenses.tsx` — blocked: Gmail GIS has no native equivalent; stays WebView until Google native consent
- [ ] Planning — `app/Dashboard/ExpensePlanning.tsx` — blocked: same Gmail consent
- [ ] Bills — `app/Dashboard/Bills.tsx` — stays WebView
- [ ] Referrals — `app/Dashboard/ReferralDashboard.tsx` — stays WebView under More
- [ ] Profile — `app/Dashboard/AccountSettings.tsx` — stays WebView under More

## omit / never

- Extension — desktop Chrome only; More tab shows a desktop note
- Super Browse / in-app embed — paused on web
- Admin (`/admin`) — never in consumer app
- Brand portal (`/brand`) — never in consumer app
- Marketing landing / SEO pages — stay on `yureka.one`

## Shell

- [x] Expo Router NativeTabs (Home, Offers, Gift cards, More)
- [x] Day-one WebView of `https://app.yureka.one` (More tab + fallback)
- [x] Absolute API client + SecureStore session

## Verify (expo-web-to-native)

Web original captured with `agent-browser` against `https://app.yureka.one/login`:

- Brand mark, **Welcome back**, email, password, Sign in, Continue with Gmail, Create account / forgot, Join the waitlist
- Offers/home redirect to login when signed out (same gate as native)

Native device check is **blocked here**: Xcode is installed but `simctl` / `argent run list-devices` report **no iOS runtime or simulator**. After installing an iPhone simulator, run Expo Go (`npx expo start --ios`) and compare with `argent run describe`.

Nativized screens are redesigned (NativeTabs, large titles, FlashList, BottomSheet), not a 1:1 web reskin.
