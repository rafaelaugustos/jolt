import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, firefox, webkit } from '@playwright/test'

const root = fileURLToPath(new URL('../', import.meta.url))
const baseline = process.argv.includes('--baseline')
const directory = process.env.JOLT_NUXT_REUSE || mkdtempSync(join(tmpdir(), 'jolt-nuxt-'))
console.log(`Nuxt consumer workspace: ${directory}`)
if (!process.env.JOLT_NUXT_REUSE)
  cpSync(join(root, 'test/fixtures/package-consumers/web-nuxt'), directory, {
    recursive: true,
  })
const run = (command, args, cwd = directory) =>
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, NUXT_TELEMETRY_DISABLED: '1' },
  })
if (!baseline && !process.env.JOLT_NUXT_REUSE) {
  const [packed] = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', directory],
      { cwd: root, encoding: 'utf8' },
    ),
  )
  const file = join(directory, 'package.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  manifest.dependencies['@rafaelaugusto/jolt'] =
    `file:${join(directory, packed.filename)}`
  writeFileSync(file, JSON.stringify(manifest, null, 2))
}
if (!process.env.JOLT_NUXT_REUSE) {
  run('npm', ['install', '--no-audit', '--no-fund'])
  run('npm', ['exec', 'nuxt', 'prepare'])
  run('npm', ['run', 'typecheck'])
  run('npm', ['run', 'build'])
}
const lock = readFileSync(join(directory, 'package-lock.json'), 'utf8')
assert(!/node_modules\/(?:@nativescript\/|nativescript-vue)/.test(lock))
const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  cwd: directory,
  env: { ...process.env, PORT: '4396', HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'inherit'],
})
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve)
  server.once('exit', (code) => reject(Error(`Nuxt exited ${code}`)))
})
const results = []
try {
  const html = await (await fetch('http://127.0.0.1:4396')).text()
  assert(html.includes('Deferred entry'))
  assert(!html.includes('style="opacity: 0'))
  for (const engine of baseline ? [chromium] : [chromium, firefox, webkit]) {
    const browser = await engine.launch()
    let page
    try {
      page = await browser.newPage()
      page.setDefaultTimeout(15000)
      console.log(`Checking ${engine.name()}`)
      const errors = []
      page.on('pageerror', (error) => {
        errors.push(String(error))
        console.error(String(error))
      })
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      await page.goto('http://127.0.0.1:4396')
      await page.waitForFunction(() => window.joltReady)
      await page.waitForSelector('#home-page')
      await page.click('#away')
      await page.waitForSelector('#away-page')
      await page.goBack()
      await page.waitForSelector('#home-page')
      await page.waitForFunction(
        () => document.querySelector('#home-page').getAnimations().length === 0,
      )
      const mounts = await page.evaluate(() => window.joltMounts)
      assert(
        mounts.includes(false),
        'Nuxt reproduction must actually mount detached targets',
      )
      if (baseline)
        assert(
          errors.some((e) => /mounted HTML elements/.test(e)),
          errors.join('\n'),
        )
      else {
        assert.deepEqual(errors, [])
        console.log('Initial detached insertion passed; checking KeepAlive')
        await page.click('#keepalive')
        for (let i = 0; i < 2; i++) {
          console.log('Going to details', await page.url())
          await page.click('#away')
          await page.waitForSelector('#away-page')
          await page.click('#home')
          await page.waitForSelector('#home-page')
        }
        // Cancellation of detached branches is covered by the Vue browser suite.
        // Nuxt 4.6.3 also strands CSS-only out-in during interrupted async navigation;
        // record that independent router limitation in the validation report.
        await page.click('#slow')
        await page.waitForURL('**/slow')
        await page.waitForSelector('#slow-page')
        await page.evaluate(() =>
          Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
        )
        await page.click('#home')
        await page.waitForSelector('#home-page')
        await page.evaluate(() =>
          Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
        )
        await page.emulateMedia({ reducedMotion: 'reduce' })
        console.log('Going to details', await page.url())
        await page.click('#away')
        await page.waitForSelector('#away-page')
        await page.click('#home')
        await page.waitForSelector('#home-page')
        assert.deepEqual(errors, [])
      }
      results.push({
        browser: browser.version(),
        baseline,
        detachedMounts: mounts.filter((v) => !v).length,
        errors,
      })
    } catch (error) {
      console.error(
        await page?.evaluate(() => ({
          url: location.href,
          html: document.body.innerHTML,
          animations: document
            .getAnimations()
            .map((a) => ({ state: a.playState, time: a.currentTime })),
        })),
      )
      await page?.screenshot({ path: join(directory, 'failure.png') })
      throw error
    } finally {
      await browser.close()
    }
  }
} finally {
  server.kill('SIGTERM')
}
mkdirSync(join(root, 'benchmarks/package-consumers/results'), { recursive: true })
writeFileSync(
  join(
    root,
    'benchmarks/package-consumers/results',
    baseline ? 'nuxt-baseline.json' : 'nuxt.json',
  ),
  JSON.stringify({ directory, results }, null, 2),
)
console.log(`Nuxt ${baseline ? 'baseline reproduced' : 'consumer passed'}: ${directory}`)
