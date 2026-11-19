import type { View } from '@nativescript/core'

/** Preserve Core's lazy scroll listener attach/detach without adding a JS scroll observer. */
export function retainScrollDelegate(scroll: View, refresh: () => void) {
  const host = scroll as View & {
    attachNative(): void
    detachNative(): void
    onLayout(...args: number[]): void
  }
  const restore: (() => void)[] = []
  for (const key of ['attachNative', 'detachNative', 'onLayout'] as const) {
    const original = host[key]
    if (typeof original !== 'function') continue
    const descriptor = Object.getOwnPropertyDescriptor(host, key)
    const wrapper = function (this: typeof host, ...args: number[]) {
      original.apply(this, args as [])
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
