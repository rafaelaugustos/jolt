import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scratch = mkdtempSync(join(tmpdir(), 'jolt-core-consumer-'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (command, args, cwd) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' })

try {
  // Check every reachable runtime module, including tree-shaken imports.
  const bundle = await build({
    absWorkingDir: root,
    entryPoints: ['src/core/index.ts'],
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    packages: 'external',
    metafile: true,
    write: false,
  })
  for (const [name, input] of Object.entries(bundle.metafile.inputs)) {
    assert(name.startsWith('src/core/'), `Core escaped its boundary: ${name}`)
    for (const dependency of input.imports)
      assert(!dependency.external, `Core imports an external module: ${dependency.path}`)
  }
  for (const output of Object.values(bundle.metafile.outputs))
    assert.deepEqual(output.imports, [], 'Core has an external runtime dependency')

  // Package only the compiled internal boundary, without the repository's aliases,
  // NativeScript mocks, ambient types or installed dependencies. This does not
  // claim that the published native package is already a web-only installation.
  const source = join(scratch, 'package')
  cpSync(join(root, 'dist/core'), source, { recursive: true })
  writeFileSync(
    join(source, 'package.json'),
    JSON.stringify({
      name: '@jolt-internal/core-boundary-probe',
      version: '0.0.0',
      private: true,
      type: 'module',
      exports: { '.': { types: './index.d.ts', default: './index.js' } },
    }),
  )
  const packed = JSON.parse(
    run(npm, ['pack', '--json', '--ignore-scripts', '--offline'], source),
  )[0]
  const consumer = join(scratch, 'consumer')
  cpSync(join(root, 'test/fixtures/portable-consumer'), consumer, { recursive: true })
  run(
    npm,
    [
      'install',
      join(source, packed.filename),
      '--ignore-scripts',
      '--offline',
      '--no-audit',
      '--no-fund',
    ],
    consumer,
  )
  const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json'), 'utf8'))
  assert.deepEqual(Object.keys(lock.packages).sort(), [
    '',
    'node_modules/@jolt-internal/core-boundary-probe',
  ])
  run(
    process.execPath,
    [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'],
    consumer,
  )
  const output = run(process.execPath, ['probe.mjs'], consumer)
  assert.match(output, /PASS/)
  console.log(
    'PASS: portable runtime graph, dependency-free install, ES-only declarations and SSR compilation/control probes.',
  )
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
