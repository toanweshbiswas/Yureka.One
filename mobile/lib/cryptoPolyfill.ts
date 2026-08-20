/**
 * Hermes has no WebCrypto.subtle — Supabase PKCE needs SHA-256 for OAuth.
 * Must run before @supabase/supabase-js is imported.
 */
import * as ExpoCrypto from 'expo-crypto'
import { polyfillWebCrypto } from 'expo-standard-web-crypto'

const g = globalThis as typeof globalThis & { crypto?: Crypto }

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes.buffer
}

function toExpoDigest(algo: string): ExpoCrypto.CryptoDigestAlgorithm {
  switch (algo) {
    case 'SHA-256':
      return ExpoCrypto.CryptoDigestAlgorithm.SHA256
    case 'SHA-384':
      return ExpoCrypto.CryptoDigestAlgorithm.SHA384
    case 'SHA-512':
      return ExpoCrypto.CryptoDigestAlgorithm.SHA512
    default:
      throw new Error(`Unsupported digest algorithm: ${algo}`)
  }
}

function bufferSourceToString(data: BufferSource): string {
  const bytes =
    data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  return String.fromCharCode(...bytes)
}

export function installCryptoPolyfill() {
  polyfillWebCrypto()

  if (g.crypto?.subtle && typeof g.crypto.subtle.digest === 'function') return

  const digest = async (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> => {
    const name = typeof algorithm === 'string' ? algorithm : algorithm.name
    const hex = await ExpoCrypto.digestStringAsync(toExpoDigest(name), bufferSourceToString(data), {
      encoding: ExpoCrypto.CryptoEncoding.HEX,
    })
    return hexToArrayBuffer(hex)
  }

  g.crypto = {
    ...(g.crypto ?? ({} as Crypto)),
    subtle: { digest } as SubtleCrypto,
  }
}

installCryptoPolyfill()
