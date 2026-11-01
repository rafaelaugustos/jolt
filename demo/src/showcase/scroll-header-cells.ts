import {
  Color,
  GridLayout,
  Label,
  StackLayout,
  ListView,
  isIOS,
  Utils,
  type ItemEventData,
} from '@nativescript/core'
import { markRaw, registerElement } from 'nativescript-vue'
import { refreshAndroidText } from './text-scale'
registerElement('ScrollHeaderList', () => ListView)
let nativeViewport: typeof UIView | undefined
class AlbumViewport extends GridLayout {
  scrollTarget?: WeakRef<ListView>
  createNativeView() {
    if (!isIOS) return super.createNativeView()
    if (!nativeViewport) {
      @NativeClass()
      class Viewport extends UIView {
        owner?: WeakRef<AlbumViewport>
        accessibilityScroll(direction: UIAccessibilityScrollDirection) {
          const owner = this.owner?.deref()
          const list = owner?.scrollTarget?.deref()
          if (!list?.isLoaded) return false
          const table = list.ios as UITableView
          const sign =
            direction === UIAccessibilityScrollDirection.Down
              ? 1
              : direction === UIAccessibilityScrollDirection.Up
                ? -1
                : 0
          if (!sign) return false
          const inset = table.adjustedContentInset
          const minimum = -inset.top
          const maximum = Math.max(
            minimum,
            table.contentSize.height + inset.bottom - table.bounds.size.height,
          )
          const next = Math.min(
            maximum,
            Math.max(
              minimum,
              table.contentOffset.y + sign * table.bounds.size.height * 0.75,
            ),
          )
          if (Math.abs(next - table.contentOffset.y) < 0.5) return false
          table.setContentOffsetAnimated(CGPointMake(table.contentOffset.x, next), false)
          owner?.notify({ eventName: 'accessibilityScroll', object: owner, direction })
          return true
        }
      }
      nativeViewport = Viewport
    }
    const view = nativeViewport.new() as UIView & { owner: WeakRef<AlbumViewport> }
    view.owner = new WeakRef(this)
    return view
  }
}
registerElement('ScrollHeaderViewport', () => AlbumViewport)
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
const slots = new WeakMap<GridLayout, { number: Label; title: Label; time: Label }>()
export function loadAlbumCell(
  event: ItemEventData,
  spacer: number,
  t: (s: string) => string,
) {
  const item = ((event.object as ListView).items as AlbumTrack[])[event.index]!
  if (item.spacer) {
    const view =
      event.view instanceof StackLayout ? event.view : markRaw(new StackLayout())
    view.height = spacer
    view.minHeight = spacer
    view.maxHeight = spacer
    view.accessible = false
    view.accessibilityHidden = true
    view.isUserInteractionEnabled = false
    if (isIOS && event.ios) {
      event.ios.isAccessibilityElement = false
      event.ios.contentView.accessibilityElementsHidden = true
    }
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
    const slot = { number, title, time }
    slots.set(row, slot)
  }
  const slot = slots.get(row)!
  slot.number.text = String(event.index).padStart(2, '0')
  slot.title.text = t(item.title)
  slot.time.text = item.duration
  row.automationText = 'scroll-track-' + item.key
  // Android's ListView owns item activation; a focusable root intercepts it.
  row.accessible = false
  row.accessibilityRole = 'button'
  row.accessibilityLabel = t('Play {0}').replace('{0}', t(item.title))
  if (isIOS && event.ios) {
    // Expose the reusable UITableViewCell itself, including its native activation.
    // Rebinding replaces the label/id instead of retaining old accessible subviews.
    const cell = event.ios as UITableViewCell
    cell.isAccessibilityElement = true
    cell.accessibilityLabel = row.accessibilityLabel
    cell.accessibilityIdentifier = row.automationText
    cell.accessibilityTraits = UIAccessibilityTraitButton
    cell.contentView.accessibilityElementsHidden = true
  }
  refreshAndroidText(row)
  event.view = row
}
