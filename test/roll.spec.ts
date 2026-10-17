import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rollTo, type Animation, type RollOptions } from '../src/index.js'
import { diffFromEnd, graphemes } from '../src/roll-diff.js'
import type { TextPiece } from '../src/text-layout.js'
import { Application, Label, Observable, Utils } from './shims/core.js'
import { createView, flush, state } from './helpers.js'
const platform = vi.hoisted(() => ({ isIOS: true, isAndroid: false }))
const layout = vi.hoisted(() => ({ supported: true, call: vi.fn() }))
vi.mock('@nativescript/core', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  get isIOS() {
    return platform.isIOS
  },
  get isAndroid() {
    return platform.isAndroid
  },
}))
vi.mock('../src/text-layout.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  textLayer: (native: NativeLabel, by: string) => {
    layout.call(native, by)
    if (!layout.supported) return undefined
    const text = native.attributedText?.string ?? native.text
    const pieces: TextPiece[] = []
    const layer = new Layer()
    layer.name = 'jolt:text'
    let offset = 0
    for (const character of text) {
      if (character.trim()) {
        pieces.push({ text: character, location: offset, length: character.length })
        const piece = new Layer()
        piece.text = character
        layer.addSublayer(piece)
      }
      offset += character.length
    }
    return { text, layer: pieces.length ? layer : undefined, pieces }
  },
}))
const rect = (width = 200, height = 60) => ({
  origin: { x: 0, y: 0 },
  size: { width, height },
})
class Layer {
  name = ''
  text = ''
  frame = rect()
  masksToBounds = false
  opacity = 1
  transform: unknown = undefined
  children: Layer[] = []
  parent: Layer | undefined
  animations = new Map<string, any>()
  get sublayers() {
    const items = this.children
    return { count: items.length, objectAtIndex: (i: number) => items[i]! }
  }
  addSublayer(layer: Layer) {
    this.children.push(layer)
    layer.parent = this
  }
  removeFromSuperlayer() {
    if (this.parent)
      this.parent.children = this.parent.children.filter((layer) => layer !== this)
    this.parent = undefined
  }
  addAnimationForKey(animation: unknown, key: string) {
    this.animations.set(key, animation)
  }
  removeAnimationForKey(key: string) {
    const animation = this.animations.get(key)
    this.animations.delete(key)
    animation?.delegate?.animationDidStopFinished(animation, false)
  }
}
class Color {
  constructor(readonly name: string) {}
  isEqual(other: unknown) {
    return other instanceof Color && other.name === this.name
  }
}
const clear = new Color('clear')
class AttributedString {
  constructor(
    public string: string,
    public attributes = new Map<string, unknown>(),
  ) {}
  get length() {
    return this.string.length
  }
  replaceCharactersInRangeWithString(_range: unknown, text: string) {
    this.string = text
  }
  addAttributeValueRange(key: string, value: unknown) {
    this.attributes.set(key, value)
  }
  removeAttributeRange(key: string) {
    this.attributes.delete(key)
  }
  attributeAtIndexEffectiveRange(key: string) {
    return this.attributes.get(key) ?? null
  }
  enumerateAttributeInRangeOptionsUsingBlock(
    key: string,
    range: unknown,
    _options: unknown,
    block: (value: unknown, range: unknown) => void,
  ) {
    block(this.attributes.get(key) ?? null, range)
  }
  isEqual(other: unknown) {
    return other === this
  }
}
const foreground = 'NSForegroundColorAttributeName'
const font = (descriptor = 'system') => ({
  descriptor,
  lineHeight: 40,
  pointSize: 32,
  fontDescriptor: { fontDescriptorByAddingAttributes: () => 'tabular' },
})
/** Like UILabel: plain text reads back as a fresh attributed copy, and textColor paints the whole string. */
class NativeLabel {
  bounds = rect()
  window: object | null = {}
  layer = new Layer()
  font = font()
  shadowColor: Color | null = null
  accessibilityLabel: string | null = null
  private content = ''
  private color: Color | null = new Color('ink')
  private attributes = new Map<string, unknown>([[foreground, this.color]])
  get text() {
    return this.content
  }
  set text(text: string) {
    this.content = text
    this.attributes = new Map([[foreground, this.color]])
  }
  get textColor() {
    return this.color
  }
  set textColor(color: Color | null) {
    this.color = color
    this.attributes.set(foreground, color)
  }
  get attributedText() {
    return new AttributedString(this.content, new Map(this.attributes))
  }
  set attributedText(text: AttributedString) {
    this.content = text.string
    this.attributes = new Map(text.attributes)
    this.color = (this.attributes.get(foreground) as Color | null) ?? null
  }
}
class NativeTextView {
  private content = ''
  lineHeight = 48
  getText() {
    const text = this.content
    return { toString: () => text }
  }
  setText(text: string) {
    this.content = text
  }
  getLineHeight() {
    return this.lineHeight
  }
}
class NumberRoll {
  static instances: NumberRoll[] = []
  static supported = true
  static Callback = class {
    constructor(readonly implementation: { onEnd(finished: boolean): void }) {}
  }
  started = false
  cancelled = false
  readonly args: unknown[]
  constructor(...args: unknown[]) {
    this.args = args
    NumberRoll.instances.push(this)
  }
  isSupported() {
    return NumberRoll.supported
  }
  start() {
    this.started = true
  }
  cancel() {
    this.cancelled = true
  }
  get callback() {
    return (this.args.at(-1) as InstanceType<typeof NumberRoll.Callback>).implementation
  }
}
const handles: Animation[] = []
function target(text = '1249.90') {
  const view = new Label()
  view.text = text
  const native = new NativeLabel()
  native.text = text
  view.nativeViewProtected = native
  return { view: view as unknown as import('@nativescript/core').Label, native }
}
function androidTarget(text = '1249.90') {
  const view = new Label()
  view.text = text
  const native = new NativeTextView()
  native.setText(text)
  view.nativeViewProtected = native
  return { view: view as unknown as import('@nativescript/core').Label, native }
}
function roll(
  view: Parameters<typeof rollTo>[0],
  value: number | string,
  options?: RollOptions,
) {
  const handle = rollTo(view, value, options)
  handles.push(handle)
  return handle
}
function pieces(native: NativeLabel) {
  const container = native.layer.children.find((layer) => layer.name === 'jolt:roll')
  const all = container?.children.flatMap((layer) => layer.children) ?? []
  const animated = all.filter((piece) => piece.animations.has('jolt:roll'))
  return {
    container,
    all,
    incoming: animated.filter((piece) => piece.opacity === 1),
    outgoing: animated.filter((piece) => piece.opacity === 0),
    still: all.filter((piece) => !piece.animations.has('jolt:roll')),
  }
}
function complete(native: NativeLabel, finished = true) {
  const { all } = pieces(native)
  const group = all
    .map((piece) => piece.animations.get('jolt:roll'))
    .find((animation) => animation?.delegate)
  group.delegate.animationDidStopFinished(group, finished)
}
function event(view: { notify(data: any): void }, eventName: string) {
  view.notify({ eventName, object: view })
}
let createDescriptor: PropertyDescriptor | undefined
beforeEach(() => {
  platform.isIOS = true
  platform.isAndroid = false
  layout.supported = true
  layout.call.mockClear()
  NumberRoll.instances = []
  NumberRoll.supported = true
  vi.useFakeTimers()
  vi.stubGlobal('UILabel', NativeLabel)
  vi.stubGlobal('UIColor', { clearColor: clear })
  vi.stubGlobal('UIFont', {
    fontWithDescriptorSize: (descriptor: string) => font(descriptor),
  })
  vi.stubGlobal('NSDictionary', {
    dictionaryWithObjectsForKeys: (objects: unknown[], keys: unknown[]) => ({
      objects,
      keys,
    }),
    dictionaryWithObjectForKey: (object: unknown, key: unknown) => ({ object, key }),
  })
  vi.stubGlobal('UIFontFeatureTypeIdentifierKey', 'type')
  vi.stubGlobal('UIFontFeatureSelectorIdentifierKey', 'selector')
  vi.stubGlobal('UIFontDescriptorFeatureSettingsAttribute', 'features')
  vi.stubGlobal('NSMutableAttributedString', {
    alloc: () => ({
      initWithAttributedString: (source: AttributedString) =>
        new AttributedString(source.string, new Map(source.attributes)),
    }),
  })
  vi.stubGlobal('NSShadow', { new: () => ({ shadowColor: undefined }) })
  for (const key of [
    'NSForegroundColorAttributeName',
    'NSStrokeColorAttributeName',
    'NSUnderlineColorAttributeName',
    'NSStrikethroughColorAttributeName',
    'NSShadowAttributeName',
  ])
    vi.stubGlobal(key, key)
  vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => false)
  vi.stubGlobal('UIAccessibilityReduceMotionStatusDidChangeNotification', 'reduce-motion')
  vi.stubGlobal('CATransaction', {
    begin: vi.fn(),
    commit: vi.fn(),
    setDisableActions: vi.fn(),
  })
  vi.stubGlobal('CALayer', { new: () => new Layer() })
  vi.stubGlobal('CATransform3DMakeTranslation', (x: number, y: number, z: number) => ({
    x,
    y,
    z,
  }))
  vi.stubGlobal('CAKeyframeAnimation', {
    animationWithKeyPath: (keyPath: string) => ({ keyPath }),
  })
  vi.stubGlobal('CAAnimationGroup', { new: () => ({}) })
  vi.stubGlobal('NSArray', { arrayWithArray: (values: unknown[]) => values })
  vi.stubGlobal('CACurrentMediaTime', () => 100)
  vi.stubGlobal('kCAFillModeBackwards', 'backwards')
  vi.stubGlobal('CAAnimationDelegate', {})
  vi.stubGlobal(
    'NSObject',
    class {
      static new() {
        return new this()
      }
      static extend(methods: object) {
        class Delegate extends this {}
        Object.assign(Delegate.prototype, methods)
        return Delegate
      }
    },
  )
  vi.stubGlobal('android', {
    widget: { TextView: NativeTextView },
    animation: { ValueAnimator: { areAnimatorsEnabled: () => true } },
    os: { Build: { VERSION: { SDK_INT: 34 } } },
  })
  vi.stubGlobal('java', { lang: { String: 'java.lang.String' } })
  vi.stubGlobal('org', { rafaelaugusto: { jolt: { NumberRoll } } })
  createDescriptor = Object.getOwnPropertyDescriptor(Array, 'create')
  Object.defineProperty(Array, 'create', {
    configurable: true,
    value: (_type: unknown, length: number) => Array.from({ length }),
  })
})
afterEach(() => {
  handles.splice(0).forEach((handle) => handle.stop())
  expect(Application.ios.observers.size).toBe(0)
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (createDescriptor) Object.defineProperty(Array, 'create', createDescriptor)
  else Reflect.deleteProperty(Array, 'create')
})

