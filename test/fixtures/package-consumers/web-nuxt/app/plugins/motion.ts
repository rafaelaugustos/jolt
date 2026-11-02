import type { ObjectDirective } from 'vue'
import * as adapter from '@rafaelaugusto/jolt/web/vue'
import { createWebRuntime, type WebViewportOptions } from '@rafaelaugusto/jolt/web'

export default defineNuxtPlugin((app) => {
  if (import.meta.client)
    app.hook('app:mounted', () => {
      ;(window as unknown as { joltReady: boolean }).joltReady = true
    })
  const runtime = import.meta.client ? createWebRuntime(document) : undefined
  const create = Reflect.get(adapter, 'createViewportEnterDirective') as
    | ((options: object) => ObjectDirective<HTMLElement, WebViewportOptions | undefined>)
    | undefined
  const legacy = new WeakMap<HTMLElement, { dispose(): void }>()
  const directive: ObjectDirective<HTMLElement, WebViewportOptions | undefined> = create
    ? create({
        runtime,
        viewport: {
          keyframes: { opacity: [0.2, 1], y: [24, 0] },
          transition: { duration: 350 },
        },
      })
    : {
        mounted(el) {
          legacy.set(el, runtime!.viewportEnter(el, { keyframes: { opacity: [0.2, 1] } }))
        },
        beforeUnmount(el) {
          legacy.get(el)?.dispose()
        },
        getSSRProps: () => ({}),
      }
  const mounted = directive.mounted
  directive.mounted = (el, binding, vnode, previous) => {
    const probe = window as unknown as { joltMounts?: boolean[] }
    ;(probe.joltMounts ??= []).push(el.isConnected)
    if (typeof mounted === 'function') mounted(el, binding, vnode, previous)
  }
  app.vueApp.directive('enter', directive)
  app.vueApp.onUnmount(() => runtime?.dispose())
  return { provide: { motion: runtime } }
})
