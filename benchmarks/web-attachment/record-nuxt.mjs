import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { readFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url))
const { directory } = JSON.parse(
  readFileSync(root + 'benchmarks/package-consumers/results/nuxt.json', 'utf8'),
)
const captures = root + 'benchmarks/web-attachment/captures'
mkdirSync(captures, { recursive: true })
mkdirSync(`${root}.local/media`, { recursive: true })
const server = spawn(process.execPath, ['.output/server/index.mjs'], {
  cwd: directory,
  env: { ...process.env, PORT: '4396', HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'inherit'],
})
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve)
  server.once('exit', reject)
})
const browser = await chromium.launch()
try {
  const context = await browser.newContext({
    viewport: { width: 920, height: 900 },
    recordVideo: { dir: captures, size: { width: 920, height: 900 } },
  })
  const page = await context.newPage(),
    errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('http://127.0.0.1:4396')
  await page.waitForFunction(() => window.joltReady)
  await page.waitForTimeout(1000)
  await page.click('#away')
  await page.waitForTimeout(1300)
  await page.goBack()
  await page.waitForTimeout(1400)
  await page.click('#keepalive')
  await page.waitForTimeout(900)
  await page.click('#away')
  await page.waitForTimeout(1300)
  await page.click('#home')
  await page.waitForTimeout(1400)
  await page.click('#slow')
  await page.waitForTimeout(1400)
  await page.click('#home')
  await page.waitForTimeout(1800)
  const raw = await page.video().path()
  await context.close()
  if (errors.length) throw new Error(errors.join('\n'))
  const output = root + '.local/media/web-nuxt-attachment-chromium.mp4'
  execFileSync('ffmpeg', [
    '-y',
    '-v',
    'error',
    '-i',
    raw,
    '-vf',
    'fps=30,scale=920:-2',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '25',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    output,
  ])
  execFileSync('ffmpeg', ['-v', 'error', '-i', output, '-f', 'null', '-'])
  console.log(output)
} finally {
  await browser.close()
  server.kill('SIGTERM')
}
