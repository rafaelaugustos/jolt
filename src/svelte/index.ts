import {
  animateBinding,
  pressBinding,
  type AnimateValue,
  type PressValue,
} from '../frameworks/native-binding.js'
import type { Target } from '../types.js'
export type { AnimateValue, PressValue } from '../frameworks/native-binding.js'

/** Svelte Native action: `use:animate={'fadeInUp'}`. Receives a nativeView wrapper. */
export function animate(node: Target, value?: AnimateValue) {
  return animateBinding(node, value)
}
/** Svelte Native action: `use:press={{ scale: 0.96 }}`. */
export function press(node: Target, value?: PressValue) {
  return pressBinding(node, value)
}