describe('right-aligned diff', () => {
  it('keeps composed characters together', () => {
    expect(graphemes('é👩🏽‍💻1')).toEqual([
      { text: 'é', start: 0, end: 1 },
      { text: '👩🏽‍💻', start: 1, end: 8 },
      { text: '1', start: 8, end: 9 },
    ])
  })
  it('rolls only the positions that differ from the end', () => {
    const { changes, removed } = diffFromEnd('1249.9', '1250.0')
    expect(removed).toEqual([])
    expect(
      changes.map(({ next, previous }) => [next.text, next.start, previous?.text]),
    ).toEqual([
      ['0', 5, '9'],
      ['0', 3, '9'],
      ['5', 2, '4'],
    ])
  })
  it('rolls new leading digits in and surplus old ones out', () => {
    const grown = diffFromEnd('99', '100')
    expect(
      grown.changes.map(({ next, previous }) => [next.text, previous?.text]),
    ).toEqual([
      ['0', '9'],
      ['0', '9'],
      ['1', undefined],
    ])
    expect(grown.removed).toEqual([])
    const shrunk = diffFromEnd('100', '99')
    expect(
      shrunk.changes.map(({ next, previous }) => [next.text, previous?.text]),
    ).toEqual([
      ['9', '0'],
      ['9', '0'],
    ])
    expect(shrunk.removed).toEqual([{ text: '1', start: 0, end: 1 }])
    expect(diffFromEnd('42', '42')).toEqual({ changes: [], removed: [] })
  })
})

