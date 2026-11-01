import {
  createOwnership,
  createTrack,
  resolveTransition,
  type Track,
  type Transition,
} from '../../src/core/index.js'
import { sampleCurve } from '../../src/core/sampling.js'

// An internal experiment, not the public Web runtime or a framework adapter.
export type Property = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotate'
type Pose = Record<Property, number>
const properties: Property[] = ['x', 'y', 'rotate', 'scaleX', 'scaleY']
const identity = (property: Property) => (property.startsWith('scale') ? 1 : 0)
const tolerances: Pose = {
  x: 0.05,
  y: 0.05,
  scaleX: 0.0002,
  scaleY: 0.0002,
  rotate: 0.02,
}
const managed = new WeakMap<HTMLElement, Surface>()

interface Slot {
  key: string
  property: Property
  layer: string
  track: Track
  clock: Animation
  token: symbol
  settled: boolean
  terminalTime?: number
  resolve(finished: boolean): void
}

export interface Handle {
  readonly finished: Promise<boolean>
  pause(): void
  play(): void
  seek(milliseconds: number): void
  stop(): void
  read(): {
    time: number
    position: number
    velocity: number
    paused: boolean
    duration: number
  }
  /** Test fault injection: deliver a previously retained completion callback. */
  deliverLateCompletion(): void
}

export class Surface {
  private readonly ownership = createOwnership<HTMLElement, string>()
  private readonly slots = new Map<string, Slot>()
  private readonly rest = new Map<string, { property: Property; value: number }>()
  private readonly originalTransform: string
  private readonly originalPriority: string
  private readonly originalClass: string
  private readonly baseline: string
  private readonly origin: string
  private written: string
  private effect?: Animation
  private generation = 0
  private disposed = false
  readonly diagnostics = {
    rebuilds: 0,
    keyframes: 0,
    sampledProperties: 0,
    fallback: false,
  }

  constructor(readonly target: HTMLElement) {
    if (!target.isConnected) throw new Error('The declared surface must be mounted.')
    if (managed.has(target)) throw new Error('This surface already has an owner.')
    const css = getComputedStyle(target)
    if ([css.translate, css.rotate, css.scale].some((value) => value !== 'none'))
      throw new Error(
        'The proof requires individual CSS transform properties to be none.',
      )
    if (
      target.getAnimations().length ||
      css.transitionDuration.split(',').some((s) => parseFloat(s) > 0)
    )
      throw new Error('Existing animations/transitions are outside this proof policy.')
    const matrix = new DOMMatrix(css.transform === 'none' ? undefined : css.transform)
    if (!matrix.is2D) throw new Error('Only a static 2D CSS baseline is supported.')
    if (css.display === 'inline' || css.display === 'none')
      throw new Error('The proof requires a visible transformable box.')
    this.baseline = matrix.toString()
    this.origin = css.transformOrigin
    this.originalClass = target.className
    this.originalTransform = target.style.getPropertyValue('transform')
    this.originalPriority = target.style.getPropertyPriority('transform')
    if (this.originalPriority) throw new Error('Important transforms are not supported.')
    this.written = this.originalTransform
    managed.set(target, this)
  }

  private assertAvailable() {
    if (this.disposed || !this.target.isConnected)
      throw new Error('Surface is unavailable.')
    const css = getComputedStyle(this.target)
    if (
      this.target.style.getPropertyValue('transform') !== this.written ||
      this.target.style.getPropertyPriority('transform') ||
      this.target.className !== this.originalClass ||
      css.transformOrigin !== this.origin ||
      [css.translate, css.rotate, css.scale].some((value) => value !== 'none')
    )
      throw new Error(
        'External style changes require disposing and recreating the surface.',
      )
  }

  private now() {
    const value = this.target.ownerDocument.timeline.currentTime
    if (typeof value !== 'number') throw new Error('The document timeline is not ready.')
    return value
  }

  private time(slot: Slot) {
    const time = slot.clock.currentTime
    if (typeof time !== 'number') throw new Error('The logical clock is unresolved.')
    return time
  }

  private owns(slot: Slot) {
    return (
      !this.disposed &&
      !slot.settled &&
      this.ownership.get(this.target, slot.key) === slot.token &&
      this.slots.get(slot.key) === slot
    )
  }

