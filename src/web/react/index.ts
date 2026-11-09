'use client'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import {
  animateBinding,
  pressBinding,
  type AnimateValue,
  type PressValue,
  type BindingOptions,
} from '../frameworks/binding.js'
export type { AnimateValue, PressValue, BindingOptions } from '../frameworks/binding.js'

/** DOM work starts after commit. React SSR never reads a ref or creates a runtime. */
export function useAnimate<T extends HTMLElement>(
  ref: RefObject<T | null>,
  value?: AnimateValue,
  options: BindingOptions = {},
) {
  const state = useRef<
    | {
        node: T
        runtime: BindingOptions['runtime']
        binding: ReturnType<typeof animateBinding>
      }
    | undefined
  >(undefined)
  const ensure = useCallback(() => {
    const node = ref.current
    const old = state.current
    if (
      old &&
      (old.node !== node || old.runtime !== options.runtime || old.binding.disposed)
    ) {
      old.binding.destroy()
      state.current = undefined
    }
    if (node && !state.current)
      state.current = {
        node,
        runtime: options.runtime,
        binding: animateBinding(node, undefined, options),
      }
    return state.current?.binding
  }, [ref, options.runtime])
  useEffect(() => {
    ensure()?.update(value)
  })
  useEffect(
    () => () => {
      state.current?.binding.destroy()
      state.current = undefined
    },
    [],
  )
  return useCallback(
    (animation: AnimateValue) => {
      const binding = state.current?.binding
      if (!binding || state.current?.node !== ref.current || binding.disposed)
        throw new Error('useAnimate requires a committed DOM ref.')
      return binding.update(animation, true)
    },
    [ref],
  )
}

export function usePress<T extends HTMLElement>(
  ref: RefObject<T | null>,
  value?: PressValue,
  options: BindingOptions = {},
) {
  const state = useRef<
    | {
        node: T
        runtime: BindingOptions['runtime']
        binding: ReturnType<typeof pressBinding>
      }
    | undefined
  >(undefined)
  useEffect(() => {
    const node = ref.current,
      old = state.current
    if (
      old &&
      (old.node !== node || old.runtime !== options.runtime || old.binding.disposed)
    ) {
      old.binding.destroy()
      state.current = undefined
    }
    if (node && !state.current)
      state.current = {
        node,
        runtime: options.runtime,
        binding: pressBinding(node, value, options),
      }
    else state.current?.binding.update(value)
  })
  useEffect(
    () => () => {
      state.current?.binding.destroy()
      state.current = undefined
    },
    [],
  )
}
