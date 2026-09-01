/**
 * Register this API as Google's Cross-Account Protection (RISC) receiver.
 *
 *   pnpm tsx backend/scripts/risc-register.ts
 *   pnpm tsx backend/scripts/risc-register.ts --verify
 *
 * Requires GOOGLE_RISC_SA_JSON (service account JSON or file path) and
 * GOOGLE_CLIENT_ID. Optional RISC_RECEIVER_URL.
 */
import 'dotenv/config'
import { registerRiscStream, riscReceiverUrl, verifyRiscStream } from '../lib/auth/riscRegister.js'

const verify = process.argv.includes('--verify')

try {
  const { url } = await registerRiscStream()
  console.log(`PASS  RISC stream registered → ${url}`)
  if (verify) {
    const state = `yureka-risc-${Date.now()}`
    await verifyRiscStream(state)
    console.log(`PASS  verification token requested (state=${state}). Check API logs for [risc] verification event.`)
  } else {
    console.log(`Receiver default: ${riscReceiverUrl()}`)
    console.log('Re-run with --verify after deploy to send a test SET.')
  }
} catch (e: any) {
  console.error(`FAIL  ${e?.message || e}`)
  process.exit(1)
}
