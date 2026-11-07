import {
  rigChannels,
  resolveRigDefinition,
  rigDestination,
  type RigChannel,
  type RigDefinition,
  type RigPart,
  type RigSocket,
  type RigTransform,
} from '../core/rig.js'
import { EffectStyles, type Realm } from './effect.js'
import { borderBox } from './style.js'
import type { WebAnimation } from './public.js'
import type { WebMotionScope } from './scope.js'
import type { SpringName, Transition } from './types.js'
export type { RigDefinition, RigPart, RigSocket, RigTransform } from '../core/rig.js'
export interface WebRig {
  readonly disposed: boolean
  readonly paused: boolean
  to(pose: string, transition?: Transition | SpringName): WebAnimation
  blend(
    poses: readonly { pose: string; weight: number }[],
    transition?: Transition | SpringName,
  ): WebAnimation
  attach(targets: Record<string, HTMLElement | null>): void
  accessory(socket: string, target: HTMLElement | null): void
  /** CSS pixels in the root part's parent's border-box coordinates. */
  point(socket: string): { x: number; y: number }
  refresh(): void
  pause(): void
  play(): void
  stop(): void
  dispose(): void
}
export interface RigHost {
  document: Document
  scope(): WebMotionScope
  validate(target: HTMLElement): void
  read(target: HTMLElement, key: RigChannel, model?: boolean): number
  revision(target: HTMLElement, key: RigChannel): symbol | undefined
  set(target: HTMLElement, values: RigTransform): void
  refresh(target: HTMLElement): void
  animate(
    batch: readonly {
      target: HTMLElement
      values: RigTransform
      rotation?: readonly [number, number]
    }[],
    transition: Transition | SpringName,
  ): WebAnimation
  forget(): void
}
const owners = new WeakMap<HTMLElement, object>()
export function createRig(
  definition: RigDefinition,
  targets: Record<string, HTMLElement | null>,
  host: RigHost,
): WebRig {
  const { parts, used, sockets, select } = resolveRigDefinition(definition)
  const view = host.document.defaultView as Realm,
    identity = {}
  const scope = host.scope()
  type Binding = {
    target: HTMLElement
    original: RigTransform
    rest: RigTransform
    tokens: Map<RigChannel, symbol | undefined>
    model: RigTransform
    styles: EffectStyles
    animation?: WebAnimation
  }
  const bound = new Map<string, Binding>(),
    accessories = new Map<string, Binding>()
  let ended = false,
    held = false
  const alive = () => {
    if (ended) throw new Error('Rig is disposed.')
  }
  const geometry = (target: HTMLElement) => {
    if (
      !target.isConnected ||
      target.ownerDocument !== host.document ||
      !target.parentElement
    )
      throw new Error('Rig geometry requires connected parts in their runtime document.')
    const css = view.getComputedStyle(target),
      parent = target.parentElement
    const matrix = new view.DOMMatrixReadOnly(
      css.transform === 'none' ? undefined : css.transform,
    )
    const origin = css.transformOrigin.split(/\s+/).map(Number.parseFloat)
    if (
      !matrix.is2D ||
      (origin[2] ?? 0) !== 0 ||
      css.perspective !== 'none' ||
      [css.translate, css.rotate, css.scale].some((v) => v !== 'none') ||
      !['1', 'normal', ''].includes(css.getPropertyValue('zoom')) ||
      target.offsetParent !== parent ||
      !target.getClientRects().length
    )
      throw new Error(
        'Rig geometry requires 2D boxes with their DOM parent as offsetParent, without CSS zoom or perspective.',
      )
    const size = borderBox(target, css)
    return {
      x: target.offsetLeft + parent.clientLeft - parent.scrollLeft,
      y: target.offsetTop + parent.clientTop - parent.scrollTop,
      width: size.width,
      height: size.height,
      origin: { x: origin[0]!, y: origin[1]! },
      matrix,
    }
  }
  const remember = (binding: Binding, keys: Iterable<RigChannel>) => {
    for (const key of keys) {
      binding.tokens.set(key, host.revision(binding.target, key))
      binding.model[key] = host.read(binding.target, key, true)
    }
  }
  const release = (binding: Binding) => {
    const restore: RigTransform = {}
    if (binding.target.isConnected && binding.target.ownerDocument === host.document)
      for (const [key, token] of binding.tokens)
        if (
          host.revision(binding.target, key) === token &&
          host.read(binding.target, key, true) === binding.model[key]
        )
          restore[key] = binding.original[key]
    try {
      binding.animation?.stop()
      if (Object.keys(restore).length) host.set(binding.target, restore)
    } finally {
      resize.unobserve(binding.target)
      binding.styles.restore()
      owners.delete(binding.target)
      if (binding.target.isConnected) host.refresh(binding.target)
    }
  }
  const bind = (target: HTMLElement, part: RigPart): Binding => {
    const original = Object.fromEntries(
      rigChannels.map((key) => [key, host.read(target, key, true)]),
    ) as RigTransform
    const binding: Binding = {
      target,
      original,
      rest: { ...original, ...part.rest },
      tokens: new Map(),
      model: {},
      styles: new EffectStyles(target),
    }
    owners.set(target, identity)
    try {
      if (part.pivot) {
        binding.styles.set(
          'transform-origin',
          `${part.pivot.x * 100}% ${part.pivot.y * 100}%`,
        )
        host.refresh(target)
      }
      resize.observe(target)
      return binding
    } catch (error) {
      release(binding)
      throw error
    }
  }
  const socket = (name: string) => {
    const data = sockets.get(name)
    if (!data) throw new TypeError(`Unknown rig socket "${name}".`)
    return data
  }
  const localPoint = (data: RigSocket) => {
    const target = bound.get(data.part)?.target
    if (!target) throw new Error('Socket part is detached.')
    const frame = geometry(target)
    return {
      x: data.x * (data.units === 'relative' ? frame.width : 1),
      y: data.y * (data.units === 'relative' ? frame.height : 1),
    }
  }
  const refresh = () => {
    if (ended) return
    for (const [name, binding] of accessories) {
      const data = socket(name),
        parent = bound.get(data.part)?.target
      if (
        !parent ||
        binding.target.parentElement !== parent ||
        !binding.target.isConnected
      )
        continue
      const frame = geometry(binding.target),
        point = localPoint(data)
      const values = {
        x: point.x - frame.x - frame.origin.x,
        y: point.y - frame.y - frame.origin.y,
      }
      if (values.x !== binding.model.x || values.y !== binding.model.y) {
        host.set(binding.target, values)
        remember(binding, ['x', 'y'])
      }
    }
  }
  const resize = new view.ResizeObserver(() => {
    try {
      refresh()
    } catch (error) {
      view.reportError(error)
    }
  })
  const rig: WebRig = {
    get disposed() {
      return ended
    },
    get paused() {
      return held
    },
    to: (pose, transition) => rig.blend([{ pose, weight: 1 }], transition),
    blend(layers, transition = 'smooth') {
      alive()
      if (held) throw new Error('Resume the rig before starting a pose.')
      const selected = select(layers)
      const batch = [...bound]
        .map(([name, binding]) => {
          geometry(binding.target)
          const part = parts.get(name)!,
            values: RigTransform = {}
          for (const key of used.get(name)!)
            values[key] = rigDestination(
              part,
              name,
              key,
              binding.rest[key]!,
              host.read(binding.target, key),
              selected,
            )
          return { target: binding.target, values, rotation: part.rotation }
        })
        .filter((item) => Object.keys(item.values).length > 0)
      const animation = scope.add(host.animate(batch, transition))
      for (const [name, binding] of bound) {
        binding.animation = animation
        remember(binding, used.get(name)!)
      }
      return animation
    },
    attach(replacements) {
      alive()
      const next = new Map([...bound].map(([name, binding]) => [name, binding.target]))
      for (const [name, target] of Object.entries(replacements)) {
        if (!parts.has(name)) throw new TypeError(`Unknown rig part "${name}".`)
        if (target) next.set(name, target)
        else next.delete(name)
      }
      if (new Set(next.values()).size !== next.size)
        throw new Error('Rig parts must use distinct elements.')
      for (const [name, target] of next) {
        const owner = owners.get(target)
        if (owner && (owner !== identity || bound.get(name)?.target !== target))
          throw new Error('Rig target already has an owner.')
        host.validate(target)
        geometry(target)
        const parent = parts.get(name)!.parent
        if (parent && next.has(parent) && target.parentElement !== next.get(parent))
          throw new Error('Rig parts must follow their declared DOM hierarchy.')
      }
      for (const [name, target] of Object.entries(replacements)) {
        const old = bound.get(name)
        if (old?.target === target) continue
        for (const [key, data] of sockets)
          if (data.part === name) rig.accessory(key, null)
        if (old) {
          bound.delete(name)
          release(old)
        }
        if (!target) continue
        const part = parts.get(name)!,
          binding = bind(target, part)
        bound.set(name, binding)
        if (Object.keys(part.rest).length) {
          host.set(target, part.rest)
          remember(binding, Object.keys(part.rest) as RigChannel[])
        }
      }
      refresh()
    },
    accessory(name, target) {
      alive()
      const data = socket(name),
        old = accessories.get(name)
      if (old?.target === target) return
      if (target) {
        if (owners.has(target) || target.parentElement !== bound.get(data.part)?.target)
          throw new Error(
            'An accessory must be an unowned direct child of its socket part.',
          )
        host.validate(target)
        geometry(target)
      }
      if (old) {
        accessories.delete(name)
        release(old)
      }
      if (target) accessories.set(name, bind(target, {}))
      refresh()
    },
    point(name) {
      alive()
      const data = socket(name)
      let point = localPoint(data),
        part: string | undefined = data.part
      while (part !== undefined) {
        const target = bound.get(part)?.target
        if (!target) throw new Error('Socket ancestry is detached.')
        const frame = geometry(target)
        const transformed = frame.matrix.transformPoint({
          x: point.x - frame.origin.x,
          y: point.y - frame.origin.y,
        })
        point = {
          x: frame.x + frame.origin.x + transformed.x,
          y: frame.y + frame.origin.y + transformed.y,
        }
        part = parts.get(part)!.parent
      }
      return point
    },
    refresh,
    pause() {
      if (!ended) {
        held = true
        scope.suspend()
      }
    },
    play() {
      if (!ended) {
        held = false
        scope.resume()
      }
    },
    stop() {
      if (!ended) scope.reset()
    },
    dispose() {
      if (ended) return
      ended = true
      const errors: unknown[] = []
      try {
        for (const binding of [...accessories.values(), ...bound.values()])
          try {
            release(binding)
          } catch (error) {
            errors.push(error)
          }
      } finally {
        accessories.clear()
        bound.clear()
        resize.disconnect()
        try {
          scope.dispose()
        } catch (error) {
          errors.push(error)
        } finally {
          host.forget()
        }
      }
      if (errors.length) throw new AggregateError(errors, 'Rig cleanup failed.')
    },
  }
  try {
    rig.attach(targets)
    return rig
  } catch (error) {
    rig.dispose()
    throw error
  }
}
