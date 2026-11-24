import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function findManifestTool() {
  const kits = join(
    process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)',
    'Windows Kits/10/bin',
  )
  let manifestTool = process.env.JOLT_MT
  if (!manifestTool && existsSync(kits)) {
    for (const version of readdirSync(kits).sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true }),
    )) {
      for (const arch of [process.arch === 'arm64' ? 'arm64' : 'x64', 'x64']) {
        const candidate = join(kits, version, arch, 'mt.exe')
        if (existsSync(candidate)) {
          manifestTool = candidate
          break
        }
      }
      if (manifestTool) break
    }
  }
  return manifestTool && existsSync(manifestTool) ? manifestTool : undefined
}

/** XAML Islands require a manifest on the executable hosting Node-API. */
export function prepareWindowsHost(destination) {
  if (process.platform !== 'win32')
    throw new Error('Build and run the Windows app on Windows.')
  const executable = resolve(destination)
  const stamp = `${executable}.json`
  const identity = JSON.stringify({
    node: process.version,
    arch: process.arch,
    manifest: 1,
  })
  if (
    existsSync(executable) &&
    existsSync(stamp) &&
    readFileSync(stamp, 'utf8') === identity
  )
    return executable
  const manifestTool = findManifestTool()
  if (!manifestTool)
    throw new Error(
      'Install the Windows 10/11 SDK (Manifest Tool), or set JOLT_MT to mt.exe.',
    )
  mkdirSync(dirname(executable), { recursive: true })
  copyFileSync(process.execPath, executable)
  const manifest = `${executable}.manifest`
  execFileSync(manifestTool, [
    '-nologo',
    `-inputresource:${executable};#1`,
    `-out:${manifest}`,
  ])
  const bytes = readFileSync(manifest)
  let xml = bytes
    .toString(bytes[0] === 255 && bytes[1] === 254 ? 'utf16le' : 'utf8')
    .replace(/^\uFEFF/, '')
  const maximum = '<maxversiontested Id="10.0.18362.0"/>'
  if (/<maxversiontested\b[^>]*\/>/.test(xml))
    xml = xml.replace(/<maxversiontested\b[^>]*\/>/, maximum)
  else if (/<compatibility\b/.test(xml))
    xml = xml.replace(/(<compatibility\b[\s\S]*?)(<\/application>)/, `$1${maximum}$2`)
  else
    xml = xml.replace(
      '</assembly>',
      `<compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1"><application>${maximum}</application></compatibility></assembly>`,
    )
  if (!xml.includes(maximum))
    throw new Error('Cannot add XAML compatibility to the Node manifest.')
  writeFileSync(manifest, xml)
  execFileSync(manifestTool, [
    '-nologo',
    '-manifest',
    manifest,
    `-outputresource:${executable};#1`,
  ])
  writeFileSync(stamp, identity)
  return executable
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(prepareWindowsHost(process.argv[2] ?? '.local/runtime/node.exe'))
