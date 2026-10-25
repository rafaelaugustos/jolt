/** Small cancellation contract that works without browser globals in NativeScript. */
export interface SharedReturnSignal {
  readonly aborted: boolean
  addEventListener(
    type: 'abort',
    listener: () => void,
    options?: { once?: boolean },
  ): void
  removeEventListener(type: 'abort', listener: () => void): void
}
export class ReturnScope {
  private cancelled = false
  private listeners = new Set<() => void>()
  readonly signal: SharedReturnSignal
  constructor() {
    const scope = this
    this.signal = {
      get aborted() {
        return scope.cancelled
      },
      addEventListener(_type, listener) {
        if (!scope.cancelled) scope.listeners.add(listener)
      },
      removeEventListener(_type, listener) {
        scope.listeners.delete(listener)
      },
    }
  }
  abort() {
    if (this.cancelled) return
    this.cancelled = true
    const listeners = [...this.listeners]
    this.listeners.clear()
    for (const listener of listeners)
      try {
        listener()
      } catch {
        /* Observers cannot prevent cleanup. */
      }
  }
}
