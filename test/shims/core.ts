/**
 * A small stand-in for @nativescript/core: views with the properties Jolt
 * animates, events, and a `loaded` state like the real ones.
 */

type Listener = (data: any) => void

export interface EventData {
  eventName: string
  object?: unknown
  [key: string]: unknown
}

export interface TouchGestureEventData extends EventData {
  action: 'down' | 'up' | 'move' | 'cancel'
}

export class Observable {
  private listeners = new Map<string, Set<Listener>>()

  on(event: string, callback: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback?: Listener) {
    if (callback) this.listeners.get(event)?.delete(callback)
    else this.listeners.delete(event)
  }

  notify(data: EventData) {
    for (const callback of [...(this.listeners.get(data.eventName) ?? [])]) callback(data)
  }

  listenerCount(event: string) {
    return this.listeners.get(event)?.size ?? 0
  }
}

export class View extends Observable {
  isLoaded = true
  isEnabled = true
  nativeViewProtected: object | undefined = {}

  opacity = 1
  translateX = 0
  translateY = 0
  scaleX = 1
  scaleY = 1
  rotate = 0
  rotateX = 0
  rotateY = 0

  /** Turns this into a view that hasn't been loaded yet. */
  unload() {
    this.isLoaded = false
    this.nativeViewProtected = undefined
    return this
  }

  load() {
    this.isLoaded = true
    this.nativeViewProtected = {}
    this.notify({ eventName: 'loaded', object: this })
  }

  touch(action: TouchGestureEventData['action']) {
    this.notify({ eventName: 'touch', object: this, action })
  }
}

export const isAndroid = false
export const isIOS = true

export const Utils = {
  layout: { getDisplayDensity: () => 1 },
}
