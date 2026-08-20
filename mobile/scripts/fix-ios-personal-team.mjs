/**
 * Post-prebuild fixes for Apple Personal Team (free) local development.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.env.EXPO_PUBLIC_IOS_PAID_TEAM === '1' || process.env.IOS_PAID_TEAM === '1') {
  console.log('Paid-team build — skipping personal-team iOS fixes.')
  process.exit(0)
}

const bundleId = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID?.trim() || 'one.yureka.app.dev'
const iosDir = path.join(root, 'ios')
const entitlementsPath = path.join(iosDir, 'Yureka', 'Yureka.entitlements')
const pbxPath = path.join(iosDir, 'Yureka.xcodeproj', 'project.pbxproj')
const podfileLock = path.join(iosDir, 'Podfile.lock')

const emptyEntitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict/>
</plist>
`

if (fs.existsSync(entitlementsPath)) {
  fs.writeFileSync(entitlementsPath, emptyEntitlements)
  console.log('✓ Cleared Yureka.entitlements')
}

if (fs.existsSync(pbxPath)) {
  let pbx = fs.readFileSync(pbxPath, 'utf8')
  pbx = pbx.replace(/\t\t\t\tDEVELOPMENT_TEAM = [A-Z0-9]+;\n/g, '')
  pbx = pbx.replace(/PRODUCT_BUNDLE_IDENTIFIER = one\.yureka\.app;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${bundleId};`)
  fs.writeFileSync(pbxPath, pbx)
  console.log(`✓ Bundle id → ${bundleId}, removed hardcoded DEVELOPMENT_TEAM`)
}

// Force CocoaPods to drop ExpoAppleAuthentication (react-native.config.js platforms: null).
if (fs.existsSync(podfileLock) && fs.readFileSync(podfileLock, 'utf8').includes('ExpoAppleAuthentication')) {
  fs.unlinkSync(podfileLock)
  console.log('✓ Removed Podfile.lock (will reinstall without ExpoAppleAuthentication)')
}

if (fs.existsSync(path.join(iosDir, 'Podfile'))) {
  console.log('→ pod install …')
  execSync('pod install', { cwd: iosDir, stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_IOS_PAID_TEAM: '0' } })
  const lock = fs.existsSync(podfileLock) ? fs.readFileSync(podfileLock, 'utf8') : ''
  if (lock.includes('ExpoAppleAuthentication')) {
    console.warn('⚠ ExpoAppleAuthentication still in Podfile.lock — run: pnpm prebuild:personal-team')
  } else {
    console.log('✓ Pods reinstalled without ExpoAppleAuthentication')
  }
}

console.log('')
console.log('Open ios/Yureka.xcworkspace → select Personal Team → Clean (⇧⌘K) → Run (⌘R)')
