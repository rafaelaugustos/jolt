import {
  Application,
  type EventData,
  type PanGestureEventData,
  type TouchGestureEventData,
  type View,
} from '@nativescript/core'
import { toView } from './animate.js'
import { DEFAULT_FRICTION } from './decay.js'
import { DragInput } from './drag-input.js'
import {
  clampDrag,
  resistDrag,
  resumeDrag,
  solveDragRelease,
  type DragCurve,
} from './drag-physics.js'
import {
  baseValue,
  currentValue,
  setBase,
  stopBase,
  ViewAnimation,
  type Animation,
  type Plan,
} from './engine.js'
import { asRoot, isMotionValue, type MotionValue } from './motion-value.js'
import type { PlaybackAnimation } from './playback.js'
import { createTrack } from './track.js'
import type { Target } from './types.js'

export interface DragPoint {
  readonly x: number
  readonly y: number
}
export interface DragEvent extends DragPoint {
  /** DIPs per second, in the same coordinates as the translation. */
  readonly velocityX: number
  readonly velocityY: number
}
export interface DragRelease<A extends Animation = PlaybackAnimation> extends DragEvent {
  readonly target: DragPoint
  /** False on interruption/cancellation. Check before applying completion effects. */
  readonly animation: A
}
export interface DragOptions {
  /** Defaults to both. One finger only. */
  axis?: 'x' | 'y' | 'both'
  /** Absolute translateX/translateY limits in DIPs; omitted edges are unbounded. */
  bounds?: { left?: number; right?: number; top?: number; bottom?: number }
  /** Closest stop to the projected landing. Arrays apply to every enabled axis. */
  snap?: readonly number[] | { x?: readonly number[]; y?: readonly number[] }
  /** Resist beyond bounds and spring back. Defaults to false (hard limits). */
  rubberband?: boolean
  /** Decay retention per millisecond. Defaults to 0.998. */
  friction?: number
  onStart?: (event: DragEvent) => void
  onMove?: (event: DragEvent) => void
  onRelease?: (event: DragRelease) => void
  onCancel?: (event: DragEvent) => void
  onSettle?: (position: DragPoint) => void
}
/** Drags a motion value instead of the view. Bounds and snap points are in the value's units. */
export interface DragValueOptions extends Omit<
  DragOptions,
  'axis' | 'snap' | 'onRelease'
> {
  /** Takes the position on every move and plays the release; bind views to it to follow. */
  value: MotionValue
  axis: 'x' | 'y'
  snap?: readonly number[]
  onRelease?: (event: DragRelease<Animation>) => void
}
export interface Drag {
  readonly dragging: boolean
  readonly settling: boolean
  readonly paused: boolean
  readonly disposed: boolean
  /** Current presentation, including a native release animation in flight. */
  readonly position: DragPoint
  /** Cancel contact/release at its visible position, keeping the subscription. */
  cancel(): void
  /** Cancel and detach input. play() accepts new gestures; cancelled work stays cancelled. */
  pause(): void
  play(): void
  dispose(): void
}

type Axis = 'x' | 'y'
type Root = ReturnType<typeof asRoot>
interface Settings {
  axes: Axis[]
  curves: Record<Axis, DragCurve>
  value: Root | undefined
  callbacks: Pick<DragOptions, 'onStart' | 'onMove' | 'onCancel' | 'onSettle'> & {
    onRelease?: (event: DragRelease<Animation>) => void
  }
}
const owners = new WeakMap<View, Drag>()

