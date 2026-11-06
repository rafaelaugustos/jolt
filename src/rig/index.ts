import type { View } from '@nativescript/core'
import { set, toView } from '../animate.js'
import { currentValue, propertyRevision, ViewAnimation, type Plan } from '../engine.js'
import { getDriver } from '../driver/index.js'
import { motionScope } from '../motion-scope.js'
import { readValue } from '../properties.js'
import type { TimelineAnimation } from '../sequence.js'
import { createTrack, type Track } from '../track.js'
import {
  resolveTransition,
  springs,
  type Transition,
  type SpringName,
} from '../transition.js'
import type { Target } from '../types.js'

const channels = ['x', 'y', 'scaleX', 'scaleY', 'rotate'] as const
type Channel = (typeof channels)[number]
export type RigTransform = Partial<Record<Channel, number>>
export interface RigPart {
  parent?: string
  /** Fractions of the native part's size, like NativeScript originX/Y. */
  pivot?: { x: number; y: number }
  rest?: RigTransform
  /** Degrees; the entire sampled rotation, including spring overshoot, is bounded. */
  rotation?: readonly [number, number]
}
export interface RigSocket {
  part: string
  /** Local DIPs, or fractions when units is 'relative'. */
  x: number
  y: number
  units?: 'dip' | 'relative'
}
export interface RigDefinition {
  parts: Record<string, RigPart>
  poses: Record<string, Record<string, RigTransform>>
  sockets?: Record<string, RigSocket>
}
export interface Rig {
  readonly disposed: boolean
  readonly paused: boolean
  to(pose: string, transition?: Transition | SpringName): TimelineAnimation
  /** Weighted offsets from rest; each channel normalizes weights above one. Missing channels use rest. */
  blend(
    poses: readonly { pose: string; weight: number }[],
    transition?: Transition | SpringName,
  ): TimelineAnimation
  /** Replace/detach views atomically; the application owns the native hierarchy. */
  attach(targets: Record<string, Target | null>): void
  /** Accessory must be a direct native child of its socket's part. No reparenting. */
  accessory(socket: string, target: Target | null): void
  /** Sample a socket in the root part's parent's coordinates; no observer is installed. */
  point(socket: string): { x: number; y: number }
  refresh(): void
  pause(): void
  play(): void
  stop(): void
  dispose(): void
}
const owners = new WeakMap<View, object>()
const shortest = (angle: number) => ((((angle + 180) % 360) + 360) % 360) - 180
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** Native view articulation, with no JavaScript frame loop or asset ownership. */
export function rig2d(
  definition: RigDefinition,
  targets: Record<string, Target | null> = {},
): Rig {
  const parts = new Map(
    Object.entries(definition.parts).map(([name, part]) => [
      name,
      {
        ...part,
        pivot: part.pivot && { ...part.pivot },
        rest: { ...part.rest },
        rotation: part.rotation && ([...part.rotation] as [number, number]),
      },
    ]),
  )
  if (!parts.size || parts.size > 64) throw new RangeError('A rig supports 1..64 parts.')
  const validateTransform = (values: RigTransform) => {
    for (const [key, value] of Object.entries(values))
      if (!channels.includes(key as Channel) || !finite(value))
        throw new TypeError('Invalid rig transform.')
  }
  const used = new Map<string, Set<Channel>>()
  for (const [name, part] of parts) {
    validateTransform(part.rest)
    used.set(name, new Set(Object.keys(part.rest) as Channel[]))
    if (part.pivot && (!finite(part.pivot.x) || !finite(part.pivot.y)))
      throw new TypeError('Invalid rig pivot.')
    if (
      part.rotation &&
      (part.rotation.length !== 2 ||
        !part.rotation.every(finite) ||
        part.rotation[0] > part.rotation[1])
    )
      throw new TypeError('Invalid rotation limits.')
    const visited = new Set([name])
    let parent = part.parent
    while (parent !== undefined) {
      if (!parts.has(parent) || visited.has(parent))
        throw new TypeError('Rig hierarchy contains a cycle or missing parent.')
      visited.add(parent)
      parent = parts.get(parent)!.parent
    }
  }
  const poses = new Map(
    Object.entries(definition.poses).map(([name, pose]) => [
      name,
      Object.fromEntries(
        Object.entries(pose).map(([part, values]) => {
          if (!parts.has(part)) throw new TypeError(`Unknown rig part "${part}".`)
          validateTransform(values)
          Object.keys(values).forEach((key) => used.get(part)!.add(key as Channel))
          return [part, { ...values }]
        }),
      ),
    ]),
  )
  const sockets = new Map(
    Object.entries(definition.sockets ?? {}).map(([name, socket]) => {
      if (
        !parts.has(socket.part) ||
        !finite(socket.x) ||
        !finite(socket.y) ||
        (socket.units !== undefined && !['dip', 'relative'].includes(socket.units))
      )
        throw new TypeError('Invalid rig socket.')
      return [name, { ...socket }]
    }),
  )
  const scope = motionScope(),
    identity = {}
  type Binding = {
    view: View
    original: RigTransform
    rest: RigTransform
    tokens: Map<Channel, symbol | undefined>
    model: RigTransform
    pivot: { x: number; y: number }
    animation?: ViewAnimation
    release(): void
  }
  const bound = new Map<string, Binding>(),
    accessories = new Map<string, Binding>()
  let disposed = false,
    paused = false
  const alive = () => {
    if (disposed) throw new Error('Rig is disposed.')
  }
  const remember = (binding: Binding, keys: Iterable<Channel>) => {
    for (const key of keys) {
      binding.tokens.set(key, propertyRevision(binding.view, key))
      binding.model[key] = readValue(binding.view, key)
    }
  }
  const release = (binding: Binding, part?: RigPart) => {
    const restore: RigTransform = {}
    for (const [key, token] of binding.tokens)
      if (
        propertyRevision(binding.view, key) === token &&
        readValue(binding.view, key) === binding.model[key]
      )
        restore[key] = binding.original[key]
    binding.release()
    binding.animation?.stop()
    if (Object.keys(restore).length) set(binding.view, restore)
    if (part?.pivot) {
      if (binding.view.originX === part.pivot.x) binding.view.originX = binding.pivot.x
      if (binding.view.originY === part.pivot.y) binding.view.originY = binding.pivot.y
    }
    owners.delete(binding.view)
  }
  const bind = (view: View, rest: RigTransform): Binding => {
    const original = Object.fromEntries(
      channels.map((key) => [key, readValue(view, key)]),
    ) as RigTransform
    const binding: Binding = {
      view,
      original,
      rest: { ...original, ...rest },
      tokens: new Map(),
      model: {},
      pivot: { x: view.originX, y: view.originY },
      release: () => {},
    }
    owners.set(view, identity)
    return binding
  }
  const socket = (name: string) => {
    const data = sockets.get(name)
    if (!data) throw new TypeError(`Unknown rig socket "${name}".`)
    return data
  }
  const localPoint = (data: RigSocket) => {
    const view = bound.get(data.part)?.view
    if (!view) throw new Error('Socket part is detached.')
    const size = getDriver().layoutFrame?.(view) ?? view.getActualSize()
    return {
      x: data.x * (data.units === 'relative' ? size.width : 1),
      y: data.y * (data.units === 'relative' ? size.height : 1),
    }
  }
  const refresh = () => {
    if (disposed) return
    for (const [name, attachment] of accessories) {
      const data = socket(name),
        parent = bound.get(data.part)
      if (!parent || attachment.view.parent !== parent.view) continue
      const frame = getDriver().layoutFrame?.(attachment.view)
      if (!frame) continue
      const point = localPoint(data)
      const values = {
        x: point.x - frame.x - attachment.view.originX * frame.width,
        y: point.y - frame.y - attachment.view.originY * frame.height,
      }
      if (values.x !== attachment.model.x || values.y !== attachment.model.y) {
        set(attachment.view, values)
        remember(attachment, ['x', 'y'])
      }
    }
  }
  const rig: Rig = {
    get disposed() {
      return disposed
    },
    get paused() {
      return paused
    },
    to(pose, transition) {
      return rig.blend([{ pose, weight: 1 }], transition)
    },
    blend(layers, transition = 'smooth') {
      alive()
      if (paused) throw new Error('Resume the rig before starting a pose.')
      const selected = layers.map((layer) => {
        if (!finite(layer.weight) || layer.weight < 0 || !poses.has(layer.pose))
          throw new TypeError('Unknown pose or invalid blend weight.')
        return { pose: poses.get(layer.pose)!, weight: layer.weight }
      })
      const settings = typeof transition === 'string' ? springs[transition] : transition
      if (!settings) throw new TypeError('Unknown rig transition.')
      const prepared = [...bound].map(([name, binding]) => {
        const part = parts.get(name)!
        const plans = [...used.get(name)!].map((property): Plan => {
          const rest = binding.rest[property]!
          let total = 0,
            offset = 0
          for (const layer of selected) {
            const value = layer.pose[name]?.[property]
            if (value === undefined) continue
            total += layer.weight
            offset +=
              (property === 'rotate' && !part.rotation
                ? shortest(value - rest)
                : value - rest) * layer.weight
          }
          let destination = rest + offset / Math.max(1, total)
          const current = currentValue(binding.view, property)
          if (property === 'rotate' && !part.rotation)
            destination = current + shortest(destination - current)
          const resolved = resolveTransition(settings, property, 2)
          const original = createTrack(property, [current, destination], resolved, 0)
          let track = original
          if (property === 'rotate' && part.rotation) {
            const [min, max] = part.rotation,
              clamp = (value: number) => Math.max(min, Math.min(max, value))
            track = {
              ...original,
              values: original.values.map(clamp),
              to: clamp(original.to),
              valueAt: (time) => clamp(original.valueAt(time)),
              velocityAt: (time) =>
                original.valueAt(time) <= min || original.valueAt(time) >= max
                  ? 0
                  : original.velocityAt(time),
            } satisfies Track
          }
          return {
            property,
            keyframes: [current, destination],
            transition: resolved,
            track: () => track,
          }
        })
        return { binding, plans }
      })
      return scope.timeline(
        prepared.map(({ binding, plans }) => ({
          at: 0,
          run() {
            const animation = new ViewAnimation(binding.view, plans)
            binding.animation?.stop()
            binding.animation = animation
            const record = () => {
              if (binding.animation === animation)
                remember(
                  binding,
                  plans.map((plan) => plan.property as Channel),
                )
            }
            animation.onReady(record)
            if (animation.ready) record()
            return animation
          },
        })),
      )
    },
    attach(replacements) {
      alive()
      const next = new Map([...bound].map(([name, binding]) => [name, binding.view]))
      for (const [name, target] of Object.entries(replacements)) {
        if (!parts.has(name)) throw new TypeError(`Unknown rig part "${name}".`)
        if (target) next.set(name, toView(target))
        else next.delete(name)
      }
      if (new Set(next.values()).size !== next.size)
        throw new Error('Rig parts must use distinct views.')
      for (const [name, view] of next) {
        const owner = owners.get(view)
        if (owner && (owner !== identity || bound.get(name)?.view !== view))
          throw new Error('Rig target already has an owner.')
        const parent = parts.get(name)!.parent
        if (parent && next.has(parent) && view.parent !== next.get(parent))
          throw new Error('Rig parts must follow the declared native parent hierarchy.')
      }
      for (const [name, target] of Object.entries(replacements)) {
        const view = target ? toView(target) : undefined,
          old = bound.get(name)
        if (old?.view === view) continue
        for (const [key, data] of sockets)
          if (data.part === name) rig.accessory(key, null)
        if (old) {
          release(old, parts.get(name))
          bound.delete(name)
        }
        if (!view) continue
        const part = parts.get(name)!,
          binding = bind(view, part.rest)
        bound.set(name, binding)
        if (part.pivot) {
          view.originX = part.pivot.x
          view.originY = part.pivot.y
        }
        set(view, part.rest)
        remember(binding, Object.keys(part.rest) as Channel[])
        view.on('layoutChanged', refresh)
        view.on('loaded', refresh)
        binding.release = () => {
          view.off('layoutChanged', refresh)
          view.off('loaded', refresh)
        }
      }
      refresh()
    },
    accessory(name, target) {
      alive()
      const data = socket(name),
        view = target ? toView(target) : undefined,
        old = accessories.get(name)
      if (old?.view === view) return
      if (view && (owners.has(view) || view.parent !== bound.get(data.part)?.view))
        throw new Error(
          'An accessory must be an unowned direct child of its socket part.',
        )
      if (old) {
        release(old)
        accessories.delete(name)
      }
      if (!view) return
      const binding = bind(view, {})
      accessories.set(name, binding)
      view.on('layoutChanged', refresh)
      binding.release = () => view.off('layoutChanged', refresh)
      refresh()
    },
    point(name) {
      alive()
      const data = socket(name)
      let point = localPoint(data),
        part: string | undefined = data.part
      while (part !== undefined) {
        const view = bound.get(part)?.view
        if (!view) throw new Error('Socket ancestry is detached.')
        const frame = getDriver().layoutFrame?.(view)
        if (!frame) throw new Error('Socket coordinates require laid out native parts.')
        const x = (point.x - view.originX * frame.width) * currentValue(view, 'scaleX')
        const y = (point.y - view.originY * frame.height) * currentValue(view, 'scaleY')
        const angle = (currentValue(view, 'rotate') * Math.PI) / 180
        point = {
          x:
            frame.x +
            view.originX * frame.width +
            currentValue(view, 'x') +
            x * Math.cos(angle) -
            y * Math.sin(angle),
          y:
            frame.y +
            view.originY * frame.height +
            currentValue(view, 'y') +
            x * Math.sin(angle) +
            y * Math.cos(angle),
        }
        part = parts.get(part)!.parent
      }
      return point
    },
    refresh,
    pause() {
      if (!disposed) {
        paused = true
        scope.suspend()
      }
    },
    play() {
      if (!disposed) {
        paused = false
        scope.resume()
      }
    },
    stop() {
      if (!disposed) scope.reset()
    },
    dispose() {
      if (disposed) return
      // Restore before cancelling scope handles, so ownership comparisons still see our model.
      for (const binding of accessories.values()) release(binding)
      for (const [name, binding] of bound) release(binding, parts.get(name))
      accessories.clear()
      bound.clear()
      disposed = true
      scope.dispose()
    },
  }
  try {
    rig.attach(targets)
  } catch (error) {
    rig.dispose()
    throw error
  }
  return rig
}
