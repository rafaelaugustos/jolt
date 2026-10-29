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
export interface PhysicsAttachment {
  /** Anchor in container-local DIPs. Scales proportionally when the board resizes. */
  anchor: PhysicsVector
  /** Rest length in DIPs; remains fixed on resize. Default 0. */
  length?: number
  /** Spring force per DIP, 1–1000; default 180. */
  stiffness?: number
  /** Viscous damping, 0–120; default 24. */
  damping?: number
  /** Optional native line, drawn from the anchor to the circle edge. */
  line?: { color: string; width?: number }
}
export interface PhysicsSnap {
  /** 1–8 distinct circle centers. Selected natively on release; no initial selection. */
  points: readonly PhysicsVector[]
  stiffness?: number
  damping?: number
  /** Seconds of release-velocity projection for choosing a point, 0–.3; default .12. */
  projection?: number
}
export interface PhysicsSpringDrag {
  type: 'spring'
  /** Temporary pointer spring rest length in DIPs, 0–10000; default 0. */
  length?: number
  /** Spring force per DIP, 1–1000; default 180. */
  stiffness?: number
  /** Viscous damping, 0–120; default 24. */
  damping?: number
  /** Optional native tether, visible only during the gesture. */
  line?: { color: string; width?: number }
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
  attachment?: PhysicsAttachment
  snap?: PhysicsSnap
  /** Direct dragging by default. A spring drag keeps the body dynamic during contact. */
  drag?: 'direct' | PhysicsSpringDrag
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
    /** Temporary center target: pointer plus the initial center-to-contact offset, in local DIPs. */
    pointer: {
      anchor: PhysicsVector
      length: number
      stiffness: number
      damping: number
    } | null
    /** Last native release, before snap selection or subsequent integration. */
    release: { x: number; y: number; vx: number; vy: number } | null
    attachment: {
      anchor: PhysicsVector
      length: number
      stiffness: number
      damping: number
    } | null
    snap: { index: number; point: PhysicsVector; settled: boolean } | null
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
  /** Native tether drawing resources retained by this world. */
  guides: number
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
  /** Replace/remove the anchor spring without resetting velocity. Clears the selected snap. */
  attach(id: string, attachment: PhysicsAttachment | null): void
  /** Choose a configured snap point, including while paused. Ignored during an active drag. */
  snapTo(id: string, index: number): void
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
function point(
  value: PhysicsVector,
  name: string,
  width: number,
  height: number,
  inset = 0,
) {
  if (!value || typeof value !== 'object') throw new TypeError(`Expected ${name} point.`)
  return {
    x: number(value.x, `${name}.x`, inset, width - inset),
    y: number(value.y, `${name}.y`, inset, height - inset),
  }
}
function prepareAttachment(
  value: PhysicsAttachment | null,
  width: number,
  height: number,
) {
  if (value === null) return null
  if (!value || typeof value !== 'object')
    throw new TypeError('Expected attachment options or null.')
  const anchor = point(value.anchor, 'anchor', width, height)
  const stiffness = number(value.stiffness ?? 180, 'attachment.stiffness', 1, 1000)
  const damping = number(value.damping ?? 24, 'attachment.damping', 0, 120)
  const length = number(value.length ?? 0, 'attachment.length', 0, 10000)
  let line: { color: number; width: number } | null = null
  if (value.line !== undefined) {
    if (
      !value.line ||
      typeof value.line.color !== 'string' ||
      !/^#[0-9a-f]{6}$/i.test(value.line.color)
    )
      throw new TypeError('Attachment line color must be #RRGGBB.')
    line = {
      color: parseInt(value.line.color.slice(1), 16),
      width: number(value.line.width ?? 1.5, 'attachment.line.width', 0.5, 6),
    }
  }
  return { x: anchor.x, y: anchor.y, length, stiffness, damping, line }
}
function prepareSnap(
  value: PhysicsSnap | undefined,
  width: number,
  height: number,
  radius: number,
) {
  if (value === undefined) return null
  if (
    !value ||
    !Array.isArray(value.points) ||
    value.points.length < 1 ||
    value.points.length > 8
  )
    throw new RangeError('Snap needs 1–8 distinct points.')
  const points = Array.from(value.points, (p) =>
    point(p, 'snap point', width, height, radius),
  )
  if (new Set(points.map((p) => `${p.x},${p.y}`)).size !== points.length)
    throw new RangeError('Snap points must be distinct.')
  return {
    points,
    stiffness: number(value.stiffness ?? 180, 'snap.stiffness', 1, 1000),
    damping: number(value.damping ?? 24, 'snap.damping', 0, 120),
    projection: number(value.projection ?? 0.12, 'snap.projection', 0, 0.3),
  }
}
function prepareDrag(value: CircleBody['drag'], width: number, height: number) {
  if (value === undefined || value === 'direct') return null
  if (!value || typeof value !== 'object' || value.type !== 'spring')
    throw new TypeError('Expected direct dragging or a spring drag configuration.')
  // Share the validated spring ranges and line style; the pointer supplies the anchor natively.
  const {
    x: _x,
    y: _y,
    ...spring
  } = prepareAttachment({ ...value, anchor: { x: 0, y: 0 } }, width, height)!
  return spring
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
    return {
      x,
      y,
      radius,
      mass,
      vx: velocity.x,
      vy: velocity.y,
      attachment: prepareAttachment(body.attachment ?? null, width, height),
      snap: prepareSnap(body.snap, width, height, radius),
      drag: prepareDrag(body.drag, width, height),
    }
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
      attach(id, attachment) {
        const index = ids.indexOf(id)
        if (index < 0) throw new RangeError(`Unknown circle: ${id}`)
        if (ended) return
        const size = host!.getActualSize()
        number(size.width, 'Container width', 1, 10000)
        number(size.height, 'Container height', 1, 10000)
        if (
          config.some((b) => 2 * b.radius > Math.min(size.width, size.height)) ||
          config.reduce((a, b) => a + Math.PI * b.radius ** 2, 0) >
            size.width * size.height * 0.4
        )
          throw new RangeError(
            'Resize the container to fit its circles before updating an attachment.',
          )
        const prepared = prepareAttachment(attachment, size.width, size.height)
        update()
        if (!ended) native!.attach(index, prepared)
      },
      snapTo(id, index) {
        const body = ids.indexOf(id)
        if (body < 0) throw new RangeError(`Unknown circle: ${id}`)
        const count = config[body]!.snap?.points.length ?? 0
        if (!Number.isInteger(index) || index < 0 || index >= count)
          throw new RangeError('Unknown snap point.')
        if (!ended) native!.snapTo(body, index)
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
