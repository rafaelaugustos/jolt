import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Application } from '@nativescript/core'
import { physicsWorld, type PhysicsWorld } from '../src/physics/index.js'
import { setCircleFactory, type CircleFactory } from '../src/physics/native.js'
import { configure, motionScope } from '../src/index.js'
import { createView, driver } from './helpers.js'
let backend: ReturnType<typeof fake>, worlds: PhysicsWorld[]
function fake() {
  return {
    enabled: vi.fn(),
    resize: vi.fn(),
    impulse: vi.fn(),
    attach: vi.fn(),
    snapTo: vi.fn(),
    reset: vi.fn(),
    dispose: vi.fn(),
    snapshot: vi.fn(() => ({
      status: 'running' as const,
      bodies: [],
      frames: 0,
      steps: 0,
      contacts: 0,
      dragStarts: 0,
      dragMoves: 0,
      dragEnds: 0,
      dragCancels: 0,
      processingMs: 0,
      droppedMs: 0,
      clock: true,
      guides: 0,
    })),
  }
}
beforeEach(() => {
  worlds = []
  backend = fake()
  setCircleFactory(() => backend)
})
afterEach(() => {
  worlds.forEach((w) => w.dispose())
  setCircleFactory(undefined)
  configure({ reducedMotion: 'user' })
})
function scene() {
  const host = createView()
  host.actualSize = { width: 320, height: 400 }
  const a = createView(),
    b = createView()
  for (const v of [a, b]) {
    v.parent = host
    v.actualSize = { width: 40, height: 40 }
  }
  const bodies = [
    { id: 'a', view: a, radius: 20, x: 80, y: 80 },
    { id: 'b', view: b, radius: 20, x: 160, y: 80 },
  ]
  return { host, a, b, bodies }
}
function create(...args: Parameters<typeof physicsWorld>) {
  const w = physicsWorld(...args)
  worlds.push(w)
  return w
}
it('rejects overlap, invalid geometry, speed and identifiers before native mutation', () => {
  const { host, bodies } = scene()
  const factory = vi.fn<CircleFactory>(() => backend)
  setCircleFactory(factory)
  expect(() => create(host, [bodies[0]!, { ...bodies[1]!, x: 90 }])).toThrow(/overlap/)
  expect(() => create(host, [...bodies, { ...bodies[0]! }])).toThrow(/id/)
  expect(() => create(host, [{ ...bodies[0]!, radius: 19 }])).toThrow(/twice/)
  expect(() => create(host, [{ ...bodies[0]!, velocity: { x: 1200, y: 1200 } }])).toThrow(
    /speed/,
  )
  expect(() => create(host, bodies, { gravity: { x: NaN, y: 750 } })).toThrow(/finite/)
  expect(factory).not.toHaveBeenCalled()
})
it('owns views exclusively, cleans listeners and permits reuse after disposal', () => {
  const { host, a, bodies } = scene()
  const w = create(host, bodies)
  expect(() => create(host, bodies)).toThrow(/owner/)
  expect(a.listenerCount('unloaded')).toBe(1)
  w.dispose()
  w.dispose()
  expect(backend.dispose).toHaveBeenCalledTimes(1)
  expect(a.listenerCount('unloaded')).toBe(0)
  expect(host.listenerCount('layoutChanged')).toBe(0)
  create(host, bodies)
})
it('combines explicit pause, app suspension, Reduce Motion and load state without JS frames', () => {
  const { host, a, bodies } = scene()
  const w = create(host, bodies)
  expect(backend.enabled).toHaveBeenLastCalledWith(true)
  w.pause()
  Application.notify({ eventName: Application.resumeEvent })
  expect(backend.enabled).toHaveBeenLastCalledWith(false)
  w.play()
  configure({ reducedMotion: 'always' })
  expect(backend.enabled).toHaveBeenLastCalledWith(false)
  w.play()
  expect(backend.enabled).toHaveBeenLastCalledWith(false)
  configure({ reducedMotion: 'never' })
  expect(backend.enabled).toHaveBeenLastCalledWith(true)
  Application.notify({ eventName: Application.suspendEvent })
  expect(backend.enabled).toHaveBeenLastCalledWith(false)
  Application.notify({ eventName: Application.resumeEvent })
  expect(backend.enabled).toHaveBeenLastCalledWith(true)
  a.notify({ eventName: 'unloaded' })
  expect(backend.enabled).toHaveBeenLastCalledWith(false)
  a.notify({ eventName: 'loaded' })
  expect(backend.enabled).toHaveBeenLastCalledWith(true)
  expect(driver.frames.size).toBe(0)
})
it('forwards resize and impulses only at API boundaries and rejects unknown ids', () => {
  const { host, bodies } = scene()
  const w = create(host, bodies)
  host.actualSize = { width: 350, height: 500 }
  host.notify({ eventName: 'layoutChanged' })
  expect(backend.resize).toHaveBeenLastCalledWith(350, 500)
  w.impulse('b', { x: 50, y: -400 })
  expect(backend.impulse).toHaveBeenCalledWith(1, 50, -400)
  expect(() => w.impulse('missing', { x: 0, y: 0 })).toThrow(/Unknown/)
  expect(() => w.impulse('a', { x: Infinity, y: 0 })).toThrow(/finite/)
  w.dispose()
  backend.impulse.mockClear()
  w.impulse('a', { x: 1, y: 2 })
  w.play()
  expect(backend.impulse).not.toHaveBeenCalled()
})
it('scope suspension resumes only a previously playing world and disposal releases it', () => {
  const { host, bodies } = scene()
  const scope = motionScope(),
    w = create(host, bodies, { scope })
  scope.suspend()
  expect(w.paused).toBe(true)
  scope.resume()
  expect(w.paused).toBe(false)
  w.pause()
  scope.suspend()
  scope.resume()
  expect(w.paused).toBe(true)
  scope.dispose()
  expect(w.disposed).toBe(true)
})
it('rolls back failed setup and leaves views reusable', () => {
  const { host, a, bodies } = scene()
  setCircleFactory(() => {
    throw new Error('native failed')
  })
  expect(() => create(host, bodies)).toThrow('native failed')
  expect(a.listenerCount('loaded')).toBe(0)
  setCircleFactory(() => backend)
  create(host, bodies)
})

