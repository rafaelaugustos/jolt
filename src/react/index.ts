import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import {
  animateBinding,
  pressBinding,
  type AnimateValue,
  type PressValue,
} from '../frameworks/native-binding.js'
import type { Target } from '../types.js'
export type { AnimateValue, PressValue } from '../frameworks/native-binding.js'

/** React NativeScript ref hook. Reconciles ref replacements after every commit. */
export function useAnimate<T extends Target>(
  ref: RefObject<T | null>,
  value?: AnimateValue,
) {
  const state = useRef<{
    node: T
    binding: ReturnType<typeof animateBinding>
    value?: AnimateValue
  }>()
  const ensure = useCallback(() => {
    const node = ref.current
    if (!node) {
      state.current?.binding.destroy()
      state.current = undefined
      return
    }
    if (state.current?.node !== node) {
      state.current?.binding.destroy()
      state.current = { node, binding: animateBinding(node) }
    }
    return state.current
  }, [ref])
  useLayoutEffect(() => {
    const current = ensure()
    if (current && !Object.is(current.value, value)) {
      current.value = value
      current.binding.update(value)
    }
  })
  useLayoutEffect(
    () => () => {
      state.current?.binding.destroy()
      state.current = undefined
    },
    [],
  )
  return useCallback(
    (animation: AnimateValue) => {
      const current = ensure()
      if (!current) throw new Error('useAnimate requires a mounted NativeScript ref.')
      return current.binding.update(animation, true)
    },
    [ensure],
  )
}

export function usePress<T extends Target>(ref: RefObject<T | null>, value?: PressValue) {
  const state = useRef<{
    node: T
    binding: ReturnType<typeof pressBinding>
    value?: PressValue
  }>()
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) {
      state.current?.binding.destroy()
      state.current = undefined
      return
    }
    if (state.current?.node !== node) {
      state.current?.binding.destroy()
      state.current = { node, binding: pressBinding(node, value), value }
    } else if (!Object.is(state.current.value, value)) {
      state.current.value = value
      state.current.binding.update(value)
    }
  })
  useLayoutEffect(
    () => () => {
      state.current?.binding.destroy()
      state.current = undefined
    },
    [],
  )
}
