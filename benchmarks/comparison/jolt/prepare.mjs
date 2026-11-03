import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('./', import.meta.url))
// Generated resources stay local to this disposable fixture, never the user's demo.
if (!existsSync(root + 'App_Resources'))
  cpSync(
    root + 'node_modules/@nativescript/template-blank/App_Resources',
    root + 'App_Resources',
    { recursive: true },
  )
const plist = root + 'App_Resources/iOS/Info.plist'
let xml = readFileSync(plist, 'utf8')
if (!xml.includes('CADisableMinimumFrameDurationOnPhone'))
  xml = xml.replace(
    '<dict>',
    '<dict>\n<key>CADisableMinimumFrameDurationOnPhone</key><true/>',
  )
writeFileSync(plist, xml)
