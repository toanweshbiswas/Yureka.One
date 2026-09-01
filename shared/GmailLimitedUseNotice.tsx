import React from 'react'
import { landingUrl } from '@shared/hosts'

/** In-app copy that must appear before any gmail.readonly OAuth request (Google Limited Use). */
export const GMAIL_LIMITED_USE_SUMMARY =
  'Yureka asks for read-only Gmail access only to find purchase, bill, and payment emails for your spend ledger and due dates. We do not read personal emails or other personal inbox content in the app. Nobody at Yureka opens your mail. The product never shows raw messages—only merchant, amount, and date from financial emails. We do not send or change mail, sell inbox data, use it for ads, or share it with lenders.'

export function GmailLimitedUseNotice({ className }: { className?: string }) {
  return (
    <p className={className || 'mt-2 max-w-xl text-[12px] leading-relaxed text-white/40'}>
      {GMAIL_LIMITED_USE_SUMMARY}{' '}
      <a
        href={landingUrl('/privacy-policy')}
        className="text-clay/90 underline underline-offset-2 hover:text-clay"
        target="_blank"
        rel="noopener noreferrer"
      >
        Privacy Policy
      </a>
      {' · '}
      <a
        href={landingUrl('/terms-of-service')}
        className="text-clay/90 underline underline-offset-2 hover:text-clay"
        target="_blank"
        rel="noopener noreferrer"
      >
        Terms
      </a>
      . Revoke anytime in Google Account → Third-party access, or email support@yureka.one to delete derived spend data.
    </p>
  )
}

export function GoogleSignInScopeNote({
  className,
  variant = 'app',
}: {
  className?: string
  variant?: 'app' | 'ops'
}) {
  return (
    <p className={className || 'mt-3 text-[11px] leading-relaxed text-white/35'}>
      {variant === 'ops'
        ? 'Google sign-in uses only your name and email. This portal never requests Gmail inbox access.'
        : 'Google sign-in uses only your name and email. Inbox access is never requested at login. You can connect Gmail later, only if you want Expenses, Bills, or an optional score.'}
    </p>
  )
}
