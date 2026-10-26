import { Application, type View } from '@nativescript/core'
import { toView } from '../animate.js'
import { onReducedMotion, reducedMotion } from '../config.js'
import type { MotionScope } from '../motion-scope.js'
import type { Target } from '../types.js'
import { createCircleDriver, type CircleDriver } from './native.js'

export interface PhysicsVector {
  x: number
  y: number
}
export interface CircleBody {
  id: string
  /** A dedicated, square direct child of the container, sized to radius * 2. */
  view: Target
  radius: number
  /** Initial center in container-local DIPs, x right, y down. */
  x: number
  y: number
  mass?: number
  /** DIPs per second; maximum speed 1200. */
  velocity?: PhysicsVector
}
export interface PhysicsOptions {
  /** DIPs/s². Defaults to { x: 0, y: 750 }. */
  gravity?: PhysicsVector
  /** 0–1. Contacts slower than 40 DIPs/s settle without bouncing. Default .65. */
  restitution?: number
  /** Exponential velocity damping per second, 0–20. Default .5. */
  damping?: number
  reducedMotion?: 'pause' | 'continue'
  scope?: MotionScope
}
export interface PhysicsSnapshot {
  status: 'running' | 'sleeping' | 'paused' | 'detached' | 'invalid-bounds' | 'disposed'
  bodies: {
    id: string
    x: number
    y: number
    vx: number
    vy: number
    radius: number
    held: boolean
  }[]
  frames: number
  steps: number
  contacts: number
  dragStarts: number
  dragMoves: number
  dragEnds: number
  dragCancels: number
  processingMs: number
  /** Time discarded after UI stalls; the world never catches up without a bound. */
  droppedMs: number
  clock: boolean
}
export interface PhysicsWorld {
  readonly disposed: boolean
  readonly paused: boolean
  pause(): void
  play(): void
  /** Restore the initial arrangement, scaled to the current container bounds. */
  reset(): void
  /** Mass × DIPs/s. Ignored while paused, detached, reduced or being dragged. */
  impulse(id: string, impulse: PhysicsVector): void
  /** On-demand diagnostics; never installs a JS frame observer. */
  snapshot(): PhysicsSnapshot
  dispose(): void
}
const owners = new WeakSet<View>()
function number(value: number, name: string, min: number, max: number) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new RangeError(`${name} must be finite and within ${min}–${max}.`)
  return value
}
function vector(value: PhysicsVector, name: string, limit: number): PhysicsVector {
  if (!value || typeof value !== 'object') throw new TypeError(`Expected ${name} vector.`)
  return {
    x: number(value.x, `${name}.x`, -limit, limit),
    y: number(value.y, `${name}.y`, -limit, limit),
  }
}
function untransformed(view: View) {
  return (
    (view.translateX ?? 0) === 0 &&
    (view.translateY ?? 0) === 0 &&
    (view.rotate ?? 0) === 0 &&
    (view.rotateX ?? 0) === 0 &&
    (view.rotateY ?? 0) === 0 &&
    (view.scaleX ?? 1) === 1 &&
    (view.scaleY ?? 1) === 1
  )
}
/** Native, circle-only physics for 1–16 dedicated views. Create after layout. */
export function physicsWorld(
  target: Target,
  bodies: readonly CircleBody[],
  options: PhysicsOptions = {},
): PhysicsWorld {
  let host: View | undefined = toView(target)
  if (!Array.isArray(bodies) || bodies.length < 1 || bodies.length > 16)
    throw new RangeError('Physics needs 1–16 circles.')
  if (!options || typeof options !== 'object')
    throw new TypeError('Expected physics options.')
  if (options.scope?.disposed || options.scope?.suspended)
    throw new Error('Physics scope must be active.')
  const policy = options.reducedMotion ?? 'pause'
  if (policy !== 'pause' && policy !== 'continue')
    throw new TypeError('Invalid physics reduced-motion policy.')
  const gravity = vector(options.gravity ?? { x: 0, y: 750 }, 'gravity', 2000)
  const restitution = number(options.restitution ?? 0.65, 'restitution', 0, 1)
  const damping = number(options.damping ?? 0.5, 'damping', 0, 20)
  const { width, height } = host.getActualSize()
  number(width, 'Container width', 1, 10000)
  number(height, 'Container height', 1, 10000)
  for (
    let parent: View | undefined = host;
    parent;
    parent = parent.parent as View | undefined
  )
    if (!untransformed(parent))
      throw new Error('Physics requires an untransformed container and ancestors.')
  const ids: string[] = [],
    unique = new Set<View>()
  let views: View[] = []
  const config = Array.from(bodies, (body) => {
    if (!body || typeof body.id !== 'string' || !body.id.trim() || ids.includes(body.id))
      throw new TypeError('Each circle needs a unique, nonempty id.')
    ids.push(body.id)
    const view = toView(body.view)
    if (view.parent !== host || unique.has(view) || !untransformed(view))
      throw new Error('Use distinct, untransformed direct children for physics circles.')
    if (owners.has(view) || owners.has(host!))
      throw new Error('Physics view already has an owner.')
    if (!view.isLoaded || !view.nativeViewProtected)
      throw new Error('Create physics after native layout.')
    if (!view.isEnabled || view.isUserInteractionEnabled === false)
      throw new Error('Physics circles must accept touch input.')
    // Physics owns native input. A tap/drag/etc listener would compete with the native recognizer.
    for (const gesture of [1, 2, 4, 8, 16, 32, 64, 128])
      if (view.getGestureObservers?.(gesture)?.length)
        throw new Error('Physics circles require exclusive native touch input.')
    const radius = number(body.radius, 'radius', 12, 256),
      mass = number(body.mass ?? 1, 'mass', 0.1, 100)
    const size = view.getActualSize()
    if (Math.abs(size.width - radius * 2) > 1 || Math.abs(size.height - radius * 2) > 1)
      throw new Error('Circle views must be square and sized to twice their radius.')
    const x = number(body.x, 'x', radius, width - radius),
      y = number(body.y, 'y', radius, height - radius)
    const velocity = vector(body.velocity ?? { x: 0, y: 0 }, 'velocity', 1200)
    if (Math.hypot(velocity.x, velocity.y) > 1200)
      throw new RangeError('Circle speed cannot exceed 1200 DIPs/s.')
    views.push(view)
    unique.add(view)
    return { x, y, radius, mass, vx: velocity.x, vy: velocity.y }
  })
  if (!host.isLoaded || !host.nativeViewProtected)
    throw new Error('Create physics after native layout.')
  if (
    config.reduce((area, b) => area + Math.PI * b.radius ** 2, 0) >
    width * height * 0.4
  )
    throw new RangeError('Circles may occupy at most 40% of the container area.')
  config.forEach((a, i) =>
    config.slice(i + 1).forEach((b) => {
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius)
        throw new RangeError('Initial circles must not overlap.')
    }),
  )
  let native: CircleDriver | undefined,
    ended = false,
    held = false,
    background = false
  let worldRef: PhysicsWorld | undefined
  const originalNative = new Map([host, ...views].map((v) => [v, v.nativeViewProtected]))
  const releases: (() => void)[] = [],
    unloaded = new Set<View>()
  const update = () => {
    if (ended || !host || !native) return
    if (
      [host, ...views].some(
        (v) => v.nativeViewProtected && v.nativeViewProtected !== originalNative.get(v),
      )
    ) {
      // A rebuilt native hierarchy needs fresh recognizers and original-state captures.
      worldRef?.dispose()
      return
    }
    native.resize(host.getActualSize().width, host.getActualSize().height)
    native.enabled(
      !held &&
        !background &&
        !unloaded.size &&
        (policy === 'continue' || !reducedMotion()) &&
        views.every((v) => v.parent === host && v.isLoaded && !!v.nativeViewProtected),
    )
  }
  const suspend = () => {
      background = true
      update()
    },
    resume = () => {
      background = false
      update()
    }
  const cleanup = () => {
    releases.splice(0).forEach((fn) => fn())
    views.forEach((v) => owners.delete(v))
    if (host) owners.delete(host)
    views = []
    host = undefined
    unloaded.clear()
    originalNative.clear()
  }
  try {
    native = createCircleDriver(host, views, {
      width,
      height,
      gravity,
      restitution,
      damping,
      bodies: config,
    })
    ;[host, ...views].forEach((v) => {
      owners.add(v)
      const loaded = () => {
          unloaded.delete(v)
          update()
        },
        unload = () => {
          unloaded.add(v)
          update()
        }
      v.on('loaded', loaded)
      v.on('unloaded', unload)
      v.on('layoutChanged', update)
      releases.push(() => {
        v.off('loaded', loaded)
        v.off('unloaded', unload)
        v.off('layoutChanged', update)
      })
    })
    Application.on(Application.suspendEvent, suspend)
    Application.on(Application.resumeEvent, resume)
    releases.push(() => {
      Application.off(Application.suspendEvent, suspend)
      Application.off(Application.resumeEvent, resume)
    }, onReducedMotion(update))
    const world: PhysicsWorld = {
      get disposed() {
        return ended
      },
      get paused() {
        return held
      },
      pause() {
        if (!ended) {
          held = true
          update()
        }
      },
      play() {
        if (!ended) {
          held = false
          update()
        }
      },
      reset() {
        if (!ended) native!.reset()
      },
      impulse(id, impulse) {
        const index = ids.indexOf(id)
        if (index < 0) throw new RangeError(`Unknown circle: ${id}`)
        const v = vector(impulse, 'impulse', 120000)
        if (!ended) native!.impulse(index, v.x, v.y)
      },
      snapshot() {
        const result = native!.snapshot()
        return { ...result, bodies: result.bodies.map((b, i) => ({ ...b, id: ids[i]! })) }
      },
      dispose() {
        if (ended) return
        ended = true
        try {
          native!.dispose()
        } finally {
          cleanup()
        }
      },
    }
    worldRef = world
    options.scope?.add(world)
    update()
    return world
  } catch (error) {
    ended = true
    try {
      native?.dispose()
    } finally {
      cleanup()
    }
    throw error
  }
}
