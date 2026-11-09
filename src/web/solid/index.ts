import { createEffect, getOwner, onCleanup, type Accessor } from 'solid-js'
import {
  animateBinding,
  pressBinding,
  type AnimateValue,
  type PressValue,
  type BindingOptions,
} from '../frameworks/binding.js'
export type { AnimateValue, PressValue, BindingOptions } from '../frameworks/binding.js'

export function createDirectives(options: BindingOptions = {}) {
  return {
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
export const { animate, press } = createDirectives()
