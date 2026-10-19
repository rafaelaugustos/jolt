import { Application, type View } from '@nativescript/core'
import { prepareAnimation, toView } from './animate.js'
import { getDriver, type LayoutFrame } from './driver/index.js'
import {
  captureValue,
  propertyRevision,
  arrivalOf,
  setArrival,
  type Animation,
} from './engine.js'
import { interactionSurface } from './interaction-surface.js'
import { readValue, writeValue, type NumericProperty } from './properties.js'
import { springs, type Spring, type Tween, type SpringName } from './transition.js'
import type { Keyframes, Target } from './types.js'

export type LayoutOptions = (
  Omit<Spring, 'repeat' | 'repeatType'> | Omit<Tween, 'repeat' | 'repeatType'>
) & {
  /** Scale from the previous size (including content); false snaps size and only moves. Default: 'scale'. */
  size?: 'scale' | false
  /** Fade new children from zero to their configured opacity. Default: true. */
  enter?: boolean
}

type Geometry = 'x' | 'y' | 'scaleX' | 'scaleY'
interface Snapshot {
  frame: LayoutFrame
  originX: number
  originY: number
  rotate: number
  rotateX: number
  rotateY: number
  values: Record<Geometry, () => number | undefined>
}
interface Owned {
  view: View
  handle: Animation
  detach(): void
  targets: { property: NumericProperty; value: number; token: symbol | undefined }[]
}
const pending = new WeakMap<View, Animation>()
const playing = new WeakMap<View, Set<Animation>>()
const properties = ['x', 'y', 'scaleX', 'scaleY'] as const

