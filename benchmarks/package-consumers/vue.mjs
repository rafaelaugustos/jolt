import assert from 'node:assert/strict'
import { cpSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build, createServer, preview } from 'vite'

export async function checkVue({
  root,
  scratch,
  artifact,
  run,
  browser,
  passed,
  report,
}) {
  const consumer = join(scratch, 'web-vue')
  cpSync(join(root, 'test/fixtures/package-consumers/web-vue'), consumer, {
    recursive: true,
  })
  const version = JSON.parse(
    readFileSync(join(root, 'node_modules/vue/package.json')),
  ).version
  run('npm', ['install', artifact, `vue@${version}`, '--no-audit', '--no-fund'], consumer)
  const installed = Object.keys(
    JSON.parse(readFileSync(join(consumer, 'package-lock.json'))).packages,
  )
  assert(!installed.some((x) => /@nativescript|nativescript-vue|\/react(?:\/|$)/.test(x)))
  report.vueVersion = version
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
    run(process.execPath, args, consumer)
    const files = run(process.execPath, [...args, '--listFilesOnly'], consumer)
    assert(!/@nativescript|nativescript-vue/.test(files))
  }
  run(process.execPath, ['ssr-probe.mjs'], consumer)
  for (const inline of [false, true]) {
    const outDir = inline ? 'ssr-bundled' : 'ssr-external'
    await build({
      root: consumer,
      configFile: false,
      logLevel: 'silent',
      ssr: { noExternal: inline ? ['@rafaelaugusto/jolt'] : undefined },
      build: { ssr: 'server.ts', outDir },
    })
    run(
      process.execPath,
      ['ssr-probe.mjs', pathToFileURL(join(consumer, outDir, 'server.js')).href],
      consumer,
    )
  }
  const page = await browser.newPage(),
    errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  async function verify(server) {
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`)
    await page.waitForFunction(
      () => document.querySelector('#status').textContent === 'entered',
    )
    const card = page.locator('#card'),
      box = await card.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForFunction(
      () =>
        Math.abs(
          new DOMMatrix(getComputedStyle(document.querySelector('#card')).transform).a -
            1.056,
        ) < 0.001,
    )
    await page.mouse.up()
    await page.click('#visual')
    await page.waitForFunction(
      () => document.querySelector('#visual-status').textContent === 'true',
    )
    assert.equal(
      await card.evaluate((el) => getComputedStyle(el).backgroundColor),
      'rgb(0, 255, 0)',
    )
    assert.equal(await card.evaluate((el) => el.style.width), '220px')
    await page.click('#toggle')
    assert.equal(await card.count(), 1)
    await page.waitForFunction(
      () => document.querySelector('#status').textContent === 'left',
    )
    assert.equal(await card.count(), 0)
    assert.deepEqual(errors, [])
  }
  const dev = await createServer({
    root: consumer,
    configFile: false,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0 },
  })
  try {
    await dev.listen()
    assert.equal(
      await (await dev.ssrLoadModule('/server.ts')).render(),
      '<main data-motion="function">SSR</main>',
    )
    await verify(dev)
  } finally {
    await dev.close()
  }
  await build({
    root: consumer,
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'audit-vue',
        generateBundle() {
          for (const id of this.getModuleIds())
            assert(!/@nativescript|nativescript-vue/.test(id), id)
        },
      },
    ],
  })
  const prod = await preview({
    root: consumer,
    configFile: false,
    logLevel: 'silent',
    preview: { host: '127.0.0.1', port: 0 },
  })
  try {
    await verify(prod)
  } finally {
    await new Promise((r) => prod.httpServer.close(r))
    await page.close()
  }
  passed(
    'packed optional Vue consumer: strict NodeNext/Bundler, direct + Vite SSR, real dev/production enter/leave + press without native peers',
  )
}
