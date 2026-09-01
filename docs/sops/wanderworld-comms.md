# WanderWorld communication matrix

All buyer and ops touchpoints should flow through Yureka (`user_notifications` + branded email).

## Events

| Event | Trigger | In-app | Email | Primary `href` |
|-------|---------|--------|-------|----------------|
| `booking_created` | Checkout registration created | Yes | Yes | `/dashboard/getaway/bookings` |
| `payment_received` | Razorpay verify / webhook / cash | Yes | Yes | `/dashboard/getaway/bookings` |
| `installment_due` | Daily cron (3 days before due) | Yes | Yes | `/dashboard/getaway/bookings` |
| `installment_overdue` | Daily cron (past due) | Yes | Yes | `/dashboard/getaway/bookings` |
| `group_invite` | Promoter group booking / resend | Yes | Yes | `/dashboard/getaway/group/:code` |
| `registration_cancelled` | Admin/promoter cancel | Yes | Yes | `/dashboard/getaway` |
| `trip_announcement` | WW portal **Announce** / admin WW broadcast | Yes | Yes (optional) | `/dashboard/getaway/:slug` |
| `trip_updated` | Trip patch with `notifyRegistrants` | Yes | Yes | `/dashboard/getaway/:slug` |
| `promoter_attribution` | Payment on referred booking | Yes (WW portal) | Yes | WW portal |
| `cash_recorded` | Promoter/admin cash collection | Yes (WW portal) | Yes | WW portal |
| `chat_message` | New message in trip group chat | Yes | No | Travelers: `/dashboard/getaway/chat/:slug` · Staff: `/?chat=:slug` |

## Trip chat

- One thread per trip; travelers with active bookings + WW staff (owner/admin/promoter).
- API: `GET/POST /api/wanderworld/chat/trips/:tripId/messages`, `GET /api/wanderworld/chat/threads`
- Store: `data/wanderworld_chat.json` (+ optional Supabase mirror via migration `023`)
- UI: `WwTripChat` on Getaway (`/dashboard/getaway/chat`) and WwPortal (Chat tab)

- Orchestrator: `backend/lib/wanderworld/communicate.ts`
- Email templates: `backend/lib/mail/appEmails.ts` (`sendWw*`)
- Route hooks: `backend/lib/wanderworld/routes.ts`
- Reminders cron: `backend/lib/wanderworld/reminders.ts` (daily via `server.ts`)
- Webhook idempotency: `wanderworld_webhook_events` table + `webhookEvents.ts`

## UI surfaces

- Travelers: `NotificationBell` on `GetawayPage` (app dashboard)
- Ops/promoters: `NotificationBell` on `WwPortal` header
- Public discovery: `/getaway` landing → login → `/dashboard/getaway`

## Trip announcements (email + inbox)

**WanderWorld portal (preferred):** Trips → **Announce** on a trip card.

`POST /api/wanderworld/admin/trips/:id/announce`

```json
{
  "title": "Meetup time changed",
  "body": "We meet at 7am at the lobby.",
  "audience": "booked",
  "sendInbox": true,
  "sendEmail": true
}
```

Audiences:
- `booked` — all non-cancelled registrants + group seat claimants
- `unpaid` — booked with balance due
- `promoters` — promoters/admins with access to the trip
- `related` — booked + promoters

**Yureka admin Push tab:** audience `wanderworld_registrants` / `wanderworld_unpaid` / `wanderworld_promoters`, optional `tripId`, checkbox **Also send branded email**.

## Admin broadcast audiences

`POST /api/admin/notifications/broadcast` with `mode: "broadcast"`, `confirmBroadcast: true`:

- `audience: "wanderworld_registrants"` + optional `tripId`
- `audience: "wanderworld_promoters"`
- `audience: "wanderworld_unpaid"`
- `sendEmail: true` — also fan out branded email for WW audiences

## Storage

- `WANDERWORLD_STORE=file|dual|supabase` (default `dual`)
- File: `data/wanderworld_store.json`
- Supabase schema: migrations `017` + `021` + `022` + `023`
- Backfill: `pnpm data:backfill` → `migrateWanderworld()`

## Resend group invite

`POST /api/wanderworld/promoter/group-booking/:registrationId/notify`
