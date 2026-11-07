import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
const server = spawn(process.execPath, ['benchmarks/web-interaction-depth/server.mjs'], {
  stdio: 'ignore',
})
let browser
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4327')).ok) break
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:4327')
  await page.waitForFunction(() => !!window.depth)
  const report = await page.evaluate(async () => {
    window.depth.runtime.dispose()
    return await window.depth.measureInspection()
  })
  await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n')
  console.log('Completed ' + report.runs.length + ' runs, including warmup.')
} finally {
  await browser?.close()
  server.kill()
}
