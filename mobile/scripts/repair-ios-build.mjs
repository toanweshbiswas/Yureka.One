#!/usr/bin/env node
/**
 * Fix "No such module 'Expo'" / missing RNScreens.modulemap — stale Pods or wrong Xcode project.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ios = path.join(root, 'ios')

console.log('→ Patch expo-modules-jsi for Xcode 26 / Swift 6.2 …')
execSync('node scripts/patch-expo-modules-jsi-swift.mjs', { cwd: root, stdio: 'inherit' })

console.log('→ Clearing DerivedData + ios/build …')
try {
  execSync('rm -rf ios/build ~/Library/Developer/Xcode/DerivedData/Yureka-*', {
    cwd: root,
    stdio: 'inherit',
  })
} catch {
  /* ignore */
}

if (fs.existsSync(path.join(ios, 'Podfile'))) {
  console.log('→ pod install (this builds pod configs Expo/RNScreens need) …')
  execSync('pod install', { cwd: ios, stdio: 'inherit' })
}

console.log('→ Personal-team signing fixes …')
execSync('node scripts/fix-ios-personal-team.mjs', { cwd: root, stdio: 'inherit' })

console.log('')
console.log('Done. IMPORTANT:')
console.log('  • Open  mobile/ios/Yureka.xcworkspace   (NEVER Yureka.xcodeproj)')
console.log('  • Scheme: Yureka  |  Destination: iPhone simulator first')
console.log('  • Terminal: pnpm start  (Metro must be running)')
console.log('  • Xcode: Product → Clean Build Folder (⇧⌘K) → Run (⌘R)')
