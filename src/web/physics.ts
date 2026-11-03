import { CircleMath, CIRCLE_DT, limitCircle } from '../core/circle-math.js'
import {
  EffectStyles,
  effectOptions,
  effectOwnership,
  effectTarget,
  positioned,
} from './effect.js'
import {
  inputBlocked,
  inputChild,
  releasePointer,
  type WebInteraction,
} from './interaction.js'
import { assertDragSpace } from './drag.js'
import { identityTransform } from './geometry.js'
import { bounded } from './surface-effect.js'
import type { PlatformHost } from './platform-host.js'
import type { FrameTask } from './scheduler.js'

export interface WebPhysicsVector {
  x: number
  y: number
}
export interface WebPhysicsLine {
  color?: string
  width?: number
}
export interface WebPhysicsAttachment {
  anchor: WebPhysicsVector
  length?: number
  stiffness?: number
  damping?: number
  line?: WebPhysicsLine
}
export interface WebPhysicsSnap {
  points: readonly WebPhysicsVector[]
  stiffness?: number
  damping?: number
  projection?: number
}
export type WebPhysicsDrag =
  | 'direct'
  | {
      type: 'spring'
      length?: number
      stiffness?: number
      damping?: number
      line?: WebPhysicsLine
    }
export interface WebCircleBody {
  id: string
  view: HTMLElement
  radius: number
  x: number
  y: number
  mass?: number
  velocity?: WebPhysicsVector
  attachment?: WebPhysicsAttachment
  snap?: WebPhysicsSnap
  drag?: WebPhysicsDrag
}
export interface WebPhysicsSpring {
  id: string
  from: string
  to: string
  length: number
  stiffness?: number
  damping?: number
  line?: WebPhysicsLine
}
export interface WebPhysicsOptions {
  gravity?: WebPhysicsVector
  restitution?: number
  damping?: number
  reducedMotion?: 'pause' | 'continue'
  springs?: readonly WebPhysicsSpring[]
}
export interface WebPhysicsSnapshot {
  status: 'running' | 'sleeping' | 'paused' | 'invalid-bounds' | 'disposed'
  width: number
  height: number
  frames: number
  steps: number
  contacts: number
  droppedMs: number
  bodies: {
    id: string
    x: number
    y: number
    vx: number
    vy: number
    radius: number
    held: boolean
    snapIndex: number | null
    release: { x: number; y: number; vx: number; vy: number } | null
  }[]
}
export interface WebPhysicsWorld extends WebInteraction {
  reset(): void
  impulse(id: string, impulse: WebPhysicsVector): void
  attach(id: string, attachment: WebPhysicsAttachment | null): void
  spring(id: string, spring: Omit<WebPhysicsSpring, 'id'> | null): void
  snapTo(id: string, index: number): void
  snapshot(): WebPhysicsSnapshot
}
const vector = (value: WebPhysicsVector, name: string, max: number) => {
  effectOptions(value, ['x', 'y'])
  return {
    x: bounded(value.x, `${name}.x`, -max, max),
    y: bounded(value.y, `${name}.y`, -max, max),
  }
}
const springParams = (value: {
  length?: number
  stiffness?: number
  damping?: number
}) => ({
  length: bounded(value.length ?? 0, 'length', 0, 10000),
  stiffness: bounded(value.stiffness ?? 180, 'stiffness', 1, 1000),
  damping: bounded(value.damping ?? 24, 'damping', 0, 120),
})

