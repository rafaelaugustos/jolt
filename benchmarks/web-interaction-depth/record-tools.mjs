/** Actual browser controls over the optional public inspector/testing entries. */
import { chromium, expect } from '@playwright/test'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const output = resolve(process.argv[2] || '/tmp/jolt-web-tools-recording')
await mkdir(output, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-interaction-depth/server.mjs'], {
  stdio: 'ignore',
})
let browser
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4327')).ok) break
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 920, height: 740 },
    recordVideo: { dir: output, size: { width: 920, height: 740 } },
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto('http://127.0.0.1:4327/?mode=path')
  await page.waitForFunction(() => !!window.depth)
  await page.evaluate(() => {
    const {
      runtime,
      createMotionInspector,
      springCode,
      recordInteraction,
      replayInteraction,
    } = window.depth
    window.depth.scope.dispose()
    const el = (id) => document.getElementById(id)
    const card = el('source')
    runtime.release(card)
    card.textContent = 'CARD'
    el('title').textContent = 'Edit, record and replay'
    el('description').textContent =
      'Application-owned playback · explicit numeric trace · actual browser controls'
    const code = document.createElement('pre')
    code.id = 'code'
    code.style.cssText =
      'position:absolute;left:24px;top:220px;font-size:14px;white-space:pre-wrap'
    el('stage').append(code)
    const status = (text) => {
      el('status').textContent = text
    }
    const inspector = createMotionInspector(document, runtime, { development: true })
    inspector.watch(card, 'card')
    let animation, untrack, trace
    const reports = []
    const settings = { duration: 700, bounce: 0.25 }
    const play = (options = { duration: 2400, ease: 'linear' }) => {
      untrack?.()
      animation?.stop()
      runtime.set(card, { x: 0 })
      animation = runtime.animate(card, { x: 300 }, options)
      untrack = inspector.track(animation, 'move')
      return animation
    }
    const button = (id, label, callback) => {
      el(id).textContent = label
      el(id).onclick = callback
    }
    button('request', 'Play', () => {
      play()
      status('Application owns the animation')
    })
    button('pause', 'Pause / resume', () => {
      inspector.control('move', animation.paused ? 'play' : 'pause')
      status(
        animation.paused
          ? 'Inspector paused existing playback'
          : 'Inspector resumed existing playback',
      )
    })
    button('seek', 'Seek 60%', () => {
      inspector.control('move', 'seek', 0.6)
      status('Inspector seek: 60% · same application handle')
    })
    button('replace', 'Tune + copy code', () => {
      inspector.tune(settings, play)
      code.textContent = springCode({ to: 300, spring: settings })
      status('Edited via application callback · public TypeScript below')
    })
    button('inspect', 'Record take', async () => {
      const recorder = recordInteraction({
        now: () => performance.now(),
        seed: 7,
        metadata: {
          platform: 'web',
          os: 'browser',
          model: 'fixture',
          refreshRate: 60,
          density: 1,
          width: 920,
          height: 740,
        },
        settings: { timeScale: 1, reducedMotion: false },
        motions: [
          {
            id: 'card',
            kind: 'spring',
            axis: 'x',
            initial: 0,
            stiffness: 100,
            damping: 20,
            mass: 1,
            min: 0,
            max: 300,
            snap: [0, 300],
          },
        ],
      })
      recorder.input({ type: 'target', id: 'card', value: 300 })
      status('Recording one explicit target change')
      const take = play({ stiffness: 100, damping: 20, mass: 1 })
      if (!(await take.finished)) throw new Error('Recording was interrupted')
      recorder.checkpoint('card', {
        position: new DOMMatrix(getComputedStyle(card).transform).m41,
        velocity: 0,
        settled: true,
      })
      trace = recorder.stop()
      status(
        `Saved numeric trace · ${trace.entries.length} entries · endpoint checkpoint`,
      )
    })
    button('reset', 'Replay take', async () => {
      if (!trace) throw new Error('Record a take first')
      untrack?.()
      animation?.stop()
      let now = 0,
        start = 0,
        replayAnimation,
        disposed = false
      const scope = runtime.scope()
      status('Replaying explicit target input · application adapter controls time')
      const report = await replayInteraction(trace, {
        async advanceTo(at) {
          await new Promise((resolve) => setTimeout(resolve, at - now))
          now = at
          if (replayAnimation)
            replayAnimation.progress = Math.min(
              1,
              (now - start) / replayAnimation.duration,
            )
        },
        create() {
          runtime.set(card, { x: 0 })
          return {
            async input(event) {
              if (event.type !== 'target' || event.id !== 'card')
                throw new Error('This adapter supports only card target changes')
              start = now
              replayAnimation = scope.animate(
                card,
                { x: event.value },
                { stiffness: 100, damping: 20, mass: 1 },
              )
              await replayAnimation.ready
            },
            read() {
              return {
                position: new DOMMatrix(getComputedStyle(card).transform).m41,
                velocity: 0,
                settled: replayAnimation.progress === 1,
              }
            },
            dispose() {
              scope.dispose()
              runtime.release(card)
              disposed = true
            },
            resources() {
              return disposed ? scope.size : scope.size + 1
            },
          }
        },
      })
      reports.push({
        passed: report.passed,
        remainingResources: report.remainingResources,
        observations: report.observations,
      })
      window.toolsReport = { trace, reports }
      status(
        `Replay ${reports.length}: ${report.passed ? 'PASS' : 'FAIL'} · ${report.observations.length} checkpoint · ${report.remainingResources} remaining replay resources`,
      )
    })
    status('Ready · no global recording or hidden animation owner')
    window.addEventListener(
      'pagehide',
      () => {
        inspector.dispose()
        runtime.dispose()
      },
      { once: true },
    )
  })
  const click = async (id, delay = 700) => {
    await page.locator('#' + id).click()
    await page.waitForTimeout(delay)
  }
  await page.waitForTimeout(600)
  await click('request', 500)
  await click('pause')
  await click('seek')
  await click('pause', 1200)
  await click('replace', 1800)
  await expect(page.locator('#code')).toContainText('runtime.animate(card')
  await click('inspect', 200)
  await expect(page.locator('#status')).toContainText('Saved numeric trace', {
    timeout: 6000,
  })
  await page.waitForTimeout(900)
  for (let i = 1; i <= 2; i++) {
    await click('reset', 200)
    await expect(page.locator('#status')).toContainText(`Replay ${i}: PASS`, {
      timeout: 6000,
    })
    await page.waitForTimeout(900)
  }
  const report = await page.evaluate(() => window.toolsReport)
  expect(report.reports).toHaveLength(2)
  expect(report.reports.every((r) => r.passed && r.remainingResources === 0)).toBe(true)
  expect(report.reports[0]).toEqual(report.reports[1])
  expect(errors).toEqual([])
  await page.screenshot({ path: resolve(output, 'tools.png') })
  const video = page.video()
  await context.close()
  await rename(await video.path(), resolve(output, 'interaction-tools-web.webm'))
  await writeFile(
    resolve(output, 'report.json'),
    JSON.stringify({ ...report, errors }, null, 2) + '\n',
  )
  console.log(
    'Inspector editing and two semantic replays passed with no remaining replay resources.',
  )
} finally {
  await browser?.close()
  server.kill()
}
