import { Application, type View } from '@nativescript/core'
import { toViews } from './animate.js'
import { onReducedMotion, reducedMotion } from './config.js'
import {
  pointerPoint,
  resolvePointerOptions,
  type PointerCoordinatesOptions,
} from './core/pointer.js'
import {
  asRoot,
  motionValue,
  springValue,
  liveValueInput,
  type DerivedValue,
  type SpringValue,
  type SpringValueOptions,
} from './motion-value.js'
import { pointerInput, type PointerInput } from './pointer-input.js'
import type { Target } from './types.js'

export interface PointerOptions extends PointerCoordinatesOptions {
  /** Native local DIPs, or normalized [-1, 1], measured from the region center. */
  coordinates?: 'normalized' | 'pixels'
  spring?: SpringValueOptions | false
}
export interface PointerFollow {
  readonly x: DerivedValue
  readonly y: DerivedValue
  /** 1 inside the region, 0 on exit, suspension or unavailable input. */
  readonly presence: DerivedValue
  readonly active: boolean
  /** Whether this loaded view has a supported hover API; does not detect a connected mouse. */
  readonly available: boolean
  readonly disposed: boolean
  readonly suspended: boolean
  update(state: { disabled: boolean }): void
  refresh(): void
  suspend(): void
  resume(): void
  dispose(): void
}

/** Hover from mice and supported hovering pens. Ordinary touch is not hover. */
export function pointerFollow(target: Target, input: PointerOptions = {}): PointerFollow {
  const options = resolvePointerOptions(input)
  const views = toViews(target)
  if (views.length !== 1) throw new TypeError('pointerFollow requires one input region.')
  let view: View | undefined = views[0]!
  const raw = {
    x: motionValue(options.rest.x),
    y: motionValue(options.rest.y),
    presence: motionValue(0),
  }
  const nodes: SpringValue[] = []
  try {
    if (input.spring !== false) {
      nodes.push(springValue(raw.x, { ...input.spring, initial: options.rest.x }))
      nodes.push(springValue(raw.y, { ...input.spring, initial: options.rest.y }))
    }
  } catch (error) {
    nodes.forEach((node) => node.dispose())
    throw error
  }
  let native: PointerInput | undefined
  let nativeTarget: object | undefined
  let disposed = false,
    suspended = false,
    active = false,
    disabled = options.disabled,
    available = false,
    generation = 0
  const blocked = () =>
    disabled ||
    suspended ||
    Application.suspended ||
    reducedMotion() ||
    !view?.isEnabled ||
    view.visibility !== 'visible'
  const reset = (immediate = false) => {
    active = false
    asRoot(raw.presence).set(0)
    for (const [index, channel] of (['x', 'y'] as const).entries()) {
      const follower = nodes[index] && liveValueInput(nodes[index]!)
      if (immediate) follower?.node.reduced(true)
      asRoot(raw[channel]).set(options.rest[channel])
      if (immediate) {
        follower?.node.reduced(
          input.spring === false || input.spring?.duration === 0 || reducedMotion(),
        )
        follower?.changed()
      }
    }
  }
  const detach = () => {
    generation++
    native?.dispose()
    native = undefined
    nativeTarget = undefined
    available = false
    reset(true)
  }
  const attach = () => {
    if (native && nativeTarget !== view?.nativeViewProtected) detach()
    if (disposed || native || !view?.isLoaded || blocked()) return
    const current = ++generation
    native = pointerInput(view, (x, y, width, height, inside) => {
      if (disposed || current !== generation) return
      if (blocked()) {
        reset(true)
        return
      }
      const point = inside ? pointerPoint(x, y, width, height, options) : undefined
      if (!point) {
        reset()
        return
      }
      active = true
      asRoot(raw.x).set(point.x)
      asRoot(raw.y).set(point.y)
      asRoot(raw.presence).set(1)
    })
    available = !!native
    nativeTarget = view.nativeViewProtected
  }
  const refresh = () => {
    if (disposed) return
    if (blocked()) detach()
    else {
      attach()
      native?.refresh()
    }
  }
  const offReduced = onReducedMotion(refresh)
  const events = ['layoutChanged', 'isEnabledChange', 'visibilityChange']
  const controller: PointerFollow = {
    x: nodes[0] ?? raw.x,
    y: nodes[1] ?? raw.y,
    presence: raw.presence,
    get active() {
      return active
    },
    get available() {
      return available
    },
    get disposed() {
      return disposed
    },
    get suspended() {
      return suspended || Application.suspended
    },
    update(state) {
      if (disposed) throw new Error('Pointer controller is disposed.')
      if (!state || typeof state.disabled !== 'boolean')
        throw new TypeError('disabled must be boolean.')
      disabled = state.disabled
      refresh()
    },
    refresh,
    suspend() {
      if (!disposed && !suspended) {
        suspended = true
        detach()
      }
    },
    resume() {
      if (!disposed && suspended) {
        suspended = false
        refresh()
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      detach()
      offReduced()
      Application.off(Application.suspendEvent, detach)
      Application.off(Application.resumeEvent, refresh)
      view?.off('loaded', attach)
      view?.off('unloaded', detach)
      view?.style.off('visibilityChange', refresh)
      for (const event of events) view?.off(event, refresh)
      view = undefined
      nodes.forEach((node) => node.dispose())
    },
  }
  try {
    view.on('loaded', attach)
    view.on('unloaded', detach)
    view.style.on('visibilityChange', refresh)
    for (const event of events) view.on(event, refresh)
    Application.on(Application.suspendEvent, detach)
    Application.on(Application.resumeEvent, refresh)
    attach()
  } catch (error) {
    controller.dispose()
    throw error
  }
  return controller
}
