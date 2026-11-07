import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
const output = resolve(process.argv[2] ?? '/tmp/jolt-composition-browser-recordings')
await mkdir(output, { recursive: true })
const server = spawn(
  process.execPath,
  ['benchmarks/web-composition-portable/server.mjs'],
  { stdio: 'ignore' },
)
const browser = await chromium.launch()
const records = []
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4337')).ok) break
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  const flows = {
    lifecycle: [
      ['Draw', 700],
      ['Pause', 650],
      ['Cache / restore', 600],
      ['Cache / restore', 600],
      ['Resume', 1400],
      ['Replace', 600],
      ['Draw', 2200],
      ['Unmount', 500],
    ],
    behaviors: [
      ['Touch', 500],
      ['Dress', 400],
      ['Touch', 400],
      ['Eat', 400],
      ['Dress', 2600],
      ['Touch', 600],
      ['Cancel', 1200],
    ],
    text: [
      ['Shine', 2200],
      ['Replace text', 400],
      ['Shine', 600],
      ['Pause', 700],
      ['Resume', 1600],
      ['Shine', 500],
      ['Stop', 700],
    ],
    preferences: [
      ['Animate', 2200],
      ['Reduce motion', 400],
      ['Animate', 800],
      ['Full motion', 400],
      ['Animate', 2000],
    ],
    rig: [
      ['Wave', 400],
      ['Reach', 400],
      ['Wave', 1500],
      ['Reach', 1500],
      ['Blend', 1200],
      ['Attach / detach flower', 600],
      ['Attach / detach flower', 600],
      ['Rest', 1500],
    ],
    sensors: [
      ['Use injected events', 300],
      ['Inject sample', 500],
      ['Inject sample', 500],
      ['Pause', 300],
      ['Inject sample', 400],
      ['Resume', 300],
      ['Inject sample', 500],
      ['linearAcceleration', 300],
      ['Inject sample', 600],
      ['magneticField', 1000],
      ['Dispose', 600],
    ],
  }
  for (const [scene, flow] of Object.entries(flows)) {
    const context = await browser.newContext({
      viewport: { width: 920, height: 850 },
      recordVideo: { dir: output, size: { width: 920, height: 850 } },
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    const origin = performance.now()
    await page.goto('http://127.0.0.1:4337/?scene=' + scene)
    await page.waitForFunction(() => !!window.composition)
    await page.waitForTimeout(600)
    const start = (performance.now() - origin) / 1000
    await page.screenshot({ path: join(output, scene + '-before.png') })
    for (const [label, delay] of flow) {
      await page.getByRole('button', { name: label, exact: true }).click()
      await page.waitForTimeout(delay)
    }
    await page.screenshot({ path: join(output, scene + '-after.png') })
    const duration = (performance.now() - origin) / 1000 - start
    const video = page.video()
    await context.close()
    const raw = await video.path(),
      file = join(output, `composition-${scene}-web.mp4`)
    const rawDuration = Number(
      JSON.parse(
        execFileSync('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', raw], {
          encoding: 'utf8',
        }),
      ).format.duration,
    )
    const trimStart = 0
    if (errors.length) throw Error(scene + ': ' + errors.join('\n'))
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        raw,
        '-vf',
        'fps=30,scale=720:-2',
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        '24',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-an',
        file,
      ],
      { stdio: 'ignore' },
    )
    execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], {
      stdio: 'pipe',
    })
    const metadata = JSON.parse(
      execFileSync(
        'ffprobe',
        ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file],
        { encoding: 'utf8' },
      ),
    )
    records.push({
      scene,
      file,
      platform: `Chromium ${browser.version()} / macOS, actual browser input and playback`,
      limits:
        scene === 'sensors'
          ? 'Injected DeviceMotion events; no hardware accuracy or physical availability claim.'
          : 'No performance comparison.',
      interactionDuration: duration,
      rawDuration,
      trimStart,
      duration: Number(metadata.format.duration),
      codec: metadata.streams[0].codec_name,
    })
    console.log(`Recorded ${scene}: ${metadata.format.duration}s`)
  }
  await writeFile(
    join(output, 'recordings.json'),
    JSON.stringify(records, null, 2) + '\n',
  )
} finally {
  await browser.close()
  server.kill('SIGTERM')
}