it('disposes if NativeScript rebuilds the native hierarchy, instead of driving stale views', () => {
  const { host, a, bodies } = scene()
  const w = create(host, bodies)
  a.unload()
  a.notify({ eventName: 'unloaded' })
  a.load()
  expect(w.disposed).toBe(true)
  expect(backend.dispose).toHaveBeenCalledTimes(1)
  expect(a.listenerCount('loaded')).toBe(0)
  create(host, bodies)
})

it('rejects sparse body lists and disabled touch surfaces before native setup', () => {
  const { host, a, bodies } = scene()
  const factory = vi.fn<CircleFactory>(() => backend)
  setCircleFactory(factory)
  expect(() => create(host, new Array(2))).toThrow(/id/)
  a.isEnabled = false
  expect(() => create(host, bodies)).toThrow(/touch/)
  expect(factory).not.toHaveBeenCalled()
})

it('validates springs and docks before creating a native world', () => {
  const { host, bodies } = scene(),
    factory = vi.fn<CircleFactory>(() => backend)
  setCircleFactory(factory)
  const a = bodies[0]!
  expect(() =>
    create(host, [{ ...a, attachment: { anchor: { x: 400, y: 20 } } }]),
  ).toThrow(/anchor/)
  expect(() =>
    create(host, [{ ...a, attachment: { anchor: { x: 100, y: 40 }, stiffness: 0 } }]),
  ).toThrow(/stiffness/)
  expect(() =>
    create(host, [
      { ...a, attachment: { anchor: { x: 100, y: 40 }, line: { color: 'red' } } },
    ]),
  ).toThrow(/RRGGBB/)
  expect(() => create(host, [{ ...a, snap: { points: new Array(2) } }])).toThrow(/point/)
  expect(() => create(host, [{ ...a, snap: { points: [{ x: 0, y: 50 }] } }])).toThrow(
    /point/,
  )
  expect(() =>
    create(host, [
      {
        ...a,
        snap: {
          points: [
            { x: 100, y: 50 },
            { x: 100, y: 50 },
          ],
        },
      },
    ]),
  ).toThrow(/distinct/)
  expect(() =>
    create(host, [{ ...a, snap: { points: [{ x: 100, y: 50 }], projection: 1 } }]),
  ).toThrow(/projection/)
  expect(factory).not.toHaveBeenCalled()
})
it('copies spring and snap input, including native line style', () => {
  const { host, bodies } = scene(),
    factory = vi.fn<CircleFactory>(() => backend)
  setCircleFactory(factory)
  const points = [{ x: 100, y: 200 }],
    anchor = { x: 150, y: 50 }
  create(host, [
    {
      ...bodies[0]!,
      attachment: { anchor, length: 80, line: { color: '#e0A193' } },
      snap: { points },
    },
  ])
  anchor.x = 10
  points[0]!.x = 10
  const config = factory.mock.calls[0]![2].bodies[0]!
  expect(config.attachment).toEqual({
    x: 150,
    y: 50,
    length: 80,
    stiffness: 180,
    damping: 24,
    line: { color: 0xe0a193, width: 1.5 },
  })
  expect(config.snap).toEqual({
    points: [{ x: 100, y: 200 }],
    stiffness: 180,
    damping: 24,
    projection: 0.12,
  })
})
it('retargets the native spring and snap while paused without starting JS frames', () => {
  const { host, bodies } = scene()
  const w = create(host, [
    {
      ...bodies[0]!,
      snap: {
        points: [
          { x: 80, y: 200 },
          { x: 240, y: 200 },
        ],
      },
    },
  ])
  w.pause()
  w.attach('a', { anchor: { x: 200, y: 40 }, length: 100 })
  w.snapTo('a', 1)
  expect(backend.attach).toHaveBeenLastCalledWith(0, {
    x: 200,
    y: 40,
    length: 100,
    stiffness: 180,
    damping: 24,
    line: null,
  })
  expect(backend.snapTo).toHaveBeenLastCalledWith(0, 1)
  expect(backend.enabled).toHaveBeenLastCalledWith(false)
  w.attach('a', null)
  expect(backend.attach).toHaveBeenLastCalledWith(0, null)
  expect(() => w.snapTo('a', 2)).toThrow(/point/)
  expect(() => w.snapTo('a', 0.5)).toThrow(/point/)
  expect(() => w.attach('missing', null)).toThrow(/Unknown/)
  expect(driver.frames.size).toBe(0)
  w.dispose()
  backend.attach.mockClear()
  backend.snapTo.mockClear()
  w.attach('a', null)
  w.snapTo('a', 0)
  expect(backend.attach).not.toHaveBeenCalled()
  expect(backend.snapTo).not.toHaveBeenCalled()
})
it('rejects invalid retargeting before updating existing native ownership', () => {
  const { host, bodies } = scene()
  const w = create(host, bodies)
  backend.enabled.mockClear()
  backend.resize.mockClear()
  expect(() => w.attach('a', { anchor: { x: 10, y: NaN } })).toThrow(/finite/)
  expect(backend.resize).not.toHaveBeenCalled()
  expect(backend.enabled).not.toHaveBeenCalled()
  expect(backend.attach).not.toHaveBeenCalled()
  expect(w.disposed).toBe(false)
})