  private settle(slot: Slot, completed: boolean) {
    if (slot.settled) return
    slot.terminalTime = this.time(slot)
    slot.settled = true
    slot.clock.cancel()
    slot.resolve(completed)
  }

  animate(
    property: Property,
    to: number,
    transition: Transition = { type: 'spring', duration: 600, bounce: 0.2 },
    layer = 'base',
  ): Handle {
    this.assertAvailable()
    if (
      !properties.includes(property) ||
      !Number.isFinite(to) ||
      !['base', 'press'].includes(layer)
    )
      throw new Error('Invalid proof channel/value/layer.')
    const now = this.now()
    const key = `${layer}:${property}`
    const previous = this.slots.get(key)
    const from = previous
      ? previous.track.valueAt(this.time(previous))
      : (this.rest.get(key)?.value ?? identity(property))
    const velocity =
      previous && previous.clock.playState !== 'paused'
        ? previous.track.velocityAt(this.time(previous))
        : 0
    const track = createTrack(
      property,
      [from, to],
      resolveTransition(transition, property, 2),
      velocity,
      { timeScale: 1, reducedMotion: false },
    )
    if (
      !Number.isFinite(track.end) ||
      track.end <= 0 ||
      track.end > 15000 ||
      track.repeat !== 0
    )
      throw new Error(
        'This bounded proof supports finite, positive tracks up to 15 seconds without repeats.',
      )
    if (previous) this.settle(previous, false)
    this.rest.delete(key)
    let resolve!: (finished: boolean) => void
    const finished = new Promise<boolean>((done) => {
      resolve = done
    })
    // A real browser clock with no rendered target. Logical clocks survive visual regrouping.
    const clock = new Animation(
      new KeyframeEffect(null, [], { duration: track.end, fill: 'both' }),
      this.target.ownerDocument.timeline,
    )
    clock.play()
    clock.startTime = now
    const slot: Slot = {
      key,
      property,
      layer,
      track,
      clock,
      token: this.ownership.claim(this.target, key),
      settled: false,
      resolve,
    }
    this.slots.set(key, slot)
    const complete = () => {
      if (!this.owns(slot)) return
      try {
        this.assertAvailable()
      } catch {
        this.dispose()
        return
      }
      this.rest.set(key, { property, value: track.to })
      this.slots.delete(key)
      this.settle(slot, true)
      this.rebuild()
    }
    void clock.finished.then(complete, () => {})
    this.rebuild()
    const control = (operation: () => void) => {
      if (!this.owns(slot)) return
      this.assertAvailable()
      operation()
      this.rebuild()
    }
    return {
      finished,
      pause: () =>
        control(() => {
          const time = this.time(slot)
          clock.pause()
          clock.currentTime = time
        }),
      play: () =>
        control(() => {
          const time = this.time(slot)
          clock.play()
          clock.startTime = this.now() - time
        }),
      seek: (ms) =>
        control(() => {
          if (!Number.isFinite(ms) || ms < 0 || ms >= track.end)
            throw new RangeError('Seek must be inside the finite track.')
          clock.currentTime = ms
        }),
      stop: () =>
        control(() => {
          this.rest.set(key, { property, value: track.valueAt(this.time(slot)) })
          this.slots.delete(key)
          this.ownership.invalidate(this.target, [key])
          this.settle(slot, false)
        }),
      read: () => {
        const time = slot.terminalTime ?? this.time(slot)
        return {
          time,
          position: track.valueAt(time),
          velocity:
            slot.settled || clock.playState === 'paused' ? 0 : track.velocityAt(time),
          paused: clock.playState === 'paused',
          duration: track.end,
        }
      },
      deliverLateCompletion: complete,
    }
  }

  private snapshot() {
    return [...this.slots.values()].map((slot) => ({
      slot,
      time: this.time(slot),
      paused: slot.clock.playState === 'paused',
    }))
  }

