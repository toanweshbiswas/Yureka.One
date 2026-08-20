import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

if (process.env.EXPO_PUBLIC_IOS_PAID_TEAM === '1' || process.env.IOS_PAID_TEAM === '1') {
  process.exit(0)
}

const entitlementsPath = path.join(root, 'ios', 'Yureka', 'Yureka.entitlements')
if (!fs.existsSync(entitlementsPath)) {
  process.exit(0)
}

const empty = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict/>
</plist>
`

fs.writeFileSync(entitlementsPath, empty)
console.log('Stripped Sign in with Apple / Associated Domains entitlements for Personal Team build.')
