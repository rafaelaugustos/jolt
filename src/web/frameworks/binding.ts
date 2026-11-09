import {
  createWebRuntime,
  type WebRuntime,
  type WebAnimation,
  type WebPress,
  type WebPressOptions,
  type Keyframes,
  type Values,
  type AnimateOptions,
  type SpringName,
} from '../public.js'
import { observeConnection } from '../vue/attachment.js'

export type AnimateValue =
  string | Keyframes | readonly [string | Keyframes, (AnimateOptions | SpringName)?]
export type PressValue = Values | readonly [Values, WebPressOptions?]
export interface BindingOptions {
  /** Borrowed; never configured, released or disposed by a framework binding. */
  runtime?: WebRuntime
}

// Only live DOM bindings acquire a context. Imports and server renders do not.
// Sharing the context lets press compose with animate on the same element.
const contexts = new WeakMap<
  Document,
  { runtime: WebRuntime; users: number; targets: Map<HTMLElement, number> }
>()

/** Copy plain declarative input so in-place user changes are not mistaken for equality. */
function snapshot<T>(value: T, seen = new Set<object>()): T {
  if (!value || typeof value !== 'object') return value
  if (seen.has(value)) throw new TypeError('Motion definitions cannot contain cycles.')
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)
    throw new TypeError('Motion definitions require plain objects and arrays.')
  seen.add(value)
  const result = Array.isArray(value)
    ? value.map((item) => snapshot(item, seen))
    : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, snapshot(v, seen)]))
  seen.delete(value)
  return result as T
}
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  )
}

function owner(
  node: HTMLElement,
  options: BindingOptions,
  change: (connected: boolean) => void,
) {
  const document = node?.ownerDocument
  const view = document?.defaultView as (Window & typeof globalThis) | null
  if (!view || !(node instanceof view.HTMLElement))
    throw new TypeError('Web motion bindings require a DOM HTMLElement.')
  let entry = contexts.get(document)
  if (!options.runtime) {
    if (!entry) {
      entry = { runtime: createWebRuntime(document), users: 0, targets: new Map() }
      contexts.set(document, entry)
    }
    entry.users++
    entry.targets.set(node, (entry.targets.get(node) ?? 0) + 1)
  }
  const runtime = options.runtime ?? entry!.runtime
  const scope = runtime.scope()
  let disposed = false
  const connection = observeConnection(node, (connected) => {
    if (disposed) return
    if (node.ownerDocument !== document) {
      destroy()
      return
    }
    if (connected) scope.resume()
    change(connected)
    if (!connected) scope.suspend()
  })
  function destroy() {
    if (disposed) return
    disposed = true
    connection.dispose()
    try {
      scope.dispose()
    } finally {
      if (!options.runtime) {
        const count = entry!.targets.get(node)! - 1
        if (count) entry!.targets.set(node, count)
        else {
          entry!.targets.delete(node)
          runtime.release(node)
        }
        if (--entry!.users === 0) {
          contexts.delete(document)
          runtime.dispose()
        }
      }
    }
  }
  return {
    runtime,
    scope,
    destroy,
    get disposed() {
      return disposed
    },
  }
}

/** Framework-independent owner; detached nodes retain the latest declaration. */
export function animateBinding(
  node: HTMLElement,
  initial?: AnimateValue,
  options: BindingOptions = {},
) {
  let value = snapshot(initial),
    pending = true,
    manualPause = false
  let current: WebAnimation | undefined
  const binding = owner(node, options, (connected) => {
    if (connected) play()
    else {
      manualPause = current?.paused ?? false
      pending = true
    }
  })
  function play() {
    if (binding.disposed || !node.isConnected || !pending) return current
    if (value === undefined) {
      binding.scope.reset()
      current = undefined
    } else {
      const [frames, transition] = Array.isArray(value) ? value : [value, undefined]
      const next = binding.scope.animate(
        node,
        frames as string | Keyframes,
        transition as AnimateOptions | SpringName | undefined,
      )
      current = next
      if (manualPause) next.pause()
    }
    pending = false
    return current
  }
  try {
    play()
  } catch (error) {
    binding.destroy()
    throw error
  }
  return {
    get current() {
      return current
    },
    get disposed() {
      return binding.disposed
    },
    update(next?: AnimateValue, replay = false) {
      if (binding.disposed) return
      const copied = snapshot(next)
      if (!replay && same(value, copied)) return current
      const previous = value
      value = copied
      pending = true
      try {
        return play()
      } catch (error) {
        value = previous
        pending = false
        throw error
      }
    },
    destroy: binding.destroy,
  }
}

export function pressBinding(
  node: HTMLElement,
  initial?: PressValue,
  options: BindingOptions = {},
) {
  let value = snapshot(initial),
    current: WebPress | undefined
  const binding = owner(node, options, (connected) => {
    if (connected) {
      if (!current) play()
    } else {
      if (current) binding.scope.release(current)
      current = undefined
    }
  })
  function play() {
    if (binding.disposed || !node.isConnected) return
    const [values, settings] = Array.isArray(value) ? value : [value, undefined]
    // Validate/create the replacement before releasing working feedback.
    const next = binding.scope.retain(
      binding.runtime.press(
        node,
        values as Values | undefined,
        settings as WebPressOptions | undefined,
      ),
    )
    if (current) binding.scope.release(current)
    current = next
  }
  try {
    play()
  } catch (error) {
    binding.destroy()
    throw error
  }
  return {
    get disposed() {
      return binding.disposed
    },
    update(next?: PressValue) {
      if (binding.disposed) return
      const copied = snapshot(next)
      if (same(value, copied)) return
      const previous = value
      value = copied
      try {
        play()
      } catch (error) {
        value = previous
        throw error
      }
    },
    destroy: binding.destroy,
  }
}
