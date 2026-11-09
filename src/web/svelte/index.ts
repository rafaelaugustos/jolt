import { onDestroy } from 'svelte'
import { writable } from 'svelte/store'
import {
  animateBinding,
  presenceBinding,
  type PresenceOptions,
  motionBinding,
  type MotionSetup,
  pressBinding,
  type AnimateValue,
  type PressValue,
  type BindingOptions,
} from '../frameworks/binding.js'
export type {
  AnimateValue,
  PressValue,
  BindingOptions,
  MotionSetup,
} from '../frameworks/binding.js'

/** Svelte DOM actions; each action owns only its own resources. */
export function animate(node: HTMLElement, value?: AnimateValue) {
  return animateBinding(node, value)
}
export function press(node: HTMLElement, value?: PressValue) {
  return pressBinding(node, value)
}
/** Create actions borrowing an application-owned runtime. */
export function createActions(options: BindingOptions) {
  return {
    motion: (node: HTMLElement, setup: MotionSetup) =>
      motionBinding(node, setup, options),
    animate: (node: HTMLElement, value?: AnimateValue) =>
      animateBinding(node, value, options),
    press: (node: HTMLElement, value?: PressValue) => pressBinding(node, value, options),
  }
}

/** Scoped setup for values, pointer, drag, scroll, timelines, layout and diagnostics. */
export function motion(node: HTMLElement, setup: MotionSetup) {
  return motionBinding(node, setup)
}

export type { PresenceOptions } from '../frameworks/binding.js'
/** A readable retained-presence store plus its DOM action. Create during component initialization. */
export function createPresence(initial: boolean, options: PresenceOptions = {}) {
  const retained = writable(initial)
  let present = initial,
    disposed = false,
    binding: ReturnType<typeof presenceBinding> | undefined
  function destroy() {
    if (disposed) return
    disposed = true
    binding?.destroy()
    binding = undefined
  }
  onDestroy(destroy)
  return {
    subscribe: retained.subscribe,
    set(next: boolean) {
      if (disposed) return
      present = next
      if (next) retained.set(true)
      binding?.update(next)
      if (!binding && !next) retained.set(false)
    },
    presence(node: HTMLElement) {
      if (disposed) throw new Error('Presence owner is disposed.')
      if (binding) throw new Error('Presence requires exactly one root.')
      const current = presenceBinding(
        node,
        present,
        () => {
          if (!present && !disposed) retained.set(false)
        },
        options,
      )
      binding = current
      return {
        destroy() {
          current.destroy()
          if (binding === current) binding = undefined
        },
      }
    },
    destroy,
  }
}
