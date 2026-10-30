import {
  Color,
  GridLayout,
  Label,
  StackLayout,
  ListView,
  eachDescendant,
  isIOS,
  Utils,
  type ItemEventData,
  type View,
} from '@nativescript/core'
import { markRaw, registerElement } from 'nativescript-vue'
registerElement('ScrollHeaderList', () => ListView)
// A retained overlay can be taller than the viewport. Measure its complete
// content; the list's spacer and the clipped host supply scrolling/visibility.
let nativeHeader: typeof org.nativescript.widgets.StackLayout | undefined
class AlbumHeader extends StackLayout {
  onMeasure(width: number, height: number) {
    super.onMeasure(
      width,
      isIOS ? Utils.layout.makeMeasureSpec(0, Utils.layout.UNSPECIFIED) : height,
    )
  }
  createNativeView() {
    if (isIOS) return super.createNativeView()
    if (!nativeHeader) {
      @NativeClass()
      class Header extends org.nativescript.widgets.StackLayout {
        constructor(context: android.content.Context) {
          super(context)
          return (globalThis as any).__native(this)
        }
        onMeasure(width: number, _height: number) {
          super.onMeasure(
            width,
            android.view.View.MeasureSpec.makeMeasureSpec(
              0,
              android.view.View.MeasureSpec.UNSPECIFIED,
            ),
          )
        }
      }
      nativeHeader = Header
    }
    return new nativeHeader(this._context)
  }
}
registerElement('ScrollHeaderHero', () => AlbumHeader)
// Core's Android labels use SP, but retained TextViews need setTextSize again
// after an in-place fontScale configuration change. Keep Android's conversion
// (including nonlinear scaling) rather than multiplying sizes ourselves.
export function refreshAlbumText(root: View) {
  if (isIOS) return
  eachDescendant(root, (child) => {
    if (child instanceof Label && child.android && typeof child.fontSize === 'number') {
      child.android.setTextSize(child.fontSize)
      child.requestLayout()
    }
    return true
  })
}
export interface AlbumTrack {
  key: string
  title: string
  duration: string
  spacer?: boolean
}
class CellColor extends Color {
  constructor(value: string) {
    super(value)
    if (isIOS)
      Object.defineProperty(this, 'ios', {
        get: () =>
          UIColor.colorWithRedGreenBlueAlpha(
            this.r / 255,
            this.g / 255,
            this.b / 255,
            this.a / 255,
          ),
      })
  }
}
const slots = new WeakMap<
  GridLayout,
  { number: Label; title: Label; time: Label; key?: string }
>()
export function loadAlbumCell(
  event: ItemEventData,
  spacer: number,
  t: (s: string) => string,
  select: (key: string) => void,
) {
  const item = ((event.object as ListView).items as AlbumTrack[])[event.index]!
  if (item.spacer) {
    const view =
      event.view instanceof StackLayout ? event.view : markRaw(new StackLayout())
    view.height = spacer
    view.minHeight = spacer
    view.maxHeight = spacer
    view.accessible = false
    view.isUserInteractionEnabled = false
    event.view = view
    return
  }
  let row = event.view as GridLayout | undefined
  if (!row || !slots.has(row)) {
    row = markRaw(new GridLayout())
    row.columns = 'auto,*,auto'
    row.height = 76
    row.minHeight = 76
    row.maxHeight = 76
    row.padding = '0 22'
    row.backgroundColor = new CellColor('#F4F0E7')
    const number = markRaw(new Label())
    number.color = new CellColor('#8D9486')
    number.fontSize = 12
    number.marginRight = 12
    number.verticalAlignment = 'middle'
    const stack = markRaw(new StackLayout())
    stack.col = 1
    stack.verticalAlignment = 'middle'
    const title = markRaw(new Label())
    title.color = new CellColor('#193D34')
    title.fontSize = 17
    title.fontWeight = '600'
    const byline = markRaw(new Label())
    byline.text = t('NOVA · STUDIO SESSIONS')
    byline.color = new CellColor('#7B8476')
    byline.fontSize = 9
    byline.marginTop = 5
    byline.letterSpacing = 0.08
    stack.addChild(title)
    stack.addChild(byline)
    const time = markRaw(new Label())
    time.col = 2
    time.color = new CellColor('#8D9486')
    time.fontSize = 12
    time.marginLeft = 12
    time.textAlignment = 'right'
    time.verticalAlignment = 'middle'
    row.addChild(number)
    row.addChild(stack)
    row.addChild(time)
    const slot = { number, title, time, key: undefined as string | undefined }
    slots.set(row, slot)
    row.on('tap', () => {
      if (slot.key) select(slot.key)
    })
  }
  const slot = slots.get(row)!
  slot.key = item.key
  slot.number.text = String(event.index).padStart(2, '0')
  slot.title.text = t(item.title)
  slot.time.text = item.duration
  row.automationText = 'scroll-track-' + item.key
  row.accessibilityRole = 'button'
  row.accessibilityLabel = t('Play {0}').replace('{0}', t(item.title))
  refreshAlbumText(row)
  event.view = row
}
