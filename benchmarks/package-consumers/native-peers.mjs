import assert from 'node:assert/strict'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { build } from 'esbuild'

/** Real packed consumers: no peer overrides, legacy resolution or Jolt aliases. */
export async function checkNativePeers({ root, scratch, artifact, run, passed, report }) {
  const fixtures = join(root, 'test/fixtures/package-consumers/native-peers')
  const tooling = join(root, 'benchmarks/native-app')
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'))).packages
  const nativeTools = JSON.parse(
    readFileSync(join(tooling, 'package.json')),
  ).devDependencies
  report.nativeImperativePeers = []
  for (const name of ['solid2', 'svelte4']) {
    const consumer = join(scratch, `native-${name}`)
    cpSync(join(fixtures, name), consumer, { recursive: true })
    cpSync(join(fixtures, 'imperative'), consumer, { recursive: true })
    const manifestPath = join(consumer, 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath))
    manifest.dependencies['@rafaelaugusto/jolt'] = `file:${artifact}`
    manifest.devDependencies = Object.fromEntries([
      ...['@nativescript/types-ios', '@nativescript/types-android'].map((peer) => [
        peer,
        lock[`node_modules/${peer}`].version,
      ]),
      ...['@nativescript/ios', '@nativescript/android'].map((peer) => [
        peer,
        nativeTools[peer],
      ]),
      ...['@nativescript/webpack', 'webpack', 'typescript'].map((peer) => [
        peer,
        nativeTools[peer],
      ]),
    ])
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
    // Exercise the exact resolver mode reported in #517, then consume its lock.
    run(
      'npm',
      [
        'install',
        '--package-lock-only',
        '--ignore-scripts',
        '--include=dev',
        '--no-audit',
        '--no-fund',
      ],
      consumer,
    )
    // Vite's preceding production checks can set NODE_ENV. Tooling/types still
    // belong in this build fixture even when the application bundle is production.
    run(
      'npm',
      ['ci', '--ignore-scripts', '--include=dev', '--no-audit', '--no-fund'],
      consumer,
    )
    run('npm', ['ls', '--all', '--omit=dev', '--json'], consumer)
    const resolved = JSON.parse(
      readFileSync(join(consumer, 'package-lock.json')),
    ).packages
    assert(!resolved[''].overrides)
    const tsc = join(root, 'node_modules/typescript/bin/tsc')
    run(process.execPath, [tsc, '-p', 'tsconfig.json'], consumer)
    const types = run(
      process.execPath,
      [tsc, '-p', 'tsconfig.json', '--listFilesOnly'],
      consumer,
    )
    assert(!/\/jolt\/dist\/(solid|svelte|web)\//.test(types))
    assert(!/\/node_modules\/(solid-js|svelte)\//.test(types))
    const result = {
      name,
      versions: {},
      bundles: [],
      bindingSupport:
        name === 'solid2'
          ? 'imperative only; Solid 1 bindings rejected'
          : 'native Svelte action contract; Web remains separately validated on Svelte 5',
    }
    for (const peer of Object.keys(manifest.dependencies).filter(
      (peer) => peer !== '@rafaelaugusto/jolt',
    ))
      result.versions[peer] = resolved[`node_modules/${peer}`].version
    for (const platform of ['ios', 'android']) {
      run(
        process.execPath,
        [
          join(root, 'benchmarks/package-consumers/native-build.cjs'),
          tooling,
          consumer,
          platform,
          'imperative',
        ],
        consumer,
      )
      result.bundles.push(
        JSON.parse(readFileSync(join(consumer, `native-${platform}.json`))),
      )
    }
    if (name === 'solid2') {
      const probe = join(consumer, 'solid-boundary.mjs')
      // This checks the actual installed Solid 2 client runtime and packed guard.
      // Native playback itself remains covered by native CI, not this Node probe.
      writeFileSync(
        probe,
        `import assert from 'node:assert/strict';
import {requireSolid1Binding} from './node_modules/@rafaelaugusto/jolt/dist/frameworks/solid-version.js';
for(const entry of ['@rafaelaugusto/jolt/solid','@rafaelaugusto/jolt/web/solid'])
  assert.throws(()=>requireSolid1Binding(entry), /requires Solid 1.x/);
await assert.rejects(import('@rafaelaugusto/jolt/web/solid'), /requires Solid 1.x/);
`,
      )
      run(process.execPath, [probe], consumer)
      const clientProbe = join(consumer, 'solid-client-boundary.mjs')
      await build({
        entryPoints: [probe],
        outfile: clientProbe,
        bundle: true,
        platform: 'browser',
        format: 'esm',
        external: ['node:assert/strict'],
        conditions: ['browser'],
        logLevel: 'silent',
      })
      run(process.execPath, [clientProbe], consumer)
      result.solid2BindingBoundary = { server: true, client: true }
    } else {
      const require = createRequire(manifestPath)
      const { compile } = require('svelte/compiler')
      const source = readFileSync(
        join(root, 'benchmarks/frameworks/svelte/app/App.svelte'),
        'utf8',
      )
      const compiled = compile(source, {
        filename: 'App.svelte',
        namespace: 'foreign',
        generate: 'dom',
      })
      assert(compiled.js.code.includes('@rafaelaugusto/jolt/svelte'))
      assert(compiled.js.code.includes('action_destroyer'))
      writeFileSync(join(consumer, 'compiled-native-actions.js'), compiled.js.code)
      result.svelte4NativeCompiler = true
    }
    report.nativeImperativePeers.push(result)
    passed(
      `${name}: normal clean install, native imperative types, iOS/Android packed production bundles and explicit binding boundary`,
    )
  }

  // Stable Svelte Native itself pins Core 8.9.9. Separately verify the original
  // issue's Core 9.1.3 + Svelte 4 imperative combination without that renderer.
  const modern = join(scratch, 'native-svelte4-core9')
  mkdirSync(modern)
  writeFileSync(
    join(modern, 'package.json'),
    JSON.stringify(
      {
        name: 'jolt-svelte4-core9-resolution',
        private: true,
        dependencies: {
          '@nativescript/core': '9.1.3',
          svelte: '4.2.20',
          '@rafaelaugusto/jolt': `file:${artifact}`,
        },
      },
      null,
      2,
    ) + '\n',
  )
  run(
    'npm',
    ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'],
    modern,
  )
  passed(
    'Svelte 4.2.20 with Core 9.1.3 resolves normally without a renderer peer override',
  )
}
