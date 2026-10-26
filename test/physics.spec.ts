import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Application } from '@nativescript/core'
import { physicsWorld, type PhysicsWorld } from '../src/physics/index.js'
import { setCircleFactory } from '../src/physics/native.js'
import { configure, motionScope } from '../src/index.js'
import { createView, driver } from './helpers.js'
let backend: ReturnType<typeof fake>, worlds: PhysicsWorld[]
function fake() {
  return {
    enabled: vi.fn(),
    resize: vi.fn(),
    impulse: vi.fn(),
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
  const factory = vi.fn(() => backend)
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
  const factory = vi.fn(() => backend)
  setCircleFactory(factory)
  expect(() => create(host, new Array(2))).toThrow(/id/)
  a.isEnabled = false
  expect(() => create(host, bodies)).toThrow(/touch/)
  expect(factory).not.toHaveBeenCalled()
})
