import { createRef } from 'react'
import {
  useAnimate,
  usePress,
  useMotion,
  usePresence,
  type MotionSetup,
  type AnimateValue,
} from '@rafaelaugusto/jolt/web/react'
import {
  animate,
  press,
  motion,
  createActions,
  createPresence as sveltePresence,
} from '@rafaelaugusto/jolt/web/svelte'
import {
  createDirectives,
  createPresence as solidPresence,
} from '@rafaelaugusto/jolt/web/solid'
import {
  JoltAnimateDirective,
  JoltPressDirective,
  JoltIfDirective,
  JoltMotionDirective,
} from '@rafaelaugusto/jolt/web/angular'
import { createWebRuntime, createPreset } from '@rafaelaugusto/jolt/web'
import { replaySensor } from '@rafaelaugusto/jolt/web/testing'
import { inspectorPlot } from '@rafaelaugusto/jolt/web/inspector'
import type { Action } from 'svelte/action'
const ref = createRef<HTMLButtonElement>()
const declaration: AnimateValue = [{ x: 120 }, { duration: 500 }]
function Component() {
  const run = useAnimate(ref, declaration)
  usePress(ref, { scale: 0.95 })
  useMotion(ref, setup)
  const retained = usePresence(ref, true, { enter: ['fadeIn', { duration: 300 }] })
  return { run, retained }
}
const action: Action<HTMLElement, AnimateValue | undefined> = animate
const button = document.createElement('button')
const runtime = createWebRuntime(document)
createActions({ runtime }).animate(button, declaration).update('fadeIn')
createDirectives({ runtime }).animate(button, () => declaration)
press(button).destroy()
const directive = null as unknown as JoltAnimateDirective
directive.joltAnimate = declaration
directive.joltRuntime = runtime
const retained = null as unknown as JoltIfDirective
retained.joltIfEnter = 'fadeIn'
const feedback = null as unknown as JoltPressDirective
feedback.joltPress = { scale: 0.9 }
const sensor = runtime.sensor('gravity')
replaySensor(
  sensor,
  [
    { time: 0, values: [0, 0, 0] },
    { time: 100, values: [1, 0, 0] },
  ],
  { manual: true },
).advanceTo(50)
inspectorPlot([{ at: 0, expected: 0, observed: null, event: 'replace' }])
// @ts-expect-error DOM hooks cannot consume NativeScript properties.
useAnimate(ref, { translateX: 10 })
// @ts-expect-error Portable event markers are bounded.
inspectorPlot([{ at: 0, expected: 0, observed: 0, event: 'user-name' }])
void [Component, action]

const setup: MotionSetup = (scope, node) => {
  const pointer = scope.pointerFollow(node)
  const value = scope.motionValue(0)
  const spring = scope.springValue(value)
  scope.bind(node, { x: spring, y: pointer.y })
  return () => {}
}
const scopedAction: Action<HTMLElement, MotionSetup> = motion
const portable = createPreset('fadeInUp', {
  distance: 32,
  direction: 'left',
  duration: 200,
})
runtime.definePreset('card-entry', portable)
const scopedDirective = null as unknown as JoltMotionDirective
scopedDirective.joltMotion = setup
createDirectives({ runtime }).motion(button, () => setup)
void [scopedAction, sveltePresence, solidPresence]
// @ts-expect-error Parameter recipes have an explicit finite portable subset.
createPreset('popOut')
// @ts-expect-error Scope setup must be synchronous.
const invalidSetup: MotionSetup = async () => {}
void invalidSetup