describe('rolling numbers on iOS', () => {
  it('sets the final text at once and rolls the changed digits with the spring', async () => {
    const { view, native } = target()
    const handle = roll({ nativeView: view }, 1250, {
      format: (value) => value.toFixed(2),
      duration: 500,
      bounce: 0,
    })
    const done = state(handle.finished)
    expect(view.text).toBe('1250.00')
    expect(native.text).toBe('1250.00')
    await flush()
    expect(layout.call.mock.calls.map(([label]) => label)).toEqual([native, native])
    expect(native.textColor).toBe(clear)
    expect(native.font).toMatchObject({ descriptor: 'tabular', pointSize: 32 })
    const { container, incoming, outgoing, still } = pieces(native)
    expect(container?.masksToBounds).toBe(true)
    expect(container?.frame).toEqual(rect())
    expect(incoming.map((piece) => piece.text)).toEqual(['5', '0', '0'])
    expect(outgoing.map((piece) => piece.text)).toEqual(['4', '9', '9'])
    expect(still.map((piece) => piece.text)).toEqual(['1', '2', '.', '0'])
    for (const piece of incoming) {
      const group = piece.animations.get('jolt:roll')
      expect(group.beginTime).toBe(100)
      expect(group.fillMode).toBe('backwards')
      const [opacity, move] = group.animations
      expect(move.keyPath).toBe('transform.translation.y')
      expect(move.values[0]).toBe(40)
      expect(move.values.at(-1)).toBe(0)
      expect(move.keyTimes[0]).toBe(0)
      expect(move.keyTimes.at(-1)).toBe(1)
      expect(opacity.values[0]).toBe(0)
      expect(opacity.values.at(-1)).toBe(1)
      expect(opacity.duration).toBe(0.25)
      expect(group.duration).toBe(move.duration)
    }
    for (const piece of outgoing) {
      const [opacity, move] = piece.animations.get('jolt:roll').animations
      expect(piece.transform).toEqual({ x: 0, y: -40, z: 0 })
      expect(move.values[0]).toBe(0)
      expect(move.values.at(-1)).toBe(-40)
      expect(opacity.values[0]).toBe(1)
      expect(opacity.values.at(-1)).toBe(0)
    }
    expect(Application.ios.observers.size).toBe(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(done()).toBeUndefined()
    complete(native)
    expect(await handle).toBe(true)
    expect(native.textColor?.name).toBe('ink')
    expect(native.layer.children).toHaveLength(0)
    expect(native.text).toBe('1250.00')
  })
  it('rolls down to a lower number and follows an explicit direction', async () => {
    const { view, native } = target('100')
    roll(view, 99)
    await flush()
    const { incoming, outgoing } = pieces(native)
    expect(incoming.map((piece) => piece.text)).toEqual(['9', '9'])
    expect(outgoing.map((piece) => piece.text)).toEqual(['1', '0', '0'])
    for (const piece of incoming)
      expect(piece.animations.get('jolt:roll').animations[1].values[0]).toBe(-40)
    for (const piece of outgoing) expect(piece.transform).toEqual({ x: 0, y: 40, z: 0 })
    complete(native)
    roll(view, 100, { direction: 'down' })
    await flush()
    expect(pieces(native).outgoing[0]!.transform).toEqual({ x: 0, y: 40, z: 0 })
    complete(native)
    roll(view, 'ninety', { tabular: false })
    await flush()
    expect(
      pieces(native).incoming[0]!.animations.get('jolt:roll').animations[1].values[0],
    ).toBe(40)
    expect(native.font.descriptor).toBe('tabular')
  })
  it('remembers the last number so formatted text does not decide the direction', async () => {
    const { view, native } = target('$1')
    roll(view, 2, { format: (value) => `$${value}` })
    await flush()
    complete(native)
    roll(view, 1, { format: (value) => `$${value}` })
    await flush()
    expect(pieces(native).outgoing[0]!.transform).toEqual({ x: 0, y: 40, z: 0 })
  })
  it('staggers changed positions from the right, then the ones rolling out', async () => {
    const { view, native } = target('100')
    roll(view, 9, { stagger: 50, delay: 200 })
    await flush()
    const { incoming, outgoing } = pieces(native)
    expect(incoming[0]!.animations.get('jolt:roll').beginTime).toBe(100.2)
    expect(outgoing.map((piece) => piece.animations.get('jolt:roll').beginTime)).toEqual([
      100.3, 100.25, 100.2,
    ])
    expect(outgoing[0]!.animations.get('jolt:roll').delegate).toBeDefined()
    expect(outgoing[2]!.animations.get('jolt:roll').delegate).toBeUndefined()
  })
  it('completes at once when nothing changes and stops on request', async () => {
    const { view, native } = target('42')
    expect(await roll(view, 42)).toBe(true)
    expect(layout.call).not.toHaveBeenCalled()
    const handle = roll(view, 43)
    await flush()
    expect(native.textColor).toBe(clear)
    handle.stop()
    expect(await handle).toBe(false)
    expect(native.textColor?.name).toBe('ink')
    expect(native.layer.children).toHaveLength(0)
    expect(view.text).toBe('43')
  })
  it('starts the next roll from the text the previous one settled on', async () => {
    const { view, native } = target('1')
    const first = roll(view, 2)
    await flush()
    const second = roll(view, 3)
    expect(await first).toBe(false)
    await flush()
    expect(pieces(native).outgoing.map((piece) => piece.text)).toEqual(['2'])
    expect(native.layer.children).toHaveLength(1)
    complete(native)
    expect(await second).toBe(true)
  })
  it('replaces a formatted text with the rolled text', async () => {
    const { view, native } = target('7')
    const formatted = new Observable()
    view.formattedText = formatted as never
    roll(view, 8)
    expect(view.formattedText).toBeUndefined()
    expect(native.text).toBe('8')
  })
  it('keeps app changes made during the roll', async () => {
    const { view, native } = target('1')
    const handle = roll(view, 2)
    await flush()
    native.textColor = new Color('red')
    event(view.style, 'colorChange')
    expect(await handle).toBe(false)
    expect(native.textColor?.name).toBe('red')
    const next = roll(view, 3)
    await flush()
    expect(native.textColor).toBe(clear)
    view.text = '9'
    expect(await next).toBe(false)
    expect(native.text).toBe('9')
    expect(native.textColor?.name).toBe('red')
    expect(native.attributedText.attributes.get(foreground)).toBe(native.textColor)
    expect(native.layer.children).toHaveLength(0)
  })
  it('follows the label bounds and releases on unload or a new native view', async () => {
    const { view, native } = target('1')
    const handle = roll(view, 2)
    await flush()
    native.bounds = rect(260)
    event(view, 'layoutChanged')
    expect(pieces(native).container?.frame).toEqual(rect(260))
    view.nativeViewProtected = new NativeLabel()
    event(view, 'layoutChanged')
    expect(await handle).toBe(false)
    expect(native.layer.children).toHaveLength(0)
    const again = roll(view, 3)
    await flush()
    event(view, 'unloaded')
    expect(await again).toBe(false)
  })
  it('waits for load, then hides the text through its attributes and keeps other styles', async () => {
    const { view, native } = target('5')
    Object.assign(view, { isLoaded: false })
    const handle = roll(view, 6)
    expect(native.attributedText.string).toBe('6')
    native.attributedText = new AttributedString(
      '6',
      new Map<string, unknown>([
        [foreground, new Color('ink')],
        ['NSKernAttributeName', 2],
      ]),
    )
    await flush()
    expect(layout.call).not.toHaveBeenCalled()
    Object.assign(view, { isLoaded: true })
    event(view, 'loaded')
    await flush()
    expect(layout.call).toHaveBeenCalledTimes(2)
    expect(native.attributedText.attributes.get(foreground)).toBe(clear)
    expect(native.attributedText.attributes.get('NSShadowAttributeName')).toBeDefined()
    expect(native.attributedText.attributes.get('NSKernAttributeName')).toBe(2)
    expect(pieces(native).outgoing.map((piece) => piece.text)).toEqual(['5'])
    complete(native)
    expect(await handle).toBe(true)
    expect(native.attributedText.string).toBe('6')
    expect((native.attributedText.attributes.get(foreground) as Color).name).toBe('ink')
    expect(native.attributedText.attributes.has('NSShadowAttributeName')).toBe(false)
    expect(native.attributedText.attributes.get('NSKernAttributeName')).toBe(2)
  })
  it('shows the text again although UIKit returns a new attributed copy on every read', async () => {
    const { view, native } = target('1')
    expect(native.attributedText).not.toBe(native.attributedText)
    const handle = roll(view, 2)
    await flush()
    expect(native.attributedText.attributes.get(foreground)).toBe(clear)
    complete(native)
    expect(await handle).toBe(true)
    expect((native.attributedText.attributes.get(foreground) as Color).name).toBe('ink')
    expect(native.textColor?.name).toBe('ink')
    const stopped = roll(view, 3)
    await flush()
    expect(native.attributedText.attributes.get(foreground)).toBe(clear)
    stopped.stop()
    expect(await stopped).toBe(false)
    expect((native.attributedText.attributes.get(foreground) as Color).name).toBe('ink')
    expect(native.attributedText.string).toBe('3')
  })
  it('shows the final text at once under Reduce Motion', async () => {
    const { view, native } = target('1')
    vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => true)
    expect(await roll(view, 2)).toBe(true)
    expect(native.text).toBe('2')
    expect(layout.call).not.toHaveBeenCalled()
    vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => false)
    const handle = roll(view, 3)
    await flush()
    vi.stubGlobal('UIAccessibilityIsReduceMotionEnabled', () => true)
    for (const callback of [...Application.ios.observers.keys()]) callback()
    expect(await handle).toBe(true)
    expect(native.textColor?.name).toBe('ink')
  })
  it.each(['unsupported', 'hidden', 'error'] as const)(
    'leaves the final text in place for %s',
    async (reason) => {
      const { view, native } = target('1')
      if (reason === 'unsupported') layout.supported = false
      if (reason === 'hidden') view.visibility = 'hidden'
      if (reason === 'error')
        layout.call.mockImplementationOnce(() => {
          throw new Error('Snapshot failed')
        })
      const handle = roll(view, 2)
      await flush()
      expect(await handle).toBe(false)
      expect(native.text).toBe('2')
      expect(native.textColor?.name).toBe('ink')
      expect(native.layer.children).toHaveLength(0)
    },
  )
  it('rejects invalid input without touching a running roll', async () => {
    const { view, native } = target('1')
    const handle = roll(view, 2)
    await flush()
    for (const options of [
      { duration: 0 },
      { bounce: 2 },
      { stagger: -1 },
      { delay: NaN },
      { direction: 'left' },
      { format: 'fixed' },
    ])
      expect(() => rollTo(view, 3, options as never)).toThrow()
    expect(() => rollTo(view, 3, { format: () => 3 as never })).toThrow('string')
    expect(() => rollTo(createView(), 3)).toThrow('NativeScript Label')
    expect(native.textColor).toBe(clear)
    complete(native)
    expect(await handle).toBe(true)
  })
})

