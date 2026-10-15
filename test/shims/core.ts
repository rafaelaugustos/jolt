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
  style = new Observable()
  isLoaded = true
  isEnabled = true
  nativeViewProtected: object | undefined = {}
  private visible: 'visible' | 'hidden' | 'collapse' = 'visible'

  get visibility() {
    return this.visible
  }
  set visibility(value: 'visible' | 'hidden' | 'collapse') {
    if (value === this.visible) return
    this.visible = value
    this.style.notify({ eventName: 'visibilityChange', object: this.style })
  }

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

export const textProperty = { setNative: Symbol('text:setNative') }
export const formattedTextProperty = { setNative: Symbol('formattedText:setNative') }

export class Label extends View {
  text = 'Jolt'
  formattedText: (Observable & { toString(): string }) | undefined;
  [textProperty.setNative](_value: unknown) {
    ;(this.nativeViewProtected as { text: string }).text = this.text
  }
  [formattedTextProperty.setNative](_value: unknown) {
    ;(this.nativeViewProtected as { text: string }).text =
      this.formattedText?.toString() ?? ''
  }
}

export const isAndroid = false
export const isIOS = true

export class Color {
  constructor(public value: string) {
    if (!Color.isValid(value)) throw new Error('Invalid color')
  }
  static isValid(value: unknown) {
    return (
      typeof value === 'string' &&
      /^(#[\da-f]{3,8}|white|red|blue|transparent)$/i.test(value)
    )
  }
  get ios() {
    return { CGColor: this.value }
  }
}

export const Application = {
  ios: {
    observers: new Map<() => void, string>(),
    addNotificationObserver(name: string, callback: () => void) {
      this.observers.set(callback, name)
      return callback
    },
    removeNotificationObserver(callback: () => void, _name: string) {
      this.observers.delete(callback)
    },
  },
}

export class ImageSource {
  constructor(public ios: { name: string; symbolImage: boolean } | null) {}

  static fromSystemImageSync(name: string) {
    return name === 'missing' ? null : new ImageSource({ name, symbolImage: true })
  }
}

export class Image extends View {
  loadMode = 'sync'
  isLoading = false
  imageSource: ImageSource | undefined
  private source = ''

  get src() {
    return this.source
  }

  set src(value: string) {
    if (this.source === value) return
    this.source = value
    this.imageSource = ImageSource.fromSystemImageSync(value.slice(6)) ?? undefined
    const native = this.nativeViewProtected as { image: unknown } | undefined
    if (native) {
      native.image = null
      native.image = this.imageSource?.ios
    }
    this.notify({ eventName: 'imageSourceChange', object: this })
    this.notify({ eventName: 'srcChange', object: this })
  }
}

export const Utils = {
  layout: { getDisplayDensity: () => 1 },
}
