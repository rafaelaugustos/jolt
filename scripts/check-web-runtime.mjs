import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/web/index.ts'],
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  packages: 'external',
  metafile: true,
  write: false,
})
for (const [name, input] of Object.entries(result.metafile.inputs)) {
  assert(
    name.startsWith('src/core/') || name.startsWith('src/web/'),
    `Web escaped its boundary: ${name}`,
  )
  assert(
    input.imports.every((i) => !i.external),
    `External runtime dependency: ${name}`,
  )
}
// Evaluate both the source bundle and unbundled compiled entry in an actual Node
// process with no browser/NativeScript globals. Public package resolution is #282.
assert.equal(typeof globalThis.window, 'undefined')
assert.equal(typeof globalThis.document, 'undefined')
for (const module of [
  await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`
  ),
  await import('../dist/web/index.js'),
])
  assert.equal(typeof module.createWebRuntime, 'function')
console.log(
  'PASS: internal Web import graph and SSR evaluation; no DOM or NativeScript runtime required on import.',
)
