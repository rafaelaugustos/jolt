import {
  getCurrentInstance,
  getCurrentScope,
  onMounted,
  onActivated,
  onDeactivated,
  onScopeDispose,
  shallowRef,
  readonly,
  watch,
  type Ref,
  type ComponentPublicInstance,
} from 'vue'
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
  type WebMotionScope,
  type WebMotionResource,
  type WebShape,
  type WebShapeOptions,
} from '../public.js'
import { observeConnection } from './attachment.js'
export { createViewportEnterDirective } from './viewport-directive.js'
export type { WebViewportDirectiveOptions } from './viewport-directive.js'

export interface WebMotionOptions extends RuntimeOptions {
  /** Borrow the host's context for its declared surface; never dispose/reconfigure it. */
  runtime?: WebRuntime
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
  const scopes = new Map<HTMLElement, WebMotionScope>()
  const handles = new Map<HTMLElement, Set<WebAnimation>>()
  type Setup = (
    scope: WebMotionScope,
    target: HTMLElement,
    runtime: WebRuntime,
  ) => void | WebMotionResource
  type SetupRecord = { scope?: WebMotionScope; target?: HTMLElement; retained?: boolean }
  const setups = new Map<Setup, SetupRecord>()
  const instance = getCurrentInstance()
  let mounted = !instance,
    active = true
  const entered = new WeakSet<HTMLElement>()
  type Operation = {
    phase: 'enter' | 'leave'
    animation?: WebAnimation
    attachment?: { dispose(): void }
  }
  const operations = new Map<HTMLElement, Operation>()
  let pending: { element: HTMLElement; dispose(): void } | undefined
  let disposed = false
  let settings: RuntimeOptions = {
    timeScale: options.timeScale,
    reducedMotion: options.reducedMotion,
    maxKeyframes: options.maxKeyframes,
  }
  function element(value: Element | null | undefined, connected = true): HTMLElement {
    const view = value?.ownerDocument.defaultView
    if (disposed) throw new Error('Web motion scope has been disposed.')
    if (
      !view ||
      !(value instanceof (view as Window & typeof globalThis).HTMLElement) ||
      (connected && !value.isConnected)
    )
      throw new TypeError('Web motion needs a mounted HTMLElement ref.')
    return value
  }
  function context(el: HTMLElement) {
    if (options.runtime) return options.runtime
    let runtime = contexts.get(el.ownerDocument)
    if (!runtime) {
      runtime = createWebRuntime(el.ownerDocument, settings)
      contexts.set(el.ownerDocument, runtime)
    }
    return runtime
  }
  function owned(el: HTMLElement) {
    let scope = scopes.get(el)
    if (!scope) {
      scope = context(el).scope()
      scopes.set(el, scope)
    }
    return scope
  }
  function remember(el: HTMLElement, handle: WebAnimation) {
    let set = handles.get(el)
    if (!set) handles.set(el, (set = new Set()))
    set.add(handle)
    void handle.finished.then(() => {
      set.delete(handle)
      if (!set.size && handles.get(el) === set) handles.delete(el)
    })
    return handle
  }
  function clearSetups(keep?: HTMLElement | null, suspension = false) {
    const errors: unknown[] = []
    for (const record of setups.values()) {
      if (keep && record.target === keep) continue
      if (suspension && record.retained) {
        try {
          record.scope?.suspend()
        } catch (error) {
          errors.push(error)
        }
        continue
      }
      const scope = record.scope
      record.scope = undefined
      record.target = undefined
      try {
        scope?.dispose()
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Vue Web motion cleanup failed.')
  }
  function startSetups() {
    if (disposed || !mounted || !active || !target.value || !setups.size) return
    const el = element(target.value, false)
    if (!el.isConnected) {
      if (pending?.element !== el) {
        pending?.dispose()
        pending = {
          element: el,
          ...observeConnection(el, (connected) => {
            if (connected) startSetups()
          }),
        }
      }
      return
    }
    pending?.dispose()
    pending = undefined
    for (const [setup, record] of setups) {
      if (record.scope?.disposed) record.scope = undefined
      if (record.scope) {
        if (record.retained) record.scope.resume()
        continue
      }
      // Register the owner before user code, including reentrant unmount.
      const scope = context(el).scope()
      record.scope = scope
      record.target = el
      try {
        const resource = setup(scope, el, context(el))
        if (resource !== undefined) {
          if (typeof (resource as { then?: unknown }).then === 'function')
            throw new TypeError('Vue Web motion setup must be synchronous.')
          if (!scope.disposed) {
            if (record.retained) scope.retain(resource)
            else scope.add(resource)
          } else if (typeof resource === 'function') resource()
          else if ('dispose' in resource) resource.dispose()
          else resource.stop()
        }
      } catch (error) {
        record.scope = undefined
        record.target = undefined
        scope.dispose()
        throw error
      }
    }
  }
  function cancel(el: HTMLElement, phase?: Operation['phase']) {
    const operation = operations.get(el)
    if (!operation || (phase && operation.phase !== phase)) return
    operations.delete(el)
    operation.attachment?.dispose()
    operation.animation?.stop()
  }
  function release(el: HTMLElement) {
    cancel(el)
    scopes.get(el)?.dispose()
    scopes.delete(el)
    handles.delete(el)
    if (!options.runtime) contexts.get(el.ownerDocument)?.release(el)
  }
  function run(value: Element, phase: Operation['phase'], done: () => void) {
    const el = element(value, false)
    cancel(el)
    const operation: Operation = { phase }
    operations.set(el, operation)
    const finish = () => {
      // Identity is the generation: an older promise cannot finish a newer leave.
      if (disposed || operations.get(el) !== operation) return
      operations.delete(el)
      operation.attachment?.dispose()
      done()
      if (phase === 'leave' && target.value !== el) release(el)
    }
    const start = () => {
      try {
        const runtime = owned(el)
        if (phase === 'enter' && !entered.has(el)) {
          entered.add(el)
          if (options.initial) runtime.set(el, options.initial)
        }
        const recipe = options[phase]
        if (!recipe) {
          finish()
          return
        }
        const animation = remember(
          el,
          runtime.animate(el, recipe.keyframes, recipe.transition),
        )
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
    if (el.isConnected) start()
    else if (phase === 'leave') finish()
    else
      operation.attachment = observeConnection(el, (connected) => {
        if (!connected || disposed || operations.get(el) !== operation) return
        operation.attachment?.dispose()
        operation.attachment = undefined
        start()
      })
  }
  // Vue clears a v-if ref before leave completes. Keep that surface until done.
  watch(
    target,
    (next, previous) => {
      if (previous !== next) {
        pending?.dispose()
        pending = undefined
      }
      if (previous !== next) clearSetups(next)
      if (previous && previous !== next && operations.get(previous)?.phase !== 'leave')
        release(previous)
      startSetups()
    },
    { flush: 'post' },
  )
  if (instance) {
    onMounted(() => {
      mounted = true
      startSetups()
    })
    onDeactivated(() => {
      active = false
      pending?.dispose()
      pending = undefined
      for (const [el, operation] of operations) if (operation.attachment) cancel(el)
      clearSetups(undefined, true)
      for (const scope of scopes.values()) scope.suspend()
    })
    onActivated(() => {
      active = true
      for (const scope of scopes.values()) scope.resume()
      startSetups()
    })
  }
  onScopeDispose(() => {
    disposed = true
    pending?.dispose()
    pending = undefined
    for (const el of operations.keys()) cancel(el)
    operations.clear()
    const errors: unknown[] = []
    try {
      clearSetups()
    } catch (error) {
      errors.push(error)
    }
    setups.clear()
    for (const scope of scopes.values()) {
      try {
        scope.dispose()
      } catch (error) {
        errors.push(error)
      }
    }
    scopes.clear()
    handles.clear()
    for (const runtime of contexts.values()) runtime.dispose()
    contexts.clear()
    if (errors.length) throw new AggregateError(errors, 'Vue Web motion cleanup failed.')
  })
  function register(setup: Setup, retained = false) {
    if (disposed) throw new Error('Web motion scope has been disposed.')
    if (typeof setup !== 'function') throw new TypeError('Expected motion setup.')
    if (setups.has(setup)) throw new Error('Motion setup is already registered.')
    const record: SetupRecord = { retained }
    setups.set(setup, record)
    try {
      startSetups()
    } catch (error) {
      setups.delete(setup)
      throw error
    }
    return () => {
      if (!setups.delete(setup)) return
      record.scope?.dispose()
      record.scope = undefined
      record.target = undefined
      if (!setups.size) {
        pending?.dispose()
        pending = undefined
      }
    }
  }
  return {
    /** Run after mount; rebuild on ref replacement and KeepAlive reactivation. */
    use: (setup: Setup) => register(setup),
    /** Retain the returned resource through KeepAlive; replace/dispose with the ref. */
    resource: (setup: Setup) => register(setup, true),
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
      return remember(el, owned(el).animate(el, keyframes, transition))
    },
    set(values: Values) {
      const el = element(target.value)
      return remember(el, owned(el).set(el, values))
    },
    animateSize(
      values: WebSizeValues,
      changeOrOptions?: (() => void) | WebSizeOptions | SpringName,
      options?: WebSizeOptions | SpringName,
    ) {
      const el = element(target.value)
      return owned(el).animateSize(el, values, changeOrOptions, options)
    },
    animateLayout(
      changeOrOptions?: (() => void) | WebLayoutOptions | SpringName,
      options?: WebLayoutOptions | SpringName,
    ) {
      const el = element(target.value)
      return owned(el).animateLayout(el, changeOrOptions, options)
    },
    press(values?: Values, config?: WebPressOptions) {
      const el = element(target.value)
      return owned(el).press(el, values, config)
    },
    stop(properties?: readonly KeyframeProperty[], config?: { layer?: string }) {
      const el = element(target.value)
      if (options.runtime)
        for (const handle of handles.get(el) ?? []) handle.stop(properties, config)
      else context(el).stop(el, properties, config)
    },
    configure(config: WebConfig) {
      if (disposed) throw new Error('Web motion scope has been disposed.')
      if (options.runtime)
        throw new Error('Configure a borrowed runtime through its host owner.')
      for (const runtime of contexts.values()) runtime.configure(config)
      settings = { ...settings, ...config }
    },
  }
}

/** Retained DOM drawing; borrows an optional runtime without disposing its owner. */
export function useShape(options: WebShapeOptions, context: WebMotionOptions = {}) {
  const target = shallowRef<HTMLElement | null>(null)
  const motion = useWebMotion(target, context)
  let drawing: WebShape | undefined
  motion.resource((_scope, element, runtime) => {
    drawing = runtime.shape(element, { ...options, unload: options.unload ?? 'pause' })
    return drawing
  })
  return {
    ref(element: Element | ComponentPublicInstance | null) {
      const node = element && ('$el' in element ? element.$el : element)
      if (node) {
        const view = node.ownerDocument?.defaultView as
          (Window & typeof globalThis) | undefined
        if (!view || !(node instanceof view.HTMLElement))
          throw new TypeError(
            'useShape needs an HTMLElement or a component with one root HTMLElement.',
          )
      }
      target.value = node as HTMLElement | null
    },
    get current(): WebShape | undefined {
      return drawing?.disposed ? undefined : drawing
    },
  }
}

/** SSR starts at false; after mount observe the effective preference of one runtime. */
export function useReducedMotion(borrowed?: WebRuntime): Readonly<Ref<boolean>> {
  if (!getCurrentScope()) throw new Error('useReducedMotion requires a Vue setup scope.')
  const instance = getCurrentInstance()
  if (!instance && !borrowed)
    throw new Error('Pass a runtime outside a mounted Vue component.')
  const value = shallowRef(borrowed?.reducedMotion() ?? false)
  let owned: WebRuntime | undefined,
    off: (() => void) | undefined,
    disposed = false
  const start = () => {
    if (disposed) return
    off?.()
    const runtime =
      borrowed ??
      (owned ??= createWebRuntime(instance!.vnode.el?.ownerDocument ?? document))
    value.value = runtime.reducedMotion()
    off = runtime.onReducedMotion((reduced) => {
      value.value = reduced
    })
  }
  if (instance) {
    onMounted(start)
    onActivated(start)
    onDeactivated(() => {
      off?.()
      off = undefined
    })
  } else start()
  onScopeDispose(() => {
    disposed = true
    off?.()
    owned?.dispose()
  })
  return readonly(value)
}
