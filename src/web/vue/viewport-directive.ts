import type { ObjectDirective } from 'vue'
import {
  createWebRuntime,
  type RuntimeOptions,
  type WebRuntime,
  type WebViewportOptions,
  type WebMotionScope,
  type WebViewportEntrance,
} from '../public.js'
import { observeConnection } from './attachment.js'

export interface WebViewportDirectiveOptions {
  /** A borrowed application context; cleanup only releases this directive's work. */
  runtime?: WebRuntime
  config?: RuntimeOptions
  viewport?: WebViewportOptions
}

/** Create per application (including each SSR request), then register on plain HTML.
 * Mounted does not imply in-document: Nuxt/Suspense can mount in a detached tree. */
export function createViewportEnterDirective(
  options: WebViewportDirectiveOptions = {},
): ObjectDirective<HTMLElement, WebViewportOptions | undefined> {
  const contexts = new Map<Document, { runtime: WebRuntime; users: number }>()
  type Record = { update(value: WebViewportOptions | undefined): void; dispose(): void }
  const records = new WeakMap<HTMLElement, Record>()
  function mount(element: HTMLElement, value: WebViewportOptions | undefined) {
    records.get(element)?.dispose()
    const document = element.ownerDocument
    let context = contexts.get(document)
    if (!context) {
      context = {
        runtime: options.runtime ?? createWebRuntime(document, options.config),
        users: 0,
      }
      contexts.set(document, context)
    }
    const runtime = context.runtime
    const lifetime = runtime.scope()
    context.users++
    let setup: WebMotionScope | undefined,
      disposed = false,
      current = value
    let entrance: WebViewportEntrance | undefined,
      completed = false
    const clear = () => {
      completed ||= !!entrance?.completed
      setup?.dispose()
      setup = undefined
      entrance = undefined
    }
    const start = (connected: boolean) => {
      clear()
      if (!connected || disposed || lifetime.disposed) return
      if (completed && (current?.once ?? options.viewport?.once ?? true)) return
      setup = lifetime.scope()
      try {
        entrance = setup.viewportEnter(element, { ...options.viewport, ...current })
      } catch (error) {
        lifetime.dispose()
        throw error
      }
    }
    const attachment = observeConnection(element, start)
    const record: Record = {
      update(next) {
        if (disposed || next === current) return
        clear()
        completed = false
        current = next
        start(element.isConnected && element.ownerDocument === document)
      },
      dispose() {
        lifetime.dispose()
      },
    }
    records.set(element, record)
    lifetime.add(() => {
      if (disposed) return
      disposed = true
      attachment.dispose()
      clear()
      records.delete(element)
      if (!options.runtime) runtime.release(element)
      context!.users--
      if (!context!.users) {
        contexts.delete(document)
        if (!options.runtime) runtime.dispose()
      }
    })
  }
  return {
    mounted: (el, binding) => mount(el, binding.value),
    updated: (el, binding) => records.get(el)?.update(binding.value),
    beforeUnmount: (el) => records.get(el)?.dispose(),
    // SSR deliberately emits no hidden style or runtime side effect.
    getSSRProps: () => ({}),
  }
}