  private sampledAt(track: Track, time: number) {
    if (time <= track.delay) return track.values[0]!
    if (time >= track.end) return track.to
    const offset = (time - track.delay) / track.duration
    let left = 0,
      right = track.times.length - 1
    while (right - left > 1) {
      const mid = (left + right) >>> 1
      if (track.times[mid]! <= offset) left = mid
      else right = mid
    }
    const fraction =
      (offset - track.times[left]!) / (track.times[right]! - track.times[left]!)
    return track.values[left]! + (track.values[right]! - track.values[left]!) * fraction
  }

  private pose(
    entries: ReturnType<Surface['snapshot']>,
    future = 0,
    sampled = true,
  ): Pose {
    const pose: Pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 }
    const combine = (property: Property, value: number) => {
      if (property.startsWith('scale')) pose[property] *= value
      else pose[property] += value
    }
    for (const { property, value } of this.rest.values()) combine(property, value)
    for (const { slot, time, paused } of entries) {
      const local = time + (paused ? 0 : future)
      // Compose the renderer's piecewise-linear tracks, including their final
      // settlement bridge. The source curve remains the interruption/velocity model.
      combine(
        slot.property,
        sampled ? this.sampledAt(slot.track, local) : slot.track.valueAt(local),
      )
    }
    return pose
  }

  private transform(pose: Pose) {
    return `${this.baseline} translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotate}deg) scale(${pose.scaleX}, ${pose.scaleY})`
  }

  private write(pose: Pose) {
    this.target.style.transform = this.transform(pose)
    this.written = this.target.style.getPropertyValue('transform')
  }

  private rebuild() {
    if (this.disposed) return
    const entries = this.snapshot()
    const duration = Math.max(
      0,
      ...entries.filter((e) => !e.paused).map(({ slot, time }) => slot.track.end - time),
    )
    const now = this.now()
    const previous = this.effect
    const generation = ++this.generation
    this.diagnostics.rebuilds++
    const breaks = entries.flatMap(({ slot, time, paused }) =>
      paused
        ? []
        : [
            slot.track.delay - time,
            slot.track.end - time,
            ...slot.track.times.map(
              (p) => slot.track.delay + p * slot.track.duration - time,
            ),
          ],
    )
    const offsets = new Set([0, 1])
    this.diagnostics.fallback = false
    if (duration > 0) {
      for (const property of properties) {
        const samples = sampleCurve({
          duration,
          position: (t) => this.pose(entries, t)[property],
          tolerance: tolerances[property],
          breakpoints: breaks,
          custom: true,
        })
        this.diagnostics.sampledProperties++
        this.diagnostics.fallback ||= samples.sampling.method !== 'adaptive'
        for (const offset of samples.times) offsets.add(offset)
      }
      if (this.diagnostics.fallback || offsets.size > 6001)
        throw new Error('Composition sampling exceeded the bounded proof budget.')
    }
    this.write(this.pose(entries, duration))
    if (duration > 0) {
      const frames = [...offsets]
        .sort((a, b) => a - b)
        .map((offset) => ({
          offset,
          transform: this.transform(this.pose(entries, offset * duration)),
        }))
      const effect = this.target.animate(frames, {
        duration,
        easing: 'linear',
        fill: 'both',
      })
      effect.startTime = now
      this.effect = effect
      this.diagnostics.keyframes = frames.length
      void effect.finished.then(
        () => {
          if (generation !== this.generation || this.disposed) return
          this.effect = undefined
          effect.cancel()
        },
        () => {},
      )
    } else {
      this.effect = undefined
      this.diagnostics.keyframes = 0
    }
    previous?.cancel()
  }

  read() {
    return {
      ...this.pose(this.snapshot(), 0, false),
      effects: this.target.getAnimations().length,
      channels: this.slots.size,
      ...this.diagnostics,
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.generation++
    this.effect?.cancel()
    this.effect = undefined
    for (const slot of this.slots.values()) this.settle(slot, false)
    this.slots.clear()
    this.rest.clear()
    this.ownership.invalidate(this.target)
    if (
      this.target.style.getPropertyValue('transform') === this.written &&
      !this.target.style.getPropertyPriority('transform')
    )
      this.target.style.setProperty(
        'transform',
        this.originalTransform,
        this.originalPriority,
      )
    managed.delete(this.target)
  }
}
