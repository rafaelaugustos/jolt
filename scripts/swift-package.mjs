import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { source: { type: 'string' } },
})
if (positionals.length !== 1) {
  console.error('Usage: node scripts/swift-package.mjs OUT [--source JOLT_CHECKOUT]')
  process.exit(1)
}

const source = resolve(values.source ?? resolve(import.meta.dirname, '..'))
const out = resolve(positionals[0])
const repository = 'https://github.com/rafaelaugustos/jolt-swift'
const prefix = 'packages/swiftui/'

if (source.startsWith(out) || existsSync(resolve(out, 'packages')))
  throw new Error(`${out} is not a Swift package distribution directory.`)

const manifest = await readFile(resolve(source, 'Package.swift'), 'utf8')
const targets = manifest.match(/\.(target|testTarget)\(/g)?.length ?? 0
const paths = manifest.match(/path: "packages\/swiftui\//g)?.length ?? 0
const distributed = manifest.replaceAll(`path: "${prefix}`, 'path: "')
if (!targets || paths !== targets || distributed.includes('packages/'))
  throw new Error(`Every target in Package.swift must have a path under ${prefix}.`)

const { version } = JSON.parse(await readFile(resolve(source, 'package.json'), 'utf8'))
const git = (...args) =>
  execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' })
const commit = git('rev-parse', 'HEAD').trim()
const files = git('ls-files', '-z', '--', `${prefix}Sources`, `${prefix}Tests`)
  .split('\0')
  .filter(Boolean)

await mkdir(out, { recursive: true })
for (const entry of await readdir(out))
  if (entry !== '.git') await rm(resolve(out, entry), { recursive: true, force: true })

const copies = files.map((path) => [path, path.slice(prefix.length)])
copies.push(['LICENSE', 'LICENSE'])
let bytes = 0
for (const [from, to] of copies) {
  const target = resolve(out, to)
  await mkdir(dirname(target), { recursive: true })
  await copyFile(resolve(source, from), target)
  bytes += (await stat(target)).size
}

const readme = `# JoltSwiftUI

[Jolt](https://github.com/rafaelaugustos/jolt) motion for SwiftUI on iOS 17+ and macOS 14+, without NativeScript or JavaScript.

\`\`\`swift
.package(url: "${repository}.git", exact: "${version}")
.product(name: "JoltSwiftUI", package: "jolt-swift")
\`\`\`

See the [SwiftUI guide](https://jolt.rafaelaugusto.dev/guide/swiftui).

This repository is generated from \`packages/swiftui\` in [rafaelaugustos/jolt](https://github.com/rafaelaugustos/jolt) at each release tag. Open issues and pull requests there. ${version} was generated from rafaelaugustos/jolt@${commit}.
`
await writeFile(resolve(out, 'Package.swift'), distributed)
await writeFile(resolve(out, 'README.md'), readme)
await writeFile(resolve(out, '.gitignore'), '/.build/\n/.swiftpm/\n')

console.log(
  `JoltSwiftUI ${version}: ${files.length} package files, ${(bytes / 1024).toFixed(0)} KiB, in ${out}`,
)
