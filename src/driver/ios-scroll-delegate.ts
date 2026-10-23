import type { ScrollView } from '@nativescript/core'

/** Preserve Core's lazy scroll listener attach/detach without adding a JS scroll observer. */
export function retainScrollDelegate(scroll: ScrollView, refresh: () => void) {
  const host = scroll as ScrollView & { attachNative(): void; detachNative(): void }
  const restore: (() => void)[] = []
  for (const key of ['attachNative', 'detachNative'] as const) {
    const original = host[key]
    if (typeof original !== 'function') continue
    const descriptor = Object.getOwnPropertyDescriptor(host, key)
    const wrapper = function (this: typeof host) {
      original.call(this)
      refresh()
    }
    host[key] = wrapper
    restore.push(() => {
      if (host[key] !== wrapper) return
      if (descriptor) Object.defineProperty(host, key, descriptor)
      else delete (host as Partial<typeof host>)[key]
    })
  }
  return () => restore.forEach((action) => action())
}