function settings(options: DragOptions | DragValueOptions): Settings {
  if (!options || typeof options !== 'object')
    throw new TypeError('Drag options must be an object.')
  const axis = options.axis ?? 'both'
  if (!['x', 'y', 'both'].includes(axis))
    throw new TypeError('Drag axis must be x, y or both.')
  const value = 'value' in options ? options.value : undefined
  if (value !== undefined && !isMotionValue(value))
    throw new TypeError('Drag value must be a motion value.')
  if (value !== undefined && axis === 'both')
    throw new TypeError('Dragging a motion value needs axis "x" or "y".')
  const friction = options.friction ?? DEFAULT_FRICTION
  if (!Number.isFinite(friction) || friction <= 0 || friction >= 1)
    throw new RangeError('Drag friction must be between 0 and 1 exclusively.')
  if (options.rubberband !== undefined && typeof options.rubberband !== 'boolean')
    throw new TypeError('Drag rubberband must be boolean.')
  const bounds = options.bounds ?? {}
  if (
    typeof bounds !== 'object' ||
    Array.isArray(bounds) ||
    Object.entries(bounds).some(
      ([key, value]) =>
        !['left', 'right', 'top', 'bottom'].includes(key) ||
        (value !== undefined && !Number.isFinite(value)),
    )
  )
    throw new RangeError('Drag bounds must have finite left/right/top/bottom edges.')
  const x: readonly [number, number] = [
    bounds.left ?? -Infinity,
    bounds.right ?? Infinity,
  ]
  const y: readonly [number, number] = [
    bounds.top ?? -Infinity,
    bounds.bottom ?? Infinity,
  ]
  if (x[0] > x[1] || y[0] > y[1]) throw new RangeError('Drag bounds must be ordered.')
  const snap = options.snap
  const shared = Array.isArray(snap)
  if (
    snap !== undefined &&
    !shared &&
    (!snap ||
      typeof snap !== 'object' ||
      Object.keys(snap).some((key) => key !== 'x' && key !== 'y'))
  )
    throw new TypeError('Drag snap must be an array or x/y arrays.')
  const stops = (
    value: readonly number[] | undefined,
    range: readonly [number, number],
  ) => {
    if (value === undefined) return undefined
    if (
      !Array.isArray(value) ||
      !value.length ||
      ![...value].every((n) => Number.isFinite(n) && n >= range[0] && n <= range[1])
    )
      throw new RangeError('Drag snap needs nonempty finite positions within bounds.')
    return [...value]
  }
  const perAxis = snap as { x?: readonly number[]; y?: readonly number[] } | undefined
  const axes: Axis[] = axis === 'both' ? ['x', 'y'] : [axis]
  const curves = Object.fromEntries(
    (['x', 'y'] as const).map((key) => [
      key,
      {
        type: 'drag',
        velocity: 0,
        friction,
        bounds: key === 'x' ? x : y,
        snap: stops(
          shared && axes.includes(key) ? snap : perAxis?.[key],
          key === 'x' ? x : y,
        ),
        rubberband: options.rubberband ?? false,
      },
    ]),
  ) as Record<Axis, DragCurve>
  const callbacks = {
    onStart: options.onStart,
    onMove: options.onMove,
    onRelease: options.onRelease as Settings['callbacks']['onRelease'],
    onCancel: options.onCancel,
    onSettle: options.onSettle,
  }
  for (const callback of Object.values(callbacks))
    if (callback !== undefined && typeof callback !== 'function')
      throw new TypeError('Drag callbacks must be functions.')
  return { axes, curves, value: value && asRoot(value), callbacks }
}

/**
 * Main-thread pan updates; release physics play through Jolt's native animation drivers.
 * With `value`, the gesture drives a motion value and the views bound to it.
 */
export function drag(target: Target, options: DragValueOptions): Drag
export function drag(target: Target, options?: DragOptions): Drag
export function drag(target: Target, options: DragOptions | DragValueOptions = {}): Drag {
  const view = toView(target)
  const config = settings(options) // Invalid replacements leave the existing owner intact.
  const previous = owners.get(view)
  const controller = new DragController(view, config)
  owners.set(view, controller)
  // onCancel may synchronously install another drag. The most recent owner wins.
  try {
    previous?.dispose()
  } catch (error) {
    controller.dispose()
    throw error
  }
  return controller
}

