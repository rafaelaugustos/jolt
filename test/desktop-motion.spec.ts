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
