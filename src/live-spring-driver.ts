import { isAndroid, type View } from '@nativescript/core'
import type { NumericProperty } from './properties.js'
import { retainInteractiveLayout } from './driver/ios-layout.js'

export interface LiveMapping {
  input: readonly number[]
  output: readonly number[]
  clamp: boolean
}
export interface LiveSpringPhysics {
  stiffness: number
  damping: number
  mass: number
  restDelta: number
  restSpeed: number
}
export interface LiveInput {
  value: number
  running: boolean
  elapsed: number
  duration: number
  delay: number
  repeat: number
  reverse: boolean
  to: number
  times: readonly number[]
  values: readonly number[]
}
export interface LiveBinding {
  value(): number
  layers(inputs: readonly LiveInput[]): void
  cancel(): void
}
export interface LiveNode {
  position(): number
  velocity(): number
  moving(): boolean
  follow(source: LiveNode, maps: readonly LiveMapping[]): void
  update(input: LiveInput): void
  /** Several sampled inputs over a rest value, each on its own clock, summed natively. */
  inputs(rest: number, inputs: readonly LiveInput[]): void
  reduced(value: boolean): void
  paused(value: boolean): void
  bind(view: View, property: NumericProperty, maps: readonly LiveMapping[]): LiveBinding
  dispose(): void
}
export interface LiveSpringDriver {
  create(initial: number, physics: LiveSpringPhysics, reduced: boolean): LiveNode
  sync(view: View): void
}
let override: LiveSpringDriver | undefined
export function setLiveSpringDriver(driver: LiveSpringDriver | undefined) {
  override = driver
}
export function liveSpringDriver(): LiveSpringDriver {
  if (override) return override
  if (!available())
    throw new Error(
      'springValue() needs the Jolt native classes. Rebuild the native app after upgrading Jolt.',
    )
  return nativeDriver
}
/** Native composition is optional: an app binary without the classes keeps sampled playback. */
export function liveComposition(): LiveSpringDriver | undefined {
  return override ?? (available() ? nativeDriver : undefined)
}
export const stillPhysics: LiveSpringPhysics = {
  stiffness: 100,
  damping: 20,
  mass: 1,
  restDelta: 0.001,
  restSpeed: 0.01,
}
function available() {
  return isAndroid
    ? typeof org !== 'undefined' &&
        typeof org.rafaelaugusto.jolt.LiveSpring === 'function'
    : typeof JoltLiveSpring !== 'undefined'
}
export function syncLiveSprings(view: View) {
  if (override) override.sync(view)
  else if (available() && view.nativeViewProtected) nativeDriver.sync(view)
}
const handles = new WeakMap<
  LiveNode,
  org.rafaelaugusto.jolt.LiveSpring | JoltLiveSpring
>()
/** Internal native input connection; never exposes handles through the public value API. */
export function nativeLiveNode(node: LiveNode) {
  const handle = handles.get(node)
  if (!handle) throw new Error('A gesture needs a native live value node.')
  return handle
}
const nativeDriver: LiveSpringDriver = {
  create(initial, physics, reduced) {
    const { stiffness, damping, mass, restDelta, restSpeed } = physics
    if (isAndroid) {
      const native = new org.rafaelaugusto.jolt.LiveSpring(
        initial,
        stiffness,
        damping,
        mass,
        restDelta,
        restSpeed,
        reduced,
      )
      const node: LiveNode = {
        position: () => native.getPosition(),
        velocity: () => native.getVelocity(),
        moving: () => native.isMoving(),
        follow: (source, maps) =>
          native.follow(
            handles.get(source) as org.rafaelaugusto.jolt.LiveSpring,
            JSON.stringify(maps),
          ),
        update: (input) =>
          input.running
            ? native.updateInput(JSON.stringify(input))
            : native.setTarget(input.value),
        inputs: (rest, inputs) => native.setInputs(rest, JSON.stringify(inputs)),
        reduced: (value) => native.setReduced(value),
        paused: (value) => native.setPaused(value),
        bind(view, property, maps) {
          const binding = native.bind(
            view.nativeViewProtected,
            property,
            JSON.stringify(maps),
          )
          return {
            value: () => binding.getValue(),
            layers: (inputs) => binding.setLayers(JSON.stringify(inputs)),
            cancel: () => binding.cancel(),
          }
        },
        dispose: () => native.dispose(),
      }
      handles.set(node, native)
      return node
    }
    const native = JoltLiveSpring.createStiffnessDampingMassRestDeltaRestSpeedReduced(
      initial,
      stiffness,
      damping,
      mass,
      restDelta,
      restSpeed,
      reduced,
    )
    const node: LiveNode = {
      position: () => native.position,
      velocity: () => native.velocity,
      moving: () => native.moving,
      follow: (source, maps) =>
        native.followMappings(
          handles.get(source) as JoltLiveSpring,
          JSON.stringify(maps),
        ),
      update: (input) =>
        input.running
          ? native.updateInput(JSON.stringify(input))
          : native.setTarget(input.value),
      inputs: (rest, inputs) => native.setInputsRest(JSON.stringify(inputs), rest),
      reduced: (value) => native.setReduced(value),
      paused: (value) => native.setPaused(value),
      bind(view, property, maps) {
        const releaseLayout = retainInteractiveLayout(view)
        let binding: JoltLiveSpringBinding
        try {
          binding = native.bindPropertyMappings(
            view.nativeViewProtected,
            property,
            JSON.stringify(maps),
          )
        } catch (error) {
          releaseLayout()
          throw error
        }
        return {
          value: () => binding.value,
          layers: (inputs) => binding.setLayers(JSON.stringify(inputs)),
          cancel: () => {
            binding.cancel()
            releaseLayout()
          },
        }
      },
      dispose: () => native.dispose(),
    }
    handles.set(node, native)
    return node
  },
  sync(view) {
    if (isAndroid) org.rafaelaugusto.jolt.LiveSpring.sync(view.nativeViewProtected)
    else JoltLiveSpring.sync(view.nativeViewProtected)
  },
}
