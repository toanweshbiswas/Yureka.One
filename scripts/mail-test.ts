/**
 * Mail configuration smoke test.
 *   pnpm tsx scripts/mail-test.ts              # verify provider connection only
 *   pnpm tsx scripts/mail-test.ts you@you.com  # also send a real test message
 */
import 'dotenv/config'
import { getMailTransport, sendMail } from '../backend/lib/mail/transport.js'

const recipient = process.argv[2]

const mail = getMailTransport()
if (!mail.transporter) {
  console.error(`FAIL  no provider configured: ${mail.skipped}`)
  process.exit(1)
}

console.log(`provider: ${mail.provider}`)
console.log(`from:     ${mail.from}`)

try {
  await mail.transporter.verify()
  console.log('PASS  SMTP connection + credentials accepted')
} catch (e: any) {
  console.error(`FAIL  ${e?.message || e}`)
  process.exit(1)
}

if (recipient) {
  const result = await sendMail({
    to: recipient,
    subject: 'Yureka mail test',
    text: 'Mail delivery is configured correctly.',
    html: '<p>Mail delivery is configured correctly.</p>',
  })
  if (result.sent) {
    console.log(`PASS  test message sent to ${recipient} (${result.messageId})`)
  } else {
    console.error(`FAIL  ${result.error || result.skipped}`)
    process.exit(1)
  }
}
