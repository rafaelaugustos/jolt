import { expect, it } from 'vitest'
import { FrameScheduler } from '../src/web/scheduler.js'
import { NumericValue } from '../src/web/value.js'
import { SpringValueNode } from '../src/web/spring-value.js'

function scene(rate = 1) {
  let time = 0,
    id = 0,
    reduced = false
  const frames = new Map<number, (n: number) => void>()
  const scheduler = new FrameScheduler({
    now: () => time,
    request: (cb) => {
      frames.set(++id, cb)
      return id
    },
    cancel: (key) => {
      frames.delete(key)
    },
    error: (e) => {
      throw e
    },
  })
  const source = new NumericValue(
    scheduler,
    0,
    (e) => {
      throw e
    },
    () => {},
  )
  const spring = new SpringValueNode(
    scheduler,
    source,
    { stiffness: 170, damping: 18 },
    () => ({ reduced, timeScale: rate }),
    (e) => {
      throw e
    },
    () => {},
  )
  return {
    source,
    spring,
    scheduler,
    frames,
    time: (n: number) => {
      time = n
    },
    reduced: () => {
      reduced = true
      spring.preferenceChanged()
    },
    frame: (n: number) => {
      time = n
      const callbacks = [...frames.values()]
      frames.clear()
      for (const cb of callbacks) cb(n)
    },
  }
}
it('preserves command-time position and velocity during repeated retargets', () => {
  const s = scene()
  s.source.set(100)
  s.frame(90)
  s.time(95)
  const p = s.spring.get(),
    v = s.spring.getVelocity()
  s.source.set(-40)
  expect(s.spring.get()).toBeCloseTo(p, 10)
  expect(s.spring.getVelocity()).toBeCloseTo(v, 2)
  s.source.set(80)
  expect(s.spring.get()).toBeCloseTo(p, 10)
  expect(s.spring.getVelocity()).toBeCloseTo(v, 2)
  for (let t = 100; t <= 4000; t += 10) s.frame(t)
  expect(s.spring.get()).toBe(80)
  expect(s.spring.getVelocity()).toBe(0)
  expect(s.frames.size).toBe(0)
})
it('has refresh-rate independent position and velocity at common timestamps', () => {
  const snapshots = [60, 120, 144].map((hz) => {
    const s = scene()
    s.source.set(100)
    for (let t = 1000 / hz; t < 200; t += 1000 / hz) s.frame(t)
    s.time(200)
    return [s.spring.get(), s.spring.getVelocity()]
  })
  for (const state of snapshots) {
    expect(state[0]).toBeCloseTo(snapshots[0]![0]!, 10)
    expect(state[1]).toBeCloseTo(snapshots[0]![1]!, 10)
  }
})
it('holds manual pause and hidden time without a catch-up jump', () => {
  const s = scene()
  s.source.set(100)
  s.frame(80)
  s.spring.pause()
  const p = s.spring.get(),
    v = s.spring.getVelocity()
  s.time(1000)
  s.source.set(200)
  expect(s.spring.get()).toBe(p)
  expect(s.spring.getVelocity()).toBe(v)
  expect(s.frames.size).toBe(0)
  s.spring.play()
  expect(s.spring.get()).toBe(p)
  s.frame(1010)
  s.scheduler.hidden(true)
  const held = s.spring.get()
  s.time(10000)
  expect(s.spring.get()).toBe(held)
  expect(s.frames.size).toBe(0)
  s.scheduler.hidden(false)
  s.frame(10010)
  expect(s.spring.get()).toBeGreaterThan(held)
})
it('settles live reduced motion and detaches followers when their input is disposed', () => {
  const s = scene()
  s.source.set(100)
  s.frame(20)
  s.reduced()
  expect(s.spring.get()).toBe(100)
  expect(s.frames.size).toBe(0)
  s.source.set(300)
  expect(s.spring.get()).toBe(300)
  expect(s.frames.size).toBe(0)
  s.source.dispose()
  expect(s.spring.disposed).toBe(true)
  expect(() => s.spring.play()).toThrow(/disposed/)
})
it('stop clears velocity; jump uses the latest destination; invalid options do not attach a follower', () => {
  const s = scene()
  s.source.set(100)
  s.frame(30)
  s.spring.stop()
  expect(s.spring.getVelocity()).toBe(0)
  s.source.set(200)
  s.spring.jump()
  expect(s.spring.get()).toBe(200)
  expect(
    () =>
      new SpringValueNode(
        s.scheduler,
        s.source,
        { mass: 0 },
        () => ({ reduced: false, timeScale: 1 }),
        () => {},
        () => {},
      ),
  ).toThrow()
})
it('captures timeScale per trajectory and continues across a long elapsed frame', () => {
  const normal = scene(),
    slow = scene(0.5)
  normal.source.set(100)
  slow.source.set(100)
  normal.frame(200)
  slow.frame(400)
  expect(slow.spring.get()).toBeCloseTo(normal.spring.get(), 10)
  expect(slow.spring.getVelocity() * 2).toBeCloseTo(normal.spring.getVelocity(), 10)
  slow.frame(20000)
  expect(slow.spring.get()).toBe(100)
  expect(slow.frames.size).toBe(0)
})
