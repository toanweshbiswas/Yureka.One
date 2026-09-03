import crypto from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

function secretKey(): Buffer {
  const raw =
    process.env.LEDGER_TOKEN_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'yureka-ledger-dev-only-change-me'
  return crypto.createHash('sha256').update(raw).digest()
}

/** Encrypt a secret for storage (refresh tokens). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGO, secretKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

/** Decrypt a stored secret. */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = String(payload || '').split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted payload')
  const iv = Buffer.from(ivB64, 'base64url')
  const tag = Buffer.from(tagB64, 'base64url')
  const data = Buffer.from(dataB64, 'base64url')
  const decipher = crypto.createDecipheriv(ALGO, secretKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