describe('rolling numbers on Android', () => {
  beforeEach(() => {
    platform.isIOS = false
    platform.isAndroid = true
    vi.spyOn(Utils.layout, 'getDisplayDensity').mockReturnValue(2)
  })
  it('hands the changed ranges and spring samples to the native roll', async () => {
    const { view, native } = androidTarget('99')
    const handle = roll(view, 100, { stagger: 30.4, delay: 10, duration: 500, bounce: 0 })
    expect(native.getText().toString()).toBe('100')
    await flush()
    const [instance] = NumberRoll.instances
    expect(instance?.started).toBe(true)
    const [target, starts, ends, previous, direction, times, values] = instance!.args
    expect(target).toBe(native)
    expect(starts).toEqual([2, 1, 0])
    expect(ends).toEqual([3, 2, 1])
    expect(previous).toEqual(['9', '9', ''])
    expect(direction).toBe(1)
    expect((times as number[])[0]).toBe(0)
    expect((times as number[]).at(-1)).toBe(1)
    expect((values as number[])[0]).toBe(48)
    expect((values as number[]).at(-1)).toBe(0)
    const [, , , , , , , duration, delay, stagger, shift, fade, tabular] = instance!.args
    expect(duration).toBeGreaterThan(0)
    expect(delay).toBe(10)
    expect(stagger).toBe(30)
    expect(shift).toBe(48)
    expect(fade).toBe(250)
    expect(tabular).toBe(true)
    instance!.callback.onEnd(true)
    expect(await handle).toBe(true)
    expect(instance!.cancelled).toBe(true)
  })
  it('cancels the native roll on stop and on app changes', async () => {
    const { view } = androidTarget('1')
    const handle = roll(view, 2, { direction: 'down' })
    await flush()
    const [instance] = NumberRoll.instances
    expect(instance!.args[4]).toBe(-1)
    handle.stop()
    expect(instance!.cancelled).toBe(true)
    expect(await handle).toBe(false)
    const next = roll(view, 3)
    await flush()
    event(view, 'textChange')
    expect(await next).toBe(false)
    expect(NumberRoll.instances[1]!.cancelled).toBe(true)
  })
  it('settles on the final text when the native roll is unavailable', async () => {
    const { view, native } = androidTarget('1')
    NumberRoll.supported = false
    expect(await roll(view, 2)).toBe(false)
    expect(native.getText().toString()).toBe('2')
    vi.stubGlobal('org', undefined)
    expect(await roll(view, 3)).toBe(false)
    expect(native.getText().toString()).toBe('3')
    expect(await roll(view, 3)).toBe(true)
  })
  it('skips playback when animators are disabled and when only old digits remain', async () => {
    const { view, native } = androidTarget('12')
    vi.stubGlobal('android', {
      widget: { TextView: NativeTextView },
      animation: { ValueAnimator: { areAnimatorsEnabled: () => false } },
      os: { Build: { VERSION: { SDK_INT: 34 } } },
    })
    expect(await roll(view, 13)).toBe(true)
    expect(NumberRoll.instances).toHaveLength(0)
    expect(native.getText().toString()).toBe('13')
    vi.stubGlobal('android', {
      widget: { TextView: NativeTextView },
      animation: { ValueAnimator: { areAnimatorsEnabled: () => true } },
      os: { Build: { VERSION: { SDK_INT: 34 } } },
    })
    expect(await roll(view, '')).toBe(true)
    expect(NumberRoll.instances).toHaveLength(0)
  })
})
