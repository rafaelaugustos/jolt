import type { View } from '@nativescript/core'
import { set, toView } from '../animate.js'
import { currentValue, propertyRevision, ViewAnimation, type Plan } from '../engine.js'
import { getDriver } from '../driver/index.js'
import { motionScope } from '../motion-scope.js'
import { readValue } from '../properties.js'
import type { TimelineAnimation } from '../sequence.js'
import { createTrack } from '../track.js'
import {
  resolveTransition,
  springs,
  type Transition,
  type SpringName,
} from '../transition.js'
import type { Target } from '../types.js'

import {
  rigChannels as channels,
  resolveRigDefinition,
  rigDestination,
  limitRigTrack,
  type RigChannel as Channel,
  type RigDefinition,
  type RigPart,
  type RigSocket,
  type RigTransform,
} from '../core/rig.js'
export type { RigDefinition, RigPart, RigSocket, RigTransform } from '../core/rig.js'
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

/** Native view articulation, with no JavaScript frame loop or asset ownership. */
export function rig2d(
  definition: RigDefinition,
  targets: Record<string, Target | null> = {},
): Rig {
  const { parts, used, sockets, select } = resolveRigDefinition(definition)
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
      const selected = select(layers)
      const settings = typeof transition === 'string' ? springs[transition] : transition
      if (!settings) throw new TypeError('Unknown rig transition.')
      const prepared = [...bound].map(([name, binding]) => {
        const part = parts.get(name)!
        const plans = [...used.get(name)!].map((property): Plan => {
          const rest = binding.rest[property]!
          const current = currentValue(binding.view, property)
          const destination = rigDestination(
            part,
            name,
            property,
            rest,
            current,
            selected,
          )
          const resolved = resolveTransition(settings, property, 2)
          const original = createTrack(property, [current, destination], resolved, 0)
          const track =
            property === 'rotate' ? limitRigTrack(original, part.rotation) : original
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
