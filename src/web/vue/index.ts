import { getCurrentScope, onScopeDispose, watch, type Ref } from 'vue'
import {
  createWebRuntime,
  type AnimateOptions,
  type Keyframes,
  type Preset,
  type KeyframeProperty,
  type RuntimeOptions,
  type SpringName,
  type Values,
  type WebAnimation,
  type WebConfig,
  type WebPressOptions,
  type WebRuntime,
  type WebSizeValues,
  type WebSizeOptions,
  type WebLayoutOptions,
} from '../public.js'

export interface WebMotionOptions extends RuntimeOptions {
  /** Applied once per entering element, after insertion and before playback. */
  initial?: Values
  enter?: Preset
  leave?: Preset
}

/** Experimental DOM-ref adapter. Call synchronously inside a Vue setup scope. */
export function useWebMotion(
  target: Readonly<Ref<HTMLElement | null | undefined>>,
  options: WebMotionOptions = {},
) {
  if (!getCurrentScope()) throw new Error('useWebMotion requires a Vue setup scope.')
  const contexts = new Map<Document, WebRuntime>()
  const entered = new WeakSet<HTMLElement>()
  type Operation = { phase: 'enter' | 'leave'; animation?: WebAnimation }
  const operations = new Map<HTMLElement, Operation>()
  let disposed = false
  let settings: RuntimeOptions = {
    timeScale: options.timeScale,
    reducedMotion: options.reducedMotion,
    maxKeyframes: options.maxKeyframes,
  }
  function element(value: Element | null | undefined): HTMLElement {
    const view = value?.ownerDocument.defaultView
    if (disposed) throw new Error('Web motion scope has been disposed.')
    if (
      !view ||
      !(value instanceof (view as Window & typeof globalThis).HTMLElement) ||
      !value.isConnected
    )
      throw new TypeError('Web motion needs a mounted HTMLElement ref.')
    return value
  }
  function context(el: HTMLElement) {
    let runtime = contexts.get(el.ownerDocument)
    if (!runtime) {
      runtime = createWebRuntime(el.ownerDocument, settings)
      contexts.set(el.ownerDocument, runtime)
    }
    return runtime
  }
  function cancel(el: HTMLElement, phase?: Operation['phase']) {
    const operation = operations.get(el)
    if (!operation || (phase && operation.phase !== phase)) return
    operations.delete(el)
    operation.animation?.stop()
  }
  function release(el: HTMLElement) {
    cancel(el)
    contexts.get(el.ownerDocument)?.release(el)
  }
  function run(value: Element, phase: Operation['phase'], done: () => void) {
    const el = element(value)
    cancel(el)
    const operation: Operation = { phase }
    operations.set(el, operation)
    const finish = () => {
      // Identity is the generation: an older promise cannot finish a newer leave.
      if (disposed || operations.get(el) !== operation) return
      operations.delete(el)
      done()
      if (phase === 'leave' && target.value !== el) release(el)
    }
    try {
      const runtime = context(el)
      if (phase === 'enter' && !entered.has(el)) {
        entered.add(el)
        if (options.initial) runtime.set(el, options.initial)
      }
      const recipe = options[phase]
      if (!recipe) {
        finish()
        return
      }
      const animation = runtime.animate(el, recipe.keyframes, recipe.transition)
      operation.animation = animation
      if (!Number.isFinite(animation.duration)) {
        animation.stop()
        throw new RangeError('Vue enter/leave recipes must have finite duration.')
      }
      void animation.finished.then(finish)
    } catch (error) {
      finish()
      throw error
    }
  }
  // Vue clears a v-if ref before leave completes. Keep that surface until done.
  watch(
    target,
    (next, previous) => {
      if (previous && previous !== next && operations.get(previous)?.phase !== 'leave')
        release(previous)
    },
    { flush: 'post' },
  )
  onScopeDispose(() => {
    disposed = true
    operations.clear()
    for (const runtime of contexts.values()) runtime.dispose()
    contexts.clear()
  })
  return {
    /** Bind to <Transition v-bind="motion.transition">; keep user hooks on Vue. */
    transition: {
      css: false as const,
      onEnter: (el: Element, done: () => void) => run(el, 'enter', done),
      onLeave: (el: Element, done: () => void) => run(el, 'leave', done),
      onEnterCancelled: (el: Element) => cancel(el as HTMLElement, 'enter'),
      onLeaveCancelled: (el: Element) => cancel(el as HTMLElement, 'leave'),
    },
    animate(keyframes: Keyframes | string, transition?: AnimateOptions | SpringName) {
      const el = element(target.value)
      return context(el).animate(el, keyframes, transition)
    },
    set(values: Values) {
      const el = element(target.value)
      return context(el).set(el, values)
    },
    animateSize(
      values: WebSizeValues,
      changeOrOptions?: (() => void) | WebSizeOptions | SpringName,
      options?: WebSizeOptions | SpringName,
    ) {
      const el = element(target.value)
      return context(el).animateSize(el, values, changeOrOptions, options)
    },
    animateLayout(
      changeOrOptions?: (() => void) | WebLayoutOptions | SpringName,
      options?: WebLayoutOptions | SpringName,
    ) {
      const el = element(target.value)
      return context(el).animateLayout(el, changeOrOptions, options)
    },
    press(values?: Values, config?: WebPressOptions) {
      const el = element(target.value)
      return context(el).press(el, values, config)
    },
    stop(properties?: readonly KeyframeProperty[], config?: { layer?: string }) {
      const el = element(target.value)
      context(el).stop(el, properties, config)
    },
    configure(config: WebConfig) {
      if (disposed) throw new Error('Web motion scope has been disposed.')
      for (const runtime of contexts.values()) runtime.configure(config)
      settings = { ...settings, ...config }
    },
  }
}
