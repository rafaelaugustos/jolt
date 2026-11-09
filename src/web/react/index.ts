'use client'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
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

/** Own runtime resources for this committed DOM ref. Memoize setup to preserve the resource graph. */
export function useMotion<T extends HTMLElement>(
  ref: RefObject<T | null>,
  setup: MotionSetup,
  options: BindingOptions = {},
) {
  const state = useRef<
    | {
        node: T
        runtime: BindingOptions['runtime']
        binding: ReturnType<typeof motionBinding>
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
        binding: motionBinding(node, setup, options),
      }
    else state.current?.binding.update(setup)
  })
  useEffect(
    () => () => {
      state.current?.binding.destroy()
      state.current = undefined
    },
    [],
  )
}

export type { PresenceOptions } from '../frameworks/binding.js'
/** Render while the returned boolean is true; retain the same ref/key through an interrupted exit. */
export function usePresence<T extends HTMLElement>(
  ref: RefObject<T | null>,
  present: boolean,
  options: PresenceOptions = {},
) {
  const [retained, retain] = useState(present)
  const latest = useRef(present)
  const state = useRef<
    | {
        node: T
        runtime: BindingOptions['runtime']
        binding: ReturnType<typeof presenceBinding>
      }
    | undefined
  >(undefined)
  useEffect(() => {
    latest.current = present
    if (present) retain(true)
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
        binding: presenceBinding(
          node,
          present,
          () => {
            if (!latest.current) retain(false)
          },
          options,
        ),
      }
    else state.current?.binding.update(present, options)
    if (!node && !present) retain(false)
  })
  useEffect(
    () => () => {
      state.current?.binding.destroy()
      state.current = undefined
    },
    [],
  )
  return present || retained
}