export function createPhysicsWorld(
  container: HTMLElement,
  bodies: readonly WebCircleBody[],
  options: WebPhysicsOptions,
  host: PlatformHost,
): WebPhysicsWorld {
  const view = effectTarget(container, host)
  assertDragSpace(container, true)
  if (!identityTransform(container, view.getComputedStyle(container)))
    throw new TypeError('Physics requires an untransformed host.')
  effectOptions(options, [
    'gravity',
    'restitution',
    'damping',
    'reducedMotion',
    'springs',
  ])
  if (!Array.isArray(bodies) || bodies.length < 1 || bodies.length > 16)
    throw new RangeError('Physics needs 1–16 circular bodies.')
  if (
    options.reducedMotion !== undefined &&
    !['pause', 'continue'].includes(options.reducedMotion)
  )
    throw new TypeError('Unknown reduced motion policy.')
  const world = new CircleMath(bodies.length),
    ids = new Map<string, number>(),
    elements = new Set<HTMLElement>()
  world.width = bounded(container.clientWidth, 'host width', 1, 10000)
  world.height = bounded(container.clientHeight, 'host height', 1, 10000)
  const gravity = vector(options.gravity ?? { x: 0, y: 750 }, 'gravity', 2000)
  world.gx = gravity.x
  world.gy = gravity.y
  world.restitution = bounded(options.restitution ?? 0.65, 'restitution', 0, 1)
  world.damping = bounded(options.damping ?? 0.5, 'damping', 0, 20)
  const validateLine = (line: WebPhysicsLine | undefined) => {
    if (!line) return
    effectOptions(line, ['color', 'width'])
    bounded(line.width ?? 2, 'line width', 0.1, 20)
    if (
      line.color !== undefined &&
      (typeof line.color !== 'string' || !view.CSS.supports('color', line.color))
    )
      throw new TypeError('Invalid guide color.')
  }
  const attachment = (value: WebPhysicsAttachment) => {
    effectOptions(value, ['anchor', 'length', 'stiffness', 'damping', 'line'])
    validateLine(value.line)
    const anchor = vector(value.anchor, 'anchor', 10000)
    if (anchor.x < 0 || anchor.y < 0 || anchor.x > world.width || anchor.y > world.height)
      throw new RangeError('Attachment anchors must be inside the host.')
    return { anchor, ...springParams(value) }
  }
  const lines = new Map<
    string,
    { line: WebPhysicsLine; endpoints(): [number, number, number, number] }
  >()
  bodies.forEach((spec, i) => {
    effectOptions(spec, [
      'id',
      'view',
      'radius',
      'x',
      'y',
      'mass',
      'velocity',
      'attachment',
      'snap',
      'drag',
    ])
    effectTarget(spec.view, host)
    assertDragSpace(spec.view, true)
    if (!identityTransform(spec.view, view.getComputedStyle(spec.view)))
      throw new TypeError('Physics requires untransformed body wrappers.')
    if (
      typeof spec.id !== 'string' ||
      !spec.id.trim() ||
      ids.has(spec.id) ||
      elements.has(spec.view) ||
      spec.view.parentElement !== container
    )
      throw new TypeError('Bodies need distinct ids and direct child elements.')
    ids.set(spec.id, i)
    elements.add(spec.view)
    const b = world.bodies[i]!
    b.r = bounded(spec.radius, 'radius', 12, 256)
    b.m = bounded(spec.mass ?? 1, 'mass', 0.1, 100)
    b.x = bounded(spec.x, 'x', b.r, world.width - b.r)
    b.y = bounded(spec.y, 'y', b.r, world.height - b.r)
    const velocity = vector(spec.velocity ?? { x: 0, y: 0 }, 'velocity', 1200)
    if (Math.hypot(velocity.x, velocity.y) > 1200)
      throw new RangeError('Initial body speed exceeds 1200 CSS px/s.')
    b.vx = velocity.x
    b.vy = velocity.y
    if (
      Math.abs(spec.view.offsetWidth - 2 * b.r) > 1 ||
      Math.abs(spec.view.offsetHeight - 2 * b.r) > 1
    )
      throw new RangeError('Body elements must be square, with size twice their radius.')
    if (
      world.bodies
        .slice(0, i)
        .some((other) => Math.hypot(other.x - b.x, other.y - b.y) < other.r + b.r)
    )
      throw new RangeError('Initial bodies must not overlap.')
    if (spec.attachment && spec.snap)
      throw new TypeError('Choose attachment or snap points for each body.')
    if (spec.attachment) {
      const a = attachment(spec.attachment)
      world.attach(i, true, a.anchor.x, a.anchor.y, a.length, a.stiffness, a.damping)
      if (spec.attachment.line)
        lines.set(`a:${spec.id}`, {
          line: { ...spec.attachment.line },
          endpoints: () => [
            b.attachment.u * world.width,
            b.attachment.v * world.height,
            b.x,
            b.y,
          ],
        })
    }
    if (spec.snap) {
      effectOptions(spec.snap, ['points', 'stiffness', 'damping', 'projection'])
      if (
        !Array.isArray(spec.snap.points) ||
        !spec.snap.points.length ||
        spec.snap.points.length > 8
      )
        throw new RangeError('Use 1–8 snap points.')
      const keys = new Set<string>()
      for (const point of spec.snap.points) {
        const p = vector(point, 'snap point', 10000),
          key = `${p.x},${p.y}`
        if (
          p.x < b.r ||
          p.y < b.r ||
          p.x > world.width - b.r ||
          p.y > world.height - b.r ||
          keys.has(key)
        )
          throw new RangeError('Snap centers must be distinct and fit inside the host.')
        keys.add(key)
        b.snap.u.push(p.x / world.width)
        b.snap.v.push(p.y / world.height)
      }
      Object.assign(b.snap, springParams(spec.snap), {
        count: spec.snap.points.length,
        projection: bounded(spec.snap.projection ?? 0.12, 'projection', 0, 0.3),
      })
    }
    if (spec.drag !== undefined && spec.drag !== 'direct') {
      effectOptions(spec.drag, ['type', 'length', 'stiffness', 'damping', 'line'])
      if (spec.drag.type !== 'spring') throw new TypeError('Unknown physics drag mode.')
      validateLine(spec.drag.line)
      Object.assign(b.drag, springParams(spec.drag), { enabled: true })
      if (spec.drag.line)
        lines.set(`d:${spec.id}`, {
          line: { ...spec.drag.line },
          endpoints: () => (b.held ? [b.tx, b.ty, b.x, b.y] : [0, 0, 0, 0]),
        })
    }
  })
  if (!world.fits(world.width, world.height))
    throw new RangeError('Bodies exceed 40% of the host area or do not fit.')
  const index = (id: string) => {
    const i = ids.get(id)
    if (i === undefined) throw new RangeError('Unknown physics body.')
    return i
  }
  const springs = new Map<string, number>()
  const setSpring = (id: string, spec: Omit<WebPhysicsSpring, 'id'> | null) => {
    if (typeof id !== 'string' || !id.trim())
      throw new TypeError('Spring id must be nonempty.')
    const old = springs.get(id)
    if (spec === null) {
      if (old !== undefined) world.springs[old]!.enabled = false
      springs.delete(id)
      lines.delete(`s:${id}`)
      world.wake()
      return
    }
    effectOptions(spec, ['from', 'to', 'length', 'stiffness', 'damping', 'line'])
    validateLine(spec.line)
    const a = index(spec.from),
      b = index(spec.to),
      config = springParams(spec)
    if (a === b || world.bodies[a]!.snap.count || world.bodies[b]!.snap.count)
      throw new TypeError('A spring connects distinct bodies without snap points.')
    for (const endpoint of [a, b])
      if (
        world.springs.filter(
          (s, i) => i !== old && s.enabled && (s.a === endpoint || s.b === endpoint),
        ).length >= 4
      )
        throw new RangeError('At most four springs may meet a body.')
    const slot = old ?? world.springs.findIndex((s) => !s.enabled)
    if (slot < 0) throw new RangeError('At most 32 body springs are supported.')
    Object.assign(world.springs[slot]!, config, { a, b, enabled: true })
    springs.set(id, slot)
    lines.delete(`s:${id}`)
    if (spec.line)
      lines.set(`s:${id}`, {
        line: { ...spec.line },
        endpoints: () => [
          world.bodies[a]!.x,
          world.bodies[a]!.y,
          world.bodies[b]!.x,
          world.bodies[b]!.y,
        ],
      })
    world.wake()
  }
  if (options.springs !== undefined && !Array.isArray(options.springs))
    throw new TypeError('Expected springs array.')
  for (const spec of options.springs ?? []) {
    if (springs.has(spec.id)) throw new TypeError('Duplicate spring id.')
    const { id, ...rest } = spec
    setSpring(id, rest)
  }
  const initial = world.bodies.map((b) => ({
    u: b.x / world.width,
    v: b.y / world.height,
    vx: b.vx,
    vy: b.vy,
  }))
  let ended = false,
    held = false,
    invalid = false,
    frames = 0,
    droppedMs = 0,
    accumulator = 0,
    last = host.scheduler.now()
  const off: (() => void)[] = [],
    styles: EffectStyles[] = [],
    bindings: ReturnType<PlatformHost['bindLayer']>[] = []
  const values: {
    x: ReturnType<PlatformHost['motionValue']>
    y: ReturnType<PlatformHost['motionValue']>
  }[] = []
  const pointers = new Map<
    number,
    {
      i: number
      x: number
      y: number
      time: number
      vx: number
      vy: number
      dx: number
      dy: number
    }
  >()
  let svg: SVGSVGElement | undefined
  const guideElements = new Map<string, SVGLineElement>()
  const blocked = () =>
    held ||
    invalid ||
    (host.reduced() && options.reducedMotion !== 'continue') ||
    host.document.hidden
  const cancelPointers = () => {
    for (const [id, p] of pointers) {
      world.cancel(p.i)
      releasePointer(bodies[p.i]!.view, id)
    }
    pointers.clear()
  }
  const sync = () => {
    host.scheduler.remove(task)
    last = host.scheduler.now()
    accumulator = 0
    if (!ended && !blocked() && !world.sleeping) host.scheduler.add(task)
  }
  const paint = () => {
    for (let i = 0; i < world.bodies.length; i++) {
      const b = world.bodies[i]!
      values[i]?.x.set(b.x - b.r)
      values[i]?.y.set(b.y - b.r)
    }
    if (!svg) return
    for (const [key, element] of guideElements)
      if (!lines.has(key)) {
        element.remove()
        guideElements.delete(key)
      }
    for (const [key, guide] of lines) {
      let element = guideElements.get(key)
      if (!element) {
        element = host.document.createElementNS('http://www.w3.org/2000/svg', 'line')
        svg.append(element)
        guideElements.set(key, element)
      }
      const coords = guide.endpoints()
      ;(['x1', 'y1', 'x2', 'y2'] as const).forEach((name, i) =>
        element!.setAttribute(name, String(coords[i])),
      )
      element.setAttribute('stroke', guide.line.color ?? '#64748b')
      element.setAttribute('stroke-width', String(guide.line.width ?? 2))
    }
  }
  const refresh = () => {
    if (ended) return
    if (
      !container.isConnected ||
      bodies.some(
        (b, i) =>
          b.view.parentElement !== container ||
          !bindings[i]?.owns() ||
          !styles[i]?.owns(),
      )
    ) {
      dispose()
      return
    }
    try {
      assertDragSpace(container, true)
    } catch {
      dispose()
      return
    }
    const w = container.clientWidth,
      h = container.clientHeight
    invalid = !world.fits(w, h) || w > 10000 || h > 10000
    if (invalid || blocked()) cancelPointers()
    if (!invalid && (w !== world.width || h !== world.height)) {
      cancelPointers()
      world.resize(w, h)
      paint()
    }
    sync()
  }
  const task: FrameTask = {
    update(time) {
      if (ended || blocked()) return false
      frames++
      const elapsed = Math.max(0, time - last) / 1000
      last = time
      const accepted = Math.min(0.1, elapsed)
      droppedMs += (elapsed - accepted) * 1000
      accumulator += accepted
      let steps = 0
      while (accumulator + 1e-12 >= CIRCLE_DT && steps++ < 24) {
        world.step()
        accumulator -= CIRCLE_DT
      }
      return !world.sleeping
    },
    write: paint,
  }
  function dispose() {
    if (ended) return
    ended = true
    cancelPointers()
    host.scheduler.remove(task)
    for (const cleanup of off.splice(0).reverse()) cleanup()
    for (const binding of bindings) binding.dispose()
    for (const pair of values) {
      pair.x.dispose()
      pair.y.dispose()
    }
    for (const style of styles) style.restore()
    svg?.remove()
    guideElements.clear()
    lines.clear()
  }
  const control: WebPhysicsWorld = {
    get disposed() {
      return ended
    },
    get paused() {
      return held
    },
    pause() {
      if (!ended) {
        held = true
        cancelPointers()
        sync()
      }
    },
    play() {
      if (!ended) {
        held = false
        refresh()
      }
    },
    cancel() {
      if (!ended) {
        cancelPointers()
        sync()
      }
    },
    dispose,
    reset() {
      if (ended) return
      cancelPointers()
      world.bodies.forEach((b, i) => {
        const p = initial[i]!
        b.x = p.u * world.width
        b.y = p.v * world.height
        b.vx = p.vx
        b.vy = p.vy
        b.snap.active = false
        b.released = false
      })
      world.solveContacts(false, 64)
      world.wake()
      paint()
      sync()
    },
    impulse(id, value) {
      if (ended) return
      const b = world.bodies[index(id)]!,
        v = vector(value, 'impulse', 120000)
      b.vx += v.x / b.m
      b.vy += v.y / b.m
      limitCircle(b)
      world.wake()
      sync()
    },
    attach(id, value) {
      if (ended) return
      const i = index(id),
        b = world.bodies[i]!
      if (value && b.snap.count)
        throw new TypeError('A snap body cannot also have an attachment.')
      const a = value
        ? attachment(value)
        : { anchor: { x: 0, y: 0 }, length: 0, stiffness: 180, damping: 24 }
      world.attach(i, !!value, a.anchor.x, a.anchor.y, a.length, a.stiffness, a.damping)
      lines.delete(`a:${id}`)
      if (value?.line)
        lines.set(`a:${id}`, {
          line: { ...value.line },
          endpoints: () => [
            b.attachment.u * world.width,
            b.attachment.v * world.height,
            b.x,
            b.y,
          ],
        })
      paint()
      sync()
    },
    spring(id, value) {
      if (!ended) {
        setSpring(id, value)
        paint()
        sync()
      }
    },
    snapTo(id, target) {
      if (ended) return
      const i = index(id)
      if (
        !Number.isInteger(target) ||
        target < 0 ||
        target >= world.bodies[i]!.snap.count
      )
        throw new RangeError('Unknown snap index.')
      world.snapTo(i, target)
      sync()
    },
    snapshot() {
      return {
        status: ended
          ? 'disposed'
          : invalid
            ? 'invalid-bounds'
            : blocked()
              ? 'paused'
              : world.sleeping
                ? 'sleeping'
                : 'running',
        width: world.width,
        height: world.height,
        frames,
        steps: world.steps,
        contacts: world.contacts,
        droppedMs,
        bodies: world.bodies.map((b, i) => ({
          id: bodies[i]!.id,
          x: b.x,
          y: b.y,
          vx: b.vx,
          vy: b.vy,
          radius: b.r,
          held: b.held,
          snapIndex: b.snap.active ? b.snap.index : null,
          release: b.released
            ? { x: b.releaseX, y: b.releaseY, vx: b.releaseVX, vy: b.releaseVY }
            : null,
        })),
      }
    },
  }
  try {
    off.push(effectOwnership(container, 'physics', host, dispose), positioned(container))
    svg = host.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible'
    container.prepend(svg)
    const abort = new view.AbortController()
    off.push(() => abort.abort())
    const position = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect(),
        sx = rect.width / container.offsetWidth,
        sy = rect.height / container.offsetHeight
      return {
        x: (event.clientX - rect.left) / (sx || 1) - container.clientLeft,
        y: (event.clientY - rect.top) / (sy || 1) - container.clientTop,
      }
    }
    bodies.forEach((spec, i) => {
      off.push(effectOwnership(spec.view, 'physics-body', host, dispose))
      const style = new EffectStyles(spec.view)
      styles.push(style)
      for (const [name, value] of Object.entries({
        position: 'absolute',
        left: '0px',
        top: '0px',
        margin: '0px',
        'touch-action': 'none',
        'user-select': 'none',
      }))
        style.set(name, value)
      const b = world.bodies[i]!,
        x = host.motionValue(b.x - b.r),
        y = host.motionValue(b.y - b.r)
      values.push({ x, y })
      bindings.push(host.bindLayer(spec.view, { x, y }, host.layer('physics')))
      spec.view.addEventListener(
        'pointerdown',
        (event: PointerEvent) => {
          if (
            ended ||
            blocked() ||
            event.button !== 0 ||
            event.defaultPrevented ||
            inputChild(event, spec.view) ||
            inputBlocked(spec.view) ||
            [...pointers.values()].some((p) => p.i === i)
          )
            return
          const p = position(event)
          pointers.set(event.pointerId, {
            i,
            ...p,
            time: event.timeStamp,
            vx: 0,
            vy: 0,
            dx: b.x - p.x,
            dy: b.y - p.y,
          })
          world.drag(i, b.x, b.y)
          try {
            spec.view.setPointerCapture(event.pointerId)
          } catch {
            pointers.delete(event.pointerId)
            world.cancel(i)
            return
          }
          event.preventDefault()
          sync()
        },
        { signal: abort.signal },
      )
      spec.view.addEventListener(
        'lostpointercapture',
        (event: PointerEvent) => {
          const p = pointers.get(event.pointerId)
          if (p) {
            pointers.delete(event.pointerId)
            world.cancel(p.i)
            sync()
          }
        },
        { signal: abort.signal },
      )
    })
    view.addEventListener(
      'pointermove',
      (event: PointerEvent) => {
        const p = pointers.get(event.pointerId)
        if (!p) return
        if (event.pointerType === 'mouse' && !(event.buttons & 1)) {
          cancelPointers()
          sync()
          return
        }
        const next = position(event),
          dt = (event.timeStamp - p.time) / 1000
        if (dt > 0) {
          p.vx = (next.x - p.x) / dt
          p.vy = (next.y - p.y) / dt
        }
        p.x = next.x
        p.y = next.y
        p.time = event.timeStamp
        world.drag(p.i, next.x + p.dx, next.y + p.dy)
        if (!blocked()) host.scheduler.add(task)
      },
      { signal: abort.signal },
    )
    const release = (event: PointerEvent) => {
      const p = pointers.get(event.pointerId)
      if (!p) return
      pointers.delete(event.pointerId)
      if (event.type === 'pointercancel') world.cancel(p.i)
      else
        world.release(
          p.i,
          event.timeStamp - p.time > 100 ? 0 : p.vx,
          event.timeStamp - p.time > 100 ? 0 : p.vy,
        )
      releasePointer(bodies[p.i]!.view, event.pointerId)
      sync()
    }
    view.addEventListener('pointerup', release, { signal: abort.signal })
    view.addEventListener('pointercancel', release, { signal: abort.signal })
    view.addEventListener(
      'blur',
      () => {
        cancelPointers()
        sync()
      },
      { signal: abort.signal },
    )
    const observer = new view.ResizeObserver(refresh)
    observer.observe(container)
    off.push(
      () => observer.disconnect(),
      host.register(container, control, refresh),
      host.onReduced(refresh),
      host.visibility(refresh),
    )
    paint()
    refresh()
    return control
  } catch (error) {
    dispose()
    throw error
  }
}
