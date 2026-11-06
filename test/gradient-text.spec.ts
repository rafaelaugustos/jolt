import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { Application, Label } from '@nativescript/core'
import { gradientText, configure, motionScope, type GradientText } from '../src/index.js'
import { setTextPainterFactory, type TextPainter } from '../src/gradient-text/native.js'
import { driver, flush } from './helpers.js'
import { Label as TestLabel } from './shims/core.js'
import type { Track } from '../src/track.js'

const options = { colors: ['#553399', '#DD6699'] }
let owners: GradientText[], painters: TextPainter[]
beforeEach(() => {
  owners = []
  painters = []
  setTextPainterFactory(() => {
    const painter = {
      refresh: vi.fn(),
      play: vi.fn(),
      control: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
      bytes: () => 4096,
    }
    painters.push(painter)
    return painter
  })
})
afterEach(() => {
  owners.forEach((owner) => owner.dispose())
  setTextPainterFactory()
})
const make = (label = new Label()) => {
  const effect = gradientText(label, options)
  owners.push(effect)
  return effect
}

it('passes the requested direction to native playback without changing glyph ownership', () => {
  const effect = gradientText(new Label(), { ...options, sheen: { direction: 'left' } })
  owners.push(effect)
  effect.play({ duration: 1000, ease: 'linear' })
  const track = vi.mocked(painters[0]!.play).mock.calls.at(-1)![0] as Track
  expect(track.valueAt(0)).toBe(1)
  expect(track.valueAt(1000)).toBe(0)
  expect(painters).toHaveLength(1)
  effect.stop()
  expect(effect.snapshot().attached).toBe(true)
})

it('validates options and single ownership before allocating native painters', () => {
  const label = new Label()
  expect(() => gradientText(label, { colors: ['#ffffff'] })).toThrow(/2..8/)
  expect(() => gradientText(label, { ...options, stops: [1, 0] })).toThrow(/ordered/)
  expect(painters).toHaveLength(0)
  make(label)
  expect(() => make(label)).toThrow(/already/)
  expect(painters).toHaveLength(1)
})
it('shares a controllable clock, keeps the fill when stopped and disposes all listeners', async () => {
  const label = new Label(),
    effect = make(label)
  const playback = effect.play({ duration: 1000, ease: 'linear' })
  driver.advance(200)
  effect.suspend()
  expect(playback.paused).toBe(true)
  driver.advance(1000)
  expect(playback.progress).toBeCloseTo(0.2)
  effect.resume()
  driver.advance(800)
  expect(await playback.finished).toBe(true)
  expect(effect.snapshot()).toMatchObject({ attached: true, playing: false })
  expect(painters[0]!.dispose).not.toHaveBeenCalled()
  effect.dispose()
  effect.dispose()
  expect(painters[0]!.dispose).toHaveBeenCalledOnce()
  expect((label as unknown as TestLabel).listenerCount('textChange')).toBe(0)
})
it('coalesces glyph invalidation and keeps the active timeline position on refresh', async () => {
  const label = new Label(),
    effect = make(label)
  const playback = effect.play({ duration: 1000, ease: 'linear' })
  driver.advance(250)
  label.text = 'Changed'
  effect.refresh()
  effect.refresh()
  await flush()
  expect(painters[0]!.control).toHaveBeenLastCalledWith(250, false)
  expect(playback.progress).toBeCloseTo(0.25)
  effect.stop()
  expect(await playback.finished).toBe(false)
})
it('reattaches background playback and preserves manually paused sheen', async () => {
  const label = new Label(),
    effect = make(label)
  const playback = effect.play({ duration: 1000 })
  driver.advance(250)
  Application.notify({ eventName: Application.suspendEvent })
  label.notify({ eventName: 'unloaded', object: label })
  expect(painters[0]!.dispose).toHaveBeenCalledOnce()
  Application.notify({ eventName: Application.resumeEvent })
  expect(painters).toHaveLength(2)
  expect(playback.paused).toBe(false)
  playback.pause()
  Application.notify({ eventName: Application.suspendEvent })
  Application.notify({ eventName: Application.resumeEvent })
  expect(playback.paused).toBe(true)
  effect.dispose()
  expect(await playback.finished).toBe(false)
})
it('keeps a static accessible fill with reduced motion and retained scope suspension', async () => {
  configure({ reducedMotion: 'always' })
  const scope = motionScope(),
    effect = scope.retain(make())
  expect(await effect.play().finished).toBe(true)
  expect(painters[0]!.play).not.toHaveBeenCalled()
  scope.suspend()
  expect(effect.snapshot().attached).toBe(true)
  scope.dispose()
  expect(effect.disposed).toBe(true)
})
