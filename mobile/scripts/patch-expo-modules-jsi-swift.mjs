/**
 * Xcode 26.2+ / Swift 6.2: C++ interop makes `abs(Double)` ambiguous in expo-modules-jsi.
 * Upstream: https://github.com/expo/expo/issues/48522
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const rel = 'expo-modules-jsi/apple/Sources/ExpoModulesJSI/Coding/JavaScriptCodable+Date.swift'

function findSwiftFile(dir, depth = 0) {
  if (depth > 8) return null
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.pnpm') {
        const hit = findSwiftFile(full, depth + 1)
        if (hit) return hit
      } else if (full.endsWith(rel)) {
        return full
      } else {
        const hit = findSwiftFile(full, depth + 1)
        if (hit) return hit
      }
    }
  }
  return null
}

// pnpm: node_modules/.pnpm/expo-modules-jsi@.../node_modules/expo-modules-jsi/...
const pnpmRoot = path.join(root, '..', 'node_modules', '.pnpm')
let target = null

if (fs.existsSync(pnpmRoot)) {
  for (const name of fs.readdirSync(pnpmRoot)) {
    if (!name.startsWith('expo-modules-jsi@')) continue
    const candidate = path.join(pnpmRoot, name, 'node_modules', 'expo-modules-jsi', rel.slice('expo-modules-jsi/'.length))
    if (fs.existsSync(candidate)) {
      target = candidate
      break
    }
  }
}

if (!target) {
  target = findSwiftFile(path.join(root, '..'))
}

if (!target) {
  console.warn('[patch-expo-modules-jsi] JavaScriptCodable+Date.swift not found — skip')
  process.exit(0)
}

let src = fs.readFileSync(target, 'utf8')
const needle = 'guard milliseconds.isFinite, abs(milliseconds) <= maxJavaScriptDateMilliseconds else {'
const fixed = 'guard milliseconds.isFinite, Swift.abs(milliseconds) <= maxJavaScriptDateMilliseconds else {'

if (src.includes(fixed)) {
  console.log('[patch-expo-modules-jsi] already patched')
  process.exit(0)
}

if (!src.includes(needle)) {
  console.warn('[patch-expo-modules-jsi] unexpected file contents — skip')
  process.exit(0)
}

src = src.replace(needle, fixed)
fs.writeFileSync(target, src)
console.log(`[patch-expo-modules-jsi] patched ${target}`)