/** Animate the next layout of a container's direct children. Call before a synchronous mutation. */
export function animateLayout(
  container: Target,
  options?: LayoutOptions | SpringName,
): Animation
export function animateLayout(
  container: Target,
  change: () => void,
  options?: LayoutOptions | SpringName,
): Animation
export function animateLayout(
  container: Target,
  changeOrOptions?: (() => void) | LayoutOptions | SpringName,
  options?: LayoutOptions | SpringName,
): Animation {
  const host = toView(container)
  const change = typeof changeOrOptions === 'function' ? changeOrOptions : undefined
  const input = change ? options : changeOrOptions
  const {
    size = 'scale',
    enter = true,
    ...transition
  } = normalize(input as LayoutOptions | SpringName | undefined)
  // Validate the complete transition before changing children or cancelling an earlier request.
  prepareAnimation(
    host,
    { x: [0, 1], y: [0, 1], scaleX: [1, 2], scaleY: [1, 2], opacity: [0, 1] },
    transition,
  )
  const driver = getDriver()
  const before = new Map<View, Snapshot>()
  const ready = laidOut(host)
  if (ready)
    for (const child of childrenOf(host)) {
      const frame = frameOf(child)
      if (frame)
        before.set(child, {
          frame,
          originX: child.originX,
          originY: child.originY,
          rotate: child.rotate,
          rotateX: child.rotateX,
          rotateY: child.rotateY,
          values: {
            x: captureValue(child, 'x'),
            y: captureValue(child, 'y'),
            scaleX: captureValue(child, 'scaleX'),
            scaleY: captureValue(child, 'scaleY'),
          },
        })
    }

  let resolve!: (finished: boolean) => void
  let reject!: (error: unknown) => void
  const finished = new Promise<boolean>((done, fail) => {
    resolve = done
    reject = fail
  })
  let arrive!: () => void
  const arrival = new Promise<void>((done) => (arrive = done))
  const owned: Owned[] = []
  let settled = false
  let detach: (() => void) | undefined
  const cleanup = () => {
    detach?.()
    detach = undefined
    host.off('unloaded', stop)
    Application.off(Application.suspendEvent, stop)
    if (pending.get(host) === handle) pending.delete(host)
    const active = playing.get(host)
    active?.delete(handle)
    if (!active?.size) playing.delete(host)
    before.clear()
    owned.forEach((child) => child.detach())
    arrive()
  }
  const complete = (result: boolean, error?: unknown) => {
    if (settled) return
    settled = true
    cleanup()
    if (error !== undefined) reject(error)
    else resolve(result)
  }
  // A cancelled FLIP settles into the real layout rather than leaving a temporary inverse offset.
  // The engine marker protects any animation that took ownership after this operation.
  const restoreOne = ({ view, handle: child, targets }: Owned) => {
    const current = targets.filter(
      (target) => propertyRevision(view, target.property) === target.token,
    )
    child.stop()
    for (const target of current)
      if (propertyRevision(view, target.property) === target.token)
        writeValue(view, target.property, target.value)
    if (current.length) driver.sync?.(view)
  }
  const restore = () => {
    owned.forEach(restoreOne)
  }
  function stop() {
    if (settled) return
    restore()
    complete(false)
  }
  const handle: Animation = {
    finished,
    stop,
    then: (onfulfilled, onrejected) => finished.then(onfulfilled, onrejected),
  }
  setArrival(handle, arrival)
  const run = () => {
    if (settled) return
    detach?.()
    detach = undefined
    if (!laidOut(host)) {
      stop()
      return
    }
    if (pending.get(host) === handle) pending.delete(host)
    const previous = [...(playing.get(host) ?? [])]
    try {
      const prepared: { view: View; frames: Keyframes; start: () => Animation }[] = []
      for (const child of childrenOf(host)) {
        const now = frameOf(child)
        if (!now) continue
        const was = before.get(child)
        const frames = was
          ? inverse(child, was, now, size)
          : enter
            ? { opacity: [0, child.opacity] }
            : undefined
        if (frames && Object.keys(frames).length)
          prepared.push({
            view: child,
            frames,
            start: prepareAnimation(child, frames, transition),
          })
      }
      before.clear()
      // Selection lasts only for starting these tracks; their native geometry driver stays until completion.
      for (const { view, frames, start } of prepared) {
        const surface = interactionSurface(view)
        try {
          const child = start()
          const targets = Object.entries(frames).map(([property, frames]) => ({
            property: property as NumericProperty,
            value: (frames as number[]).at(-1)!,
            token: propertyRevision(view, property as NumericProperty),
          }))
          const item: Owned = {
            view,
            handle: child,
            targets,
            detach: () => view.off('unloaded', unloaded),
          }
          const unloaded = () => {
            item.detach()
            if (!settled) restoreOne(item)
          }
          // Keyed reorder may unload/reinsert the same native view. Do not persist its FLIP offset.
          view.on('unloaded', unloaded)
          owned.push(item)
        } finally {
          surface.dispose()
        }
      }
      const active = playing.get(host) ?? new Set<Animation>()
      active.add(handle)
      playing.set(host, active)
      // Replacements start before old handles stop so the engine can transfer velocity.
      for (const old of previous) old.stop()
      void Promise.all(owned.map(({ handle }) => arrivalOf(handle))).then(arrive)
      void Promise.all(owned.map(({ handle }) => handle.finished)).then(
        (results) => complete(results.every(Boolean)),
        (error) => {
          restore()
          complete(false, error)
        },
      )
    } catch (error) {
      restore()
      complete(false, error)
    }
  }

  pending.get(host)?.stop()
  pending.set(host, handle)
  host.on('unloaded', stop)
  Application.on(Application.suspendEvent, stop)
  try {
    const result = change?.() as unknown
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(result).catch(() => {})
      throw new TypeError(
        'Layout mutations must be synchronous. Call animateLayout after awaited work.',
      )
    }
    if (!settled) {
      if (!ready || !laidOut(host)) complete(true)
      else {
        if (!driver.afterLayout || !driver.layoutFrame)
          throw new Error('The animation driver does not support layout changes.')
        detach = driver.afterLayout(host, run)
        // Always request a pass, including a no-op mutation: no arbitrary timer or hanging wait.
        host.requestLayout()
      }
    }
  } catch (error) {
    stop()
    throw error
  }
  return handle
}

