/**
 * Waitlist gate (temporarily open).
 *
 * Default: users go to dashboard after login — join-waitlist / waiting are bypassed.
 * Re-enable: set VITE_WAITLIST_REQUIRED=true (and WAITLIST_REQUIRED=true on the API).
 */
export const WAITLIST_REQUIRED =
  String(import.meta.env.VITE_WAITLIST_REQUIRED || '').toLowerCase() === 'true'