class DragController implements Drag {
  private active = false
  private disabled = false
  private destroyed = false
  private background = false
  private attached = false
  private blocked = false
  private generation = 0
  private release: Animation | undefined
  private input = new DragInput()
  private origin = { x: 0, y: 0 }
  private last: DragEvent = { x: 0, y: 0, velocityX: 0, velocityY: 0 }
  private lengths = { x: 200, y: 200 }
  constructor(
    private view: View,
    private config: Settings,
  ) {
    view.on('loaded', this.attach)
    view.on('unloaded', this.unload)
    Application.on(Application.suspendEvent, this.suspend)
    Application.on(Application.resumeEvent, this.resume)
    this.attach()
  }
  get dragging() {
    return this.active
  }
  get settling() {
    return !!this.release
  }
  get paused() {
    return this.disabled
  }
  get disposed() {
    return this.destroyed
  }
  get position(): DragPoint {
    const value = this.config.value
    if (value) return { x: 0, y: 0, [this.config.axes[0]!]: value.raw() }
    return { x: currentValue(this.view, 'x'), y: currentValue(this.view, 'y') }
  }
  cancel = () => {
    const wasActive = this.active
    this.active = false
    this.blocked = true
    this.generation++
    const release = this.release
    this.release = undefined
    release?.stop()
    this.input.reset()
    if (wasActive)
      this.config.callbacks.onCancel?.({ ...this.last, velocityX: 0, velocityY: 0 })
  }
  pause = () => {
    if (this.destroyed || this.disabled) return
    this.disabled = true
    this.detach()
  }
  play = () => {
    if (this.destroyed) return
    this.disabled = false
    this.attach()
  }
  dispose = () => {
    if (this.destroyed) return
    this.destroyed = true
    this.view.off('loaded', this.attach)
    this.view.off('unloaded', this.unload)
    Application.off(Application.suspendEvent, this.suspend)
    Application.off(Application.resumeEvent, this.resume)
    if (owners.get(this.view) === this) owners.delete(this.view)
    this.detach()
  }
  private attach = () => {
    if (
      this.attached ||
      this.destroyed ||
      this.disabled ||
      this.background ||
      !this.view.isLoaded
    )
      return
    this.blocked = false
    this.attached = true
    this.view.on('touch', this.touch)
    this.view.on('pan', this.pan)
  }
  private detach = () => {
    this.attached = false
    this.view.off('touch', this.touch)
    this.view.off('pan', this.pan)
    this.cancel()
  }
  private unload = () => this.detach()
  private suspend = () => {
    this.background = true
    this.detach()
  }
  private resume = () => {
    this.background = false
    this.attach()
  }
  private touch = (data: EventData) => {
    const event = data as TouchGestureEventData
    if (event.action === 'down') {
      this.cancel()
      this.blocked = false
    } else if (event.action === 'cancel') this.cancel()
  }
  private pan = (data: EventData) => {
    const event = data as PanGestureEventData
    if (!this.attached || this.destroyed || this.disabled || this.background) return
    if (this.view.isEnabled === false) {
      this.cancel()
      return
    }
    if (event.state === 1) this.input.reset()
    const input = this.input.read(event, this.view)
    if (input.cancelled) {
      this.cancel()
      return
    }
    if (this.blocked) return
    if (event.state === 1) {
      this.cancel()
      if (!this.attached || this.destroyed || this.disabled) return
      this.blocked = false
      const value = this.config.value
      if (value) {
        value.stop()
        this.origin = this.position
      } else {
        // Claim just the enabled axes, preserving the native presentation on takeover.
        stopBase(this.view, this.config.axes)
        this.origin = { x: baseValue(this.view, 'x'), y: baseValue(this.view, 'y') }
      }
      const size =
        (this.view.parent as View | undefined)?.getActualSize() ??
        this.view.getActualSize()
      this.lengths = {
        x: Math.max(1, size.width || 200),
        y: Math.max(1, size.height || 200),
      }
      this.active = true
      this.last = { ...this.origin, velocityX: 0, velocityY: 0 }
      for (const axis of this.config.axes) {
        const curve = this.config.curves[axis]
        if (!curve.rubberband) continue
        const resumed = resumeDrag(this.origin[axis], curve.bounds, this.lengths[axis])
        this.origin[axis] = resumed.origin
        this.lengths[axis] = resumed.length
      }
      this.input.read(event, this.view)
      this.emit(() => this.config.callbacks.onStart?.({ ...this.last }))
    }
    if (!this.active) return
    const generation = this.generation
    if (Number.isFinite(input.x) && Number.isFinite(input.y)) {
      const position = { x: this.last.x, y: this.last.y }
      let vx = 0,
        vy = 0
      for (const axis of this.config.axes) {
        const curve = this.config.curves[axis]
        const raw = this.origin[axis] + input[axis]
        const distance = raw - clampDrag(raw, curve.bounds)
        const resistance =
          distance === 0
            ? 1
            : curve.rubberband
              ? 0.55 / (1 + Math.abs(distance) / this.lengths[axis]) ** 2
              : 0
        position[axis] = curve.rubberband
          ? resistDrag(raw, curve.bounds, this.lengths[axis])
          : clampDrag(raw, curve.bounds)
        if (axis === 'x') vx = input.velocityX * resistance
        else vy = input.velocityY * resistance
        if (this.config.value) this.config.value.set(position[axis])
        else {
          stopBase(this.view, [axis])
          setBase(this.view, axis, position[axis])
        }
      }
      this.last = { ...position, velocityX: vx, velocityY: vy }
      if (event.state !== 3)
        this.emit(() => this.config.callbacks.onMove?.({ ...this.last }))
    }
    if (!this.active || generation !== this.generation) return
    if (event.state === 3) this.emit(() => this.finish())
  }
  private emit(callback: () => void) {
    try {
      callback()
    } catch (error) {
      // A failing application callback must not leave live input or an orphaned fling.
      this.active = false
      this.dispose()
      throw error
    }
  }
  private finish() {
    this.active = false
    const generation = ++this.generation
    const event = { ...this.last }
    const target = { x: event.x, y: event.y }
    const plans: Plan[] = this.config.axes.map((axis) => {
      const curve = {
        ...this.config.curves[axis],
        velocity: axis === 'x' ? event.velocityX : event.velocityY,
      }
      target[axis] = solveDragRelease(event[axis], curve).to
      return {
        property: axis,
        keyframes: [null, null],
        transition: { curve, delay: 0, repeat: 0, reverse: false },
      }
    })
    const [axis] = this.config.axes
    const value = this.config.value
    const animation = value
      ? value.play(createTrack(axis!, [event[axis!]], plans[0]!.transition, 0))
      : new ViewAnimation(this.view, plans)
    this.release = animation
    void animation.finished.then((finished) => {
      if (generation !== this.generation || this.destroyed) return
      this.release = undefined
      if (finished) this.config.callbacks.onSettle?.({ ...target })
    })
    this.emit(() => this.config.callbacks.onRelease?.({ ...event, target, animation }))
  }
}
