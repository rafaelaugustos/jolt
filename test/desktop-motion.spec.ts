import { expect, it, vi } from 'vitest'
import { finiteMotion } from '../src/desktop/finite.js'
it('isolates channels and ignores late native completion after cancellation, disposal and reuse', async () => {
  const surface = {},
    stop = vi.fn(),
    write = vi.fn(),
    callbacks: (() => void)[] = []
  const channel = () => ({
    read: () => 0,
    write,
    play: (_track: unknown, done: () => void) => {
      callbacks.push(done)
      return stop
    },
  })
  const owner = finiteMotion(surface, channel, () => false)
  expect(() => finiteMotion(surface, channel, () => false)).toThrow(/owner/)
  const x = owner.animate('x', 40),
    y = owner.animate('y', 60)
  const replacement = owner.animate('x', 20)
  callbacks[0]!()
  expect(await x.finished).toBe(false)
  callbacks[2]!()
  expect(await replacement.finished).toBe(true)
  owner.dispose()
  expect(await y.finished).toBe(false)
  const next = finiteMotion(surface, channel, () => true)
  owner.dispose()
  callbacks[1]!()
  expect(await next.animate('opacity', 1).finished).toBe(true)
  expect(write).toHaveBeenCalledWith(1)
  expect(stop).toHaveBeenCalledTimes(2)
  next.dispose()
})

it('retains the sampled scale and original remaining duration across two pauses', async () => {
  let time = 0,
    value = 1
  vi.stubGlobal('performance', { now: () => time })
  const segments: { duration: number; values: readonly number[] }[] = []
  const callbacks: (() => void)[] = []
  const owner = finiteMotion(
    {},
    () => ({
      read: () => value,
      write: (next) => {
        value = next
      },
      play: (segment, done) => {
        segments.push(segment)
        callbacks.push(done)
        return () => {}
      },
    }),
    () => false,
  )
  try {
    const handle = owner.animate('scaleX', 2, { duration: 1000, ease: 'easeIn' })
    time = 300
    value = 1.12
    handle.pause()
    handle.pause()
    callbacks[0]!()
    time = 2000
    handle.resume()
    expect(segments[1]?.duration).toBe(700)
    expect(segments[1]?.values[0]).toBe(1.12)
    time = 2200
    value = 1.4
    handle.pause()
    time = 4500
    handle.resume()
    expect(segments[2]?.duration).toBe(500)
    callbacks[2]!()
    expect(await handle.finished).toBe(true)
    expect(() => owner.animate('scaleY', 0)).toThrow(RangeError)
    const rotation = owner.animate('rotate', -25)
    rotation.pause()
    owner.suspend()
    rotation.resume()
    expect(await rotation.finished).toBe(false)
    expect(segments).toHaveLength(4)
  } finally {
    owner.dispose()
    vi.unstubAllGlobals()
  }
})
