import { expect, test } from '@playwright/test'
import type {} from './fixture.js'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.depth)
})

test('real local audio prepares and supports pause, mute, replacement and disposal', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const errors: string[] = []
    const cue = window.depth.audioCue(document, '/cue.wav', {
      onError(error) {
        const media = error as { name?: string; code?: number; message?: string }
        errors.push(`${media.name ?? 'MediaError'}: ${media.code ?? ''} ${media.message}`)
      },
    })
    if (!(await cue.ready)) throw new Error('Audio preparation failed')
    const button = document.createElement('button')
    button.id = 'audio-play'
    button.textContent = 'Play cue'
    document.body.append(button)
    Object.assign(window, { audioTest: { cue, voice: undefined, errors } })
    button.onclick = () => {
      const state = (window as any).audioTest
      state.voice = cue.play()
    }
  })
  await page.click('#audio-play')
  await page.waitForTimeout(120)
  const result = await page.evaluate(async () => {
    const { cue, voice, errors } = (window as any).audioTest
    voice.pause()
    const paused = voice.paused
    cue.muted = true
    cue.volume = 0.4
    cue.muted = false
    voice.play()
    const next = cue.play(),
      replaced = await voice.finished
    cue.dispose()
    return {
      paused,
      replaced,
      stopped: await next.finished,
      disposed: cue.status,
      duration: cue.duration,
      errors,
    }
  })
  expect(result.errors).toEqual([])
  expect(result.paused).toBe(true)
  expect(result.replaced).toBe(false)
  expect(result.stopped).toBe(false)
  expect(result.disposed).toBe('disposed')
  expect(result.duration).toBeCloseTo(1000, -1)
})

test('missing audio and unsupported origins do not prevent visual completion', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const errors: string[] = [],
      cue = window.depth.audioCue(document, '/missing.wav', {
        onError: (e) => errors.push(String(e)),
      })
    const audio = cue.play()
    const visual = window.depth.runtime.animate(
      document.getElementById('source')!,
      { opacity: 0.5 },
      { duration: 50 },
    )
    let rejected = false
    try {
      window.depth.audioCue(document, 'https://unrelated.example/audio.wav')
    } catch {
      rejected = true
    }
    return {
      prepared: await cue.ready,
      audio: await audio.finished,
      visual: await visual.finished,
      errors: errors.length,
      rejected,
    }
  })
  expect(result).toEqual({
    prepared: false,
    audio: false,
    visual: true,
    errors: 1,
    rejected: true,
  })
})

test('named browser cues fire once, pause their effects and seek silently', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.depth.scope.dispose()
    const runtime = window.depth.runtime,
      target = document.getElementById('source')!
    runtime.release(target)
    let calls = 0,
      stopped = 0,
      paused = 0,
      resumed = 0
    const animation = runtime.animate(
      target,
      { x: 100 },
      { duration: 1200, ease: 'linear' },
    )
    await animation.ready
    const cue = runtime.withTimelineCues(
      animation,
      [
        {
          name: 'impact',
          at: 40,
          effect() {
            calls++
            return {
              pause() {
                paused++
              },
              play() {
                resumed++
              },
              dispose() {
                stopped++
              },
            }
          },
        },
      ],
      { late: 'catch-up' },
    )
    await new Promise((resolve) => setTimeout(resolve, 120))
    cue.pause()
    cue.play()
    cue.pause()
    const before = calls
    cue.progress = 0.8
    const after = calls
    cue.dispose()
    const resources = runtime.diagnostics({ development: true }).snapshot().resources
    return {
      before,
      after,
      stopped,
      paused,
      resumed,
      finished: await cue.finished,
      resources,
    }
  })
  expect(result.before).toBe(1)
  expect(result.after).toBe(1)
  expect(result.stopped).toBe(1)
  expect(result.paused).toBe(2)
  expect(result.resumed).toBe(1)
  expect(result.finished).toBe(false)
  expect(result.resources.frameTasks).toBe(0)
  expect(result.resources.timers).toBe(0)
})
