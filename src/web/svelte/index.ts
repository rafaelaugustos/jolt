import {
  animateBinding,
  pressBinding,
  type AnimateValue,
  type PressValue,
  type BindingOptions,
} from '../frameworks/binding.js'
export type { AnimateValue, PressValue, BindingOptions } from '../frameworks/binding.js'

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
    animate: (node: HTMLElement, value?: AnimateValue) =>
      animateBinding(node, value, options),
    press: (node: HTMLElement, value?: PressValue) => pressBinding(node, value, options),
  }
}