function normalize(input: LayoutOptions | SpringName | undefined): LayoutOptions {
  if (typeof input === 'string') {
    if (!Object.hasOwn(springs, input))
      throw new TypeError(`Unknown layout spring "${input}".`)
    return normalize({ ...springs[input] })
  }
  if (input === undefined) return {}
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new TypeError('Invalid layout options.')
  const allowed = new Set([
    'type',
    'duration',
    'ease',
    'times',
    'stiffness',
    'damping',
    'mass',
    'bounce',
    'velocity',
    'delay',
    'size',
    'enter',
  ])
  for (const key of Object.keys(input))
    if (!allowed.has(key)) throw new TypeError(`Unsupported layout option "${key}".`)
  if (input.size !== undefined && input.size !== false && input.size !== 'scale')
    throw new TypeError('Layout size must be "scale" or false.')
  if (input.enter !== undefined && typeof input.enter !== 'boolean')
    throw new TypeError('Layout enter must be boolean.')
  if (input.type !== undefined && input.type !== 'spring' && input.type !== 'tween')
    throw new TypeError('Layout type must be "spring" or "tween".')
  const numbers = input as Record<string, unknown>
  for (const key of [
    'duration',
    'delay',
    'stiffness',
    'damping',
    'mass',
    'bounce',
    'velocity',
  ]) {
    const value = numbers[key]
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value)))
      throw new RangeError(`Layout ${key} must be finite.`)
    if (typeof value === 'number') {
      if (['duration', 'delay', 'damping'].includes(key) && value < 0)
        throw new RangeError(`Layout ${key} must be nonnegative.`)
      if (['stiffness', 'mass'].includes(key) && value <= 0)
        throw new RangeError(`Layout ${key} must be positive.`)
      if (key === 'bounce' && (value < -1 || value > 1))
        throw new RangeError('Layout bounce must be between -1 and 1.')
    }
  }
  const physical = ['stiffness', 'damping', 'mass'].some(
    (key) => numbers[key] !== undefined,
  )
  const spring =
    input.type === 'spring' ||
    (input.type !== 'tween' &&
      ['bounce', 'velocity', 'stiffness', 'damping', 'mass'].some(
        (key) => numbers[key] !== undefined,
      ))
  if (spring && !physical && input.duration === 0)
    throw new RangeError(
      'A duration-based layout spring must have positive duration; use a zero-duration tween to settle immediately.',
    )
  const result = { ...input }
  if ('ease' in result && Array.isArray(result.ease)) result.ease = [...result.ease]
  if ('times' in result && result.times) result.times = [...result.times]
  return result
}

function inverse(
  view: View,
  was: Snapshot,
  now: LayoutFrame,
  size: LayoutOptions['size'],
): Keyframes | undefined {
  // Origin/rotation changes require a different affine transform, not a translation/scale FLIP.
  if (
    view.originX !== was.originX ||
    view.originY !== was.originY ||
    view.rotate !== was.rotate ||
    was.rotateX ||
    was.rotateY ||
    view.rotateX ||
    view.rotateY
  )
    return undefined
  const frames: Keyframes = {}
  const width = was.frame.width - now.width,
    height = was.frame.height - now.height
  const resized = Math.abs(width) > 0.25 || Math.abs(height) > 0.25
  for (const property of properties) {
    const current = was.values[property]()
    if (current === undefined) continue // A newer explicit animation owns this property.
    let start: number
    if (property === 'x')
      start =
        was.frame.x -
        now.x +
        current +
        (size === 'scale' && resized ? width * was.originX : 0)
    else if (property === 'y')
      start =
        was.frame.y -
        now.y +
        current +
        (size === 'scale' && resized ? height * was.originY : 0)
    else {
      if (size !== 'scale') continue
      start =
        current *
        (property === 'scaleX'
          ? was.frame.width / now.width
          : was.frame.height / now.height)
    }
    const end = readValue(view, property)
    if (Math.abs(start - end) > (property.startsWith('scale') ? 0.0001 : 0.25))
      frames[property] = [start, end]
  }
  return frames
}
function laidOut(view: View): boolean {
  if (!view.isLoaded || !view.nativeViewProtected) return false
  for (
    let current: View | undefined = view;
    current;
    current = current.parent as View | undefined
  )
    if (current.isCollapsed) return false
  return true
}
function frameOf(view: View): LayoutFrame | undefined {
  if (!laidOut(view)) return undefined
  const frame = getDriver().layoutFrame?.(view)
  return frame &&
    Object.values(frame).every(Number.isFinite) &&
    frame.width > 0 &&
    frame.height > 0
    ? frame
    : undefined
}
function childrenOf(host: View): View[] {
  const children: View[] = []
  host.eachChildView((child) => {
    children.push(child)
    return true
  })
  return children
}
