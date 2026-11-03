import { createRenderEffect, onCleanup, type Accessor } from 'solid-js'
import {
  animateBinding,
  pressBinding,
  type AnimateValue,
  type PressValue,
} from '../frameworks/native-binding.js'
import type { Target } from '../types.js'
export type { AnimateValue, PressValue } from '../frameworks/native-binding.js'

/** Solid Native directive: `use:animate={value}` on a DOMiNATIVE NativeScript view. */
export function animate(node: Target, value: Accessor<AnimateValue | undefined>) {
  const binding = animateBinding(node)
  onCleanup(() => binding.destroy())
  createRenderEffect(() => binding.update(value()))
}
/** Solid Native directive: `use:press={value}`. */
export function press(node: Target, value: Accessor<PressValue | undefined>) {
  const binding = pressBinding(node)
  onCleanup(() => binding.destroy())
  createRenderEffect(() => binding.update(value()))
}
