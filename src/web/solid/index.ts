import { createEffect, createSignal, getOwner, onCleanup, type Accessor } from 'solid-js'
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

export function createDirectives(options: BindingOptions = {}) {
  return {
    motion(node: HTMLElement, setup: Accessor<MotionSetup>) {
      if (!getOwner()) throw new Error('Motion directives require a Solid owner.')
      let binding: ReturnType<typeof motionBinding> | undefined
      onCleanup(() => binding?.destroy())
      createEffect(() => {
        if (binding) binding.update(setup())
        else binding = motionBinding(node, setup(), options)
      })
    },
    animate(node: HTMLElement, value: Accessor<AnimateValue | undefined>) {
      if (!getOwner()) throw new Error('Motion directives require a Solid owner.')
      // First effect applies the declaration after render; server effects do not run.
      let live: ReturnType<typeof animateBinding> | undefined
      onCleanup(() => live?.destroy())
      createEffect(() => {
        live ??= animateBinding(node, undefined, options)
        live.update(value())
      })
    },
    press(node: HTMLElement, value: Accessor<PressValue | undefined>) {
      if (!getOwner()) throw new Error('Motion directives require a Solid owner.')
      let live: ReturnType<typeof pressBinding> | undefined
      onCleanup(() => live?.destroy())
      createEffect(() => {
        if (!live) live = pressBinding(node, value(), options)
        else live.update(value())
      })
    },
  }
}
export const { animate, press, motion } = createDirectives()

export type { PresenceOptions } from '../frameworks/binding.js'
/** Use `show()` with Show and `use:presence` on one retained root. SSR reads only the boolean. */
export function createPresence(
  present: Accessor<boolean>,
  options: PresenceOptions = {},
) {
  if (!getOwner()) throw new Error('Presence requires a Solid owner.')
  const [retained, retain] = createSignal(present())
  let binding: ReturnType<typeof presenceBinding> | undefined,
    disposed = false
  onCleanup(() => {
    disposed = true
    binding?.destroy()
    binding = undefined
  })
  createEffect(() => {
    const next = present()
    if (next) retain(true)
    binding?.update(next)
    if (!binding && !next) retain(false)
  })
  return {
    show: () => present() || retained(),
    presence(node: HTMLElement) {
      let current: ReturnType<typeof presenceBinding> | undefined
      onCleanup(() => {
        current?.destroy()
        if (binding === current) binding = undefined
      })
      // A newly cloned Solid template can still belong to an inert document.
      // Like the other directives, acquire its runtime only after insertion.
      createEffect(() => {
        if (!current) {
          if (binding && !binding.disposed)
            throw new Error('Presence requires exactly one root.')
          current = presenceBinding(
            node,
            present(),
            () => {
              if (!disposed && !present()) retain(false)
            },
            options,
          )
          binding = current
        } else current.update(present())
      })
    },
  }
}
