import type { Color as CoreColor } from '@nativescript/core'
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
  parent: View | undefined
  actualSize = { width: 200, height: 200 }
  getActualSize() {
    return this.actualSize
  }
  style = new Observable()
  isLoaded = true
  isEnabled = true
  bindingContext: unknown
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

  backgroundColor: CoreColor | undefined
  color: CoreColor | undefined
  borderTopColor: CoreColor | undefined
  borderRightColor: CoreColor | undefined
  borderBottomColor: CoreColor | undefined
  borderLeftColor: CoreColor | undefined
  set borderColor(value: CoreColor) {
    this.borderTopColor =
      this.borderRightColor =
      this.borderBottomColor =
      this.borderLeftColor =
        value
  }
  get borderColor() {
    return this.borderTopColor!
  }
  borderTopLeftRadius = 0
  borderTopRightRadius = 0
  borderBottomRightRadius = 0
  borderBottomLeftRadius = 0
  borderTopWidth = 0
  borderRightWidth = 0
  borderBottomWidth = 0
  borderLeftWidth = 0
  set borderRadius(value: number) {
    this.borderTopLeftRadius =
      this.borderTopRightRadius =
      this.borderBottomRightRadius =
      this.borderBottomLeftRadius =
        value
  }
  get borderRadius() {
    return this.borderTopLeftRadius
  }
  set borderWidth(value: number) {
    this.borderTopWidth =
      this.borderRightWidth =
      this.borderBottomWidth =
      this.borderLeftWidth =
        value
  }
  get borderWidth() {
    return this.borderTopWidth
  }
  androidElevation = 0
  boxShadow: {
    color: CoreColor
    inset: boolean
    offsetX: number
    offsetY: number
    blurRadius?: number
    spreadRadius?: number
  }[] = []
  opacity = 1
  translateX = 0
  translateY = 0
  scaleX = 1
  scaleY = 1
  rotate = 0
  rotateX = 0
  rotateY = 0

  originX = 0.5
  originY = 0.5
  children: View[] = []
  layoutBounds = { left: 0, top: 0, right: 0, bottom: 0 }
  layoutRequests = 0
  requestLayout() {
    this.layoutRequests++
  }
  get isCollapsed() {
    return this.visibility === 'collapse'
  }
  eachChildView(callback: (view: View) => boolean) {
    for (const child of [...this.children]) if (!callback(child)) break
  }

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
export const tintColorProperty = { setNative: Symbol('tintColor:setNative') }

export const colorProperty = { sourceKey: Symbol('color:source') }
export class TextBase extends View {}
export class Button extends TextBase {}
export class Label extends TextBase {
  private content = 'Jolt'
  formattedText: (Observable & { toString(): string }) | undefined
  get text() {
    return this.content
  }
  set text(value: string) {
    if (value === this.content) return
    this.content = value
    const native = this.nativeViewProtected as
      { text?: string; setText?(value: string): void } | undefined
    if (native && !this.formattedText) {
      if (typeof native.setText === 'function') native.setText(value)
      else if ('text' in native) native.text = value
    }
    this.notify({ eventName: 'textChange', object: this, propertyName: 'text', value })
  }
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
export class LayoutBase extends View {
  clipToBounds = false
}
export class GridLayout extends LayoutBase {}

export class ScrollView extends View {
  static scrollEvent = 'scroll'
  horizontalOffset = 0
  verticalOffset = 0
}

export class ListView extends View {
  static itemLoadingEvent = 'itemLoading'
  items: unknown[] = []

  _getDataItem(index: number) {
    return this.items[index]
  }

  _getDataItemInSection(section: number, index: number) {
    return (this.items[section] as { items: unknown[] }).items[index]
  }

  /**
   * Like core: a recycled view is handed to itemLoading, and a cell without one
   * gets a fresh view created and bound after the event.
   */
  realize(index: number, view?: View, section?: number) {
    const args: EventData & { index: number; view?: View; section?: number } = {
      eventName: ListView.itemLoadingEvent,
      object: this,
      index,
      view,
    }
    if (section !== undefined) args.section = section
    this.notify(args)
    const row = args.view ?? new View()
    row.bindingContext =
      section === undefined
        ? this._getDataItem(index)
        : this._getDataItemInSection(section, index)
    if (!this.children.includes(row)) this.children.push(row)
    return row
  }
}

export class Color {
  value: string | number
  argb: number
  constructor(value: string | number) {
    this.value = value
    if (typeof value === 'number') {
      this.argb = value >>> 0
      return
    }
    if (!Color.isValid(value)) throw new Error('Invalid color')
    const named: Record<string, string> = {
      white: '#ffffff',
      black: '#000000',
      red: '#ff0000',
      blue: '#0000ff',
      green: '#008000',
      transparent: '#00000000',
    }
    let hex = (named[value.toLowerCase()] ?? value).slice(1)
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('')
    if (hex.length === 6) hex = 'ff' + hex
    this.argb = parseInt(hex, 16) >>> 0
  }
  static isValid(value: unknown) {
    return (
      typeof value === 'string' &&
      /^(#[\da-f]{3}|#[\da-f]{6}|#[\da-f]{8}|white|black|red|blue|green|transparent)$/i.test(
        value,
      )
    )
  }
  static fromIosColor(value: { CGColor: string | number }) {
    return new Color(value.CGColor)
  }
  get ios() {
    return { CGColor: this.value }
  }
}

export const Trace = {
  write(_message: string, _category: string, _type?: number) {},
  categories: { Error: 'Error' },
  messageType: { error: 1 },
}

export const Application = Object.assign(new Observable(), {
  suspended: false,
  suspendEvent: 'suspend',
  resumeEvent: 'resume',
  launchEvent: 'launch',
  android: {
    foregroundActivity: undefined as unknown,
    startActivity: undefined as unknown,
  },
  ios: {
    window: undefined as unknown,
    observers: new Map<() => void, string>(),
    addNotificationObserver(name: string, callback: () => void) {
      this.observers.set(callback, name)
      return callback
    },
    removeNotificationObserver(callback: () => void, _name: string) {
      this.observers.delete(callback)
    },
  },
})

export class ImageSource {
  width = 200
  height = 100
  rotationAngle = 0
  constructor(public ios: { name: string; symbolImage: boolean } | null) {}

  getNativeSource() {
    return this.ios
  }

  static fromSystemImageSync(name: string) {
    return name === 'missing' ? null : new ImageSource({ name, symbolImage: true })
  }
}

export class Image extends View {
  loadMode = 'sync'
  isLoading = false
  imageSource: ImageSource | undefined
  private source = '';

  [tintColorProperty.setNative](value: unknown) {
    const native = this.nativeViewProtected as { image: { renderingMode: number } | null }
    if (native?.image) native.image.renderingMode = value ? 2 : 0
  }

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
  layout: {
    getDisplayDensity: () => 1,
    toDeviceIndependentPixels: (value: number) => value,
  },
  android: { getApplicationContext: () => ({ getContentResolver: () => 'resolver' }) },
}
