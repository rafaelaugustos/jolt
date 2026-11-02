import assert from 'node:assert/strict'
import { checkVue } from '../benchmarks/package-consumers/vue.mjs'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  lstatSync,
  realpathSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build as esbuild } from 'esbuild'
import { build, createServer, preview } from 'vite'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('../', import.meta.url))
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'jolt-package-consumers-')))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const run = (command, args, cwd) => {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 180000,
    })
  } catch (error) {
    console.error(error.stdout?.toString(), error.stderr?.toString())
    throw error
  }
}
const json = (path) => JSON.parse(readFileSync(path, 'utf8'))
const report = {
  node: process.version,
  npm: run(npm, ['--version'], root).trim(),
  scratch,
  checks: [],
}
const passed = (message) => {
  report.checks.push(message)
  console.log(`PASS: ${message}`)
}
report.toolVersions = Object.fromEntries(
  ['vite', 'typescript', '@playwright/test'].map((name) => [
    name,
    json(join(root, 'node_modules', name, 'package.json')).version,
  ]),
)
const output = join(root, 'benchmarks/package-consumers/results')
mkdirSync(output, { recursive: true })
console.log(`Packed consumer workspace: ${scratch}`)

let browser
try {
  const [packed] = JSON.parse(
    run(npm, ['pack', '--ignore-scripts', '--json', '--pack-destination', scratch], root),
  )
  const artifact = join(scratch, packed.filename)
  for (const prefix of [
    'platforms/ios/',
    'platforms/android/java/',
    'dist/index.js',
    'dist/vue/index.js',
    'dist/native/index.js',
    'dist/web/public.js',
  ])
    assert(
      packed.files.some((file) => file.path.startsWith(prefix)),
      `Missing packed payload: ${prefix}`,
    )
  report.artifact = {
    filename: packed.filename,
    integrity: packed.integrity,
    size: packed.size,
  }
  const web = join(scratch, 'web')
  cpSync(join(root, 'test/fixtures/package-consumers/web'), web, { recursive: true })
  // No --omit=peer/optional, --legacy-peer-deps, aliases or source mocks.
  run(npm, ['install', artifact, '--no-audit', '--no-fund'], web)
  const lock = json(join(web, 'package-lock.json'))
  assert.deepEqual(Object.keys(lock.packages).sort(), [
    '',
    'node_modules/@rafaelaugusto/jolt',
  ])
  const installed = join(web, 'node_modules/@rafaelaugusto/jolt')
  assert(!lstatSync(installed).isSymbolicLink())
  const manifest = json(join(installed, 'package.json'))
  assert.deepEqual(
    Object.keys(manifest.exports).filter((k) => k.startsWith('./web')),
    ['./web', './web/vue'],
    'Add a packed framework consumer when introducing another Web entry',
  )
  for (const [entry, path] of [
    ['.', './dist/index.js'],
    ['./vue', './dist/vue/index.js'],
    ['./native', './dist/native/index.js'],
  ])
    assert.equal(manifest.exports[entry].default, path)
  report.webInstalledPackages = Object.keys(lock.packages).filter(Boolean)
  passed(
    'actual tarball installs only Jolt; native root, /vue and /native exports retain their meanings',
  )

  const resolution = run(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    for (const [specifier, file] of [
      ['@rafaelaugusto/jolt', '/dist/index.js'],
      ['@rafaelaugusto/jolt/vue', '/dist/vue/index.js'],
      ['@rafaelaugusto/jolt/native', '/dist/native/index.js'],
      ['@rafaelaugusto/jolt/web', '/dist/web/public.js'],
      ['@rafaelaugusto/jolt/web/vue', '/dist/web/vue/index.js'],
    ]) assert(import.meta.resolve(specifier).endsWith(file));
    for (const suffix of ['/core', '/dist/core/index.js', '/src/web/runtime.js', '/web/react'])
      assert.throws(() => import.meta.resolve('@rafaelaugusto/jolt' + suffix), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
    for (const [entry, peer] of [['', '@nativescript/core'], ['/vue', 'nativescript-vue'], ['/web/vue', 'vue']]) {
      try { await import('@rafaelaugusto/jolt' + entry); throw new Error('Unexpected native import success'); }
      catch (error) { assert.equal(error.code, 'ERR_MODULE_NOT_FOUND'); assert(error.message.includes(peer), error.message); console.log(error.message); }
    }
  `,
    ],
    web,
  )
  report.nativeMissingPeerDiagnostics = resolution.trim().split('\n')
  passed(
    'missing native peers are named in resolution errors; core and unimplemented framework entries stay private',
  )

  const tsc = join(root, 'node_modules/typescript/bin/tsc')
  for (const mode of ['NodeNext', 'Bundler']) {
    const args = [
      tsc,
      '-p',
      'tsconfig.json',
      '--moduleResolution',
      mode,
      '--module',
      mode === 'Bundler' ? 'ESNext' : 'NodeNext',
    ]
    run(process.execPath, args, web)
    const files = run(process.execPath, [...args, '--listFilesOnly'], web)
      .trim()
      .split(/\r?\n/)
    const dependencyFiles = files.filter((f) =>
      f.includes('/node_modules/@rafaelaugusto/jolt/'),
    )
    assert(dependencyFiles.length > 0)
    assert(dependencyFiles.every((f) => /\/dist\/(web|core)\//.test(f)))
    assert(!files.some((f) => /\/(?:@nativescript|nativescript-vue|react)\//.test(f)))
  }
  passed(
    'strict packed declarations resolve with NodeNext and Bundler without native ambient types',
  )

  const bundled = await esbuild({
    absWorkingDir: web,
    entryPoints: ['browser.ts'],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    metafile: true,
  })
  for (const [name, input] of Object.entries(bundled.metafile.inputs)) {
    assert(
      name === 'browser.ts' ||
        /^node_modules\/@rafaelaugusto\/jolt\/dist\/(web|core)\//.test(name),
      name,
    )
    assert(input.imports.every((i) => !i.external))
  }
  run(process.execPath, ['ssr-probe.mjs'], web)
  passed(
    'packed runtime graph is Web/core only; direct SSR import does not touch platform globals or schedule work',
  )

  const audit = () => ({
    name: 'audit-packed-jolt',
    generateBundle() {
      for (const id of this.getModuleIds()) {
        assert(!id.includes('@nativescript') && !id.includes('nativescript-vue'), id)
        if (id.includes('/@rafaelaugusto/jolt/'))
          assert(
            id.startsWith(installed + '/dist/web/') ||
              id.startsWith(installed + '/dist/core/'),
            id,
          )
      }
    },
  })
  for (const inline of [false, true]) {
    const outDir = inline ? 'ssr-bundled' : 'ssr-external'
    await build({
      root: web,
      configFile: false,
      logLevel: 'silent',
      plugins: [audit()],
      ssr: { noExternal: inline ? ['@rafaelaugusto/jolt'] : undefined },
      build: { ssr: 'server.ts', outDir },
    })
    run(
      process.execPath,
      ['ssr-probe.mjs', pathToFileURL(join(web, outDir, 'server.js')).href],
      web,
    )
  }
  passed('Vite SSR production output evaluates safely with external and bundled Jolt')

  browser = await chromium.launch()
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const checkPage = async (server) => {
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`)
    await page.waitForFunction(() =>
      document.getElementById('result')?.textContent?.startsWith('{'),
    )
    const result = JSON.parse(await page.locator('#result').textContent())
    assert.equal(result.completed, true)
    assert(Math.abs(result.x - 100) < 0.01)
    assert.equal(result.opacity, 1)
    assert.deepEqual(result.methods, [
      'animate',
      'animateLayout',
      'animateSize',
      'bind',
      'configure',
      'decay',
      'definePreset',
      'diagnostics',
      'dispose',
      'drag',
      'drawPath',
      'motionStates',
      'motionValue',
      'observeGeometry',
      'playbackProgress',
      'pointerFollow',
      'press',
      'refresh',
      'release',
      'scope',
      'scrollLinked',
      'scrollValue',
      'seekableTimeline',
      'sequence',
      'set',
      'sharedLayout',
      'springValue',
      'stop',
      'timeline',
      'viewportEnter',
    ])
    assert.deepEqual(errors, [])
    await page.click('#orchestration')
    await page.waitForFunction(
      () =>
        document.getElementById('orchestration-result')?.textContent ===
        'true:true:true:80:1:true',
    )
    await page.click('#lifecycle')
    await page.waitForFunction(
      () => document.getElementById('lifecycle-result')?.textContent === 'completed:0',
    )
    const card = page.locator('#card')
    const box = await card.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForFunction(
      () =>
        Math.abs(
          new DOMMatrix(getComputedStyle(document.getElementById('card')).transform).a -
            1.056,
        ) < 0.001,
    )
    await page.mouse.up()
    await page.waitForFunction(
      () =>
        Math.abs(
          new DOMMatrix(getComputedStyle(document.getElementById('card')).transform).a -
            1.1,
        ) < 0.001,
    )
    await page.click('#dynamic')
    await page.waitForFunction(
      () => document.getElementById('dynamic-result')?.textContent === 'ready',
    )
    const live = page.locator('#dynamic-card')
    const liveBox = await live.boundingBox()
    await page.mouse.move(liveBox.x + liveBox.width / 2, liveBox.y + liveBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      liveBox.x + liveBox.width / 2 + 75,
      liveBox.y + liveBox.height / 2,
      { steps: 6 },
    )
    await page.mouse.up()
    await page.waitForFunction(
      () =>
        Math.abs(
          new DOMMatrix(
            getComputedStyle(document.getElementById('dynamic-card')).transform,
          ).e - 100,
        ) < 0.01,
    )
    await page.click('#dynamic-dispose')
    await page.waitForFunction(
      () => document.getElementById('dynamic-result')?.textContent === 'disposed',
    )
    await page.click('#visual')
    await page.waitForFunction(() =>
      document.getElementById('visual-result')?.textContent?.startsWith('{'),
    )
    const visual = JSON.parse(await page.locator('#visual-result').textContent())
    assert.deepEqual(visual, {
      completed: true,
      sized: true,
      layout: true,
      color: 'rgb(0, 0, 255)',
      radius: '24px 12px',
      width: '180px',
      value: 1,
    })
    assert.deepEqual(errors, [])
  }
  const dev = await createServer({
    root: web,
    configFile: false,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0 },
  })
  try {
    await dev.listen()
    assert.equal(
      (await dev.ssrLoadModule('/server.ts')).render(),
      '<main data-motion="function"></main>',
    )
    await checkPage(dev)
  } finally {
    await dev.close()
  }
  await build({ root: web, configFile: false, logLevel: 'silent', plugins: [audit()] })
  const production = await preview({
    root: web,
    configFile: false,
    logLevel: 'silent',
    preview: { host: '127.0.0.1', port: 0 },
  })
  try {
    await checkPage(production)
  } finally {
    await new Promise((r) => production.httpServer.close(r))
  }
  report.browser = browser.version()
  passed(
    'Vite development + production consumers play real WAAPI motion and composed press using only the public facade',
  )

  await checkVue({ root, scratch, artifact, run, browser, passed, report })

  const native = join(scratch, 'native')
  cpSync(join(root, 'test/fixtures/package-consumers/native'), native, {
    recursive: true,
  })
  const versions = json(join(root, 'package-lock.json')).packages
  const peers = [
    '@nativescript/core',
    'nativescript-vue',
    '@nativescript/types-ios',
    '@nativescript/types-android',
  ]
  const nativeTools = json(
    join(root, 'benchmarks/native-app/package.json'),
  ).devDependencies
  run(
    npm,
    [
      'install',
      artifact,
      ...peers.map((name) => `${name}@${versions[`node_modules/${name}`].version}`),
      ...['@nativescript/ios', '@nativescript/android'].map(
        (name) => `${name}@${nativeTools[name]}`,
      ),
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
    ],
    native,
  )
  run(process.execPath, [tsc, '-p', 'tsconfig.json'], native)
  const nativeFiles = run(
    process.execPath,
    [tsc, '-p', 'tsconfig.json', '--listFilesOnly'],
    native,
  )
    .trim()
    .split(/\r?\n/)
  for (const file of ['index.d.ts', 'vue/index.d.ts', 'native/index.d.ts'])
    assert(
      nativeFiles.includes(join(native, 'node_modules/@rafaelaugusto/jolt/dist', file)),
    )
  assert(!nativeFiles.some((f) => f.includes('/jolt/dist/web/')))
  assert(!nativeFiles.some((f) => /lib\.dom(?:\.iterable)?\.d\.ts$/.test(f)))
  report.nativePeers = Object.fromEntries(
    peers.map((p) => [p, versions[`node_modules/${p}`].version]),
  )
  passed(
    'packed native root, /vue and /native declarations preserve contracts without DOM types',
  )

  const tooling = join(root, 'benchmarks/native-app')
  assert(
    existsSync(join(tooling, 'node_modules/@nativescript/webpack')),
    'Run npm ci in benchmarks/native-app for the pinned native build toolchain',
  )
  run(
    process.execPath,
    [join(tooling, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'],
    native,
  )
  passed(
    'native declarations also compile with the production fixture TypeScript version',
  )
  report.toolVersions.nativeTypescript = json(
    join(tooling, 'node_modules/typescript/package.json'),
  ).version
  report.nativeBundles = []
  for (const platform of ['ios', 'android']) {
    const log = run(
      process.execPath,
      [
        join(root, 'benchmarks/package-consumers/native-build.cjs'),
        tooling,
        native,
        platform,
      ],
      native,
    )
    writeFileSync(join(output, `native-${platform}.log`), log)
    const evidence = json(join(native, `native-${platform}.json`))
    report.nativeBundles.push(evidence)
    passed(
      `NativeScript ${platform} production bundle resolves packed root, /vue and /native without Jolt aliases`,
    )
  }

  report.completed = true
} finally {
  await browser?.close()
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  // Keep the tarball/consumer workspace for Mavis and failure inspection. The
  // report names it; CI runners are disposable and upload the compact report.
  console.log(`Consumer evidence: ${join(output, 'report.json')}`)
}
