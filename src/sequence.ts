import { getDriver } from './driver/index.js'
import { isDecorationProperty, validateDecorationTarget } from './decoration.js'
import type { View } from '@nativescript/core'
import { animate, startingValues, toViews } from './animate.js'
import { arrivalOf, setArrival, stopView, type Animation } from './engine.js'
import type { PresetName } from './presets.js'
import { writeValue, type Property } from './properties.js'
import type { SpringName } from './transition.js'
import type { AnimateOptions, Keyframes, Target } from './types.js'

export type Step =
  | readonly [
      target: Target | readonly Target[],
      animation: Keyframes | PresetName,
      options?: AnimateOptions | SpringName,
    ]
  | (() => Animation)

/**
 * Plays steps one after the other. A step starts once the previous one looks
 * done: a spring is close to its target, even if it hasn't fully settled.
 * Views in later steps take their first absolute keyframe right away, so a title
 * that fades in third doesn't show up before its turn. Relative and null keyframes
 * read the current value when their step starts.
 *
 * ```ts
 * await sequence([
 *   [logo, 'popIn'],
 *   [title, 'fadeInUp'],
 *   [buttons, 'fadeInUp', { stagger: 50 }],
 * ])
 * ```
 */
export function sequence(steps: readonly Step[]): Animation {
  applyStartingValues(steps)

  const started: Animation[] = []
  let stopped = false

  const arrived = (async () => {
    for (const step of steps) {
      if (stopped) return
      const animation = typeof step === 'function' ? step() : animate(...step)
      started.push(animation)
      await arrivalOf(animation)
    }
  })()

  const finished = arrived.then(async () => {
    const results = await Promise.all(started.map((animation) => animation.finished))
    return !stopped && results.length === steps.length && results.every(Boolean)
  })

  const animation: Animation = {
    finished,
    stop() {
      stopped = true
      started.forEach((animation) => animation.stop())
    },
    then: (onfulfilled, onrejected) => finished.then(onfulfilled, onrejected),
  }
  setArrival(animation, arrived)
  return animation
}

function applyStartingValues(steps: readonly Step[]) {
  const claimed = new Map<View, Set<Property>>()
  for (const step of steps) {
    if (typeof step === 'function') continue
    const [target, animation, options] = step
    const starts = startingValues(animation, options)

    for (const view of toViews(target)) {
      for (const property of starts.keys())
        if (isDecorationProperty(property)) validateDecorationTarget(view, property)
      let properties = claimed.get(view)
      if (!properties) claimed.set(view, (properties = new Set()))

      const fresh = [...starts].filter(
        ([property, value]) => !properties.has(property) && value !== null,
      )
      stopView(
        view,
        fresh.map(([property]) => property),
      )
      for (const [property, value] of fresh) {
        if (value !== null) writeValue(view, property, value)
      }
      getDriver().sync?.(view)
      for (const property of starts.keys()) properties.add(property)
    }
  }
}
