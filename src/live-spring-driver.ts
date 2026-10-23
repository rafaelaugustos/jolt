import { isAndroid, type View } from '@nativescript/core'
import type { NumericProperty } from './properties.js'

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
      reduced: (value) => native.setReduced(value),
      paused: (value) => native.setPaused(value),
      bind(view, property, maps) {
        const binding = native.bindPropertyMappings(
          view.nativeViewProtected,
          property,
          JSON.stringify(maps),
        )
        return {
          value: () => binding.value,
          layers: (inputs) => binding.setLayers(JSON.stringify(inputs)),
          cancel: () => binding.cancel(),
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
