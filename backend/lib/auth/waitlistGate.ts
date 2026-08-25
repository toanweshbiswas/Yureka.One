/**
 * Waitlist gate (temporarily open).
 *
 * Default: users onboard directly after auth — no pending/approval wall.
 * Re-enable: set WAITLIST_REQUIRED=true in the environment.
 */
export function isWaitlistRequired(): boolean {
  return String(process.env.WAITLIST_REQUIRED || '').toLowerCase() === 'true'
}
