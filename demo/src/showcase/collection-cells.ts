import {
  Color,
  GridLayout,
  Image,
  isIOS,
  Label,
  ListView,
  StackLayout,
  type ItemEventData,
} from '@nativescript/core'
import { markRaw, registerElement } from 'nativescript-vue'
import { photoTag, type CollectionPhoto } from './photo-collection'

// List cells survive native-view teardown. Obtain the native color when applying
// it instead of reusing a UIColor wrapper cached before that teardown.
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

// Core owns native cell placement/recycling; Vue supplies the current row data.
registerElement('CollectionList', () => ListView)
type Slot = {
  box: StackLayout
  image: Image
  title: Label
  number: Label
  photo?: CollectionPhoto
}
const cells = new WeakMap<GridLayout, Slot[]>()
export function loadCollectionCell(
  event: ItemEventData,
  translate: (text: string) => string,
  open: (image: Image, photo: CollectionPhoto) => void,
) {
  let row = event.view as GridLayout | undefined
  if (!row) {
    row = markRaw(new GridLayout())
    row.columns = '*,*'
    row.padding = '0 6 14'
    const slots: Slot[] = []
    for (let col = 0; col < 2; col++) {
      const box = markRaw(new StackLayout())
      box.col = col
      box.margin = '0 6'
      box.backgroundColor = new CellColor('#E2E6D8')
      box.borderRadius = 18
      const image = markRaw(new Image())
      image.stretch = 'aspectFill'
      image.borderRadius = 18
      image.accessibilityRole = 'button'
      const label = markRaw(new StackLayout())
      label.padding = 12
      const title = markRaw(new Label())
      title.fontSize = 15
      title.fontWeight = '700'
      title.color = markRaw(new CellColor('#193D34'))
      const meta = markRaw(new GridLayout())
      meta.columns = '*,auto'
      meta.marginTop = 5
      const number = markRaw(new Label())
      number.fontSize = 9
      number.color = markRaw(new CellColor('#5C6A5B'))
      const arrow = markRaw(new Label())
      arrow.col = 1
      arrow.text = '↗'
      arrow.fontSize = 15
      arrow.color = markRaw(new CellColor('#193D34'))
      meta.addChild(number)
      meta.addChild(arrow)
      label.addChild(title)
      label.addChild(meta)
      box.addChild(image)
      box.addChild(label)
      row.addChild(box)
      const slot: Slot = { box, image, title, number }
      image.on('tap', () => {
        if (slot.photo) open(image, slot.photo)
      })
      slots.push(slot)
    }
    cells.set(row, slots)
  }
  const photos = ((event.object as ListView).items as CollectionPhoto[][])[event.index]!
  cells.get(row)!.forEach((slot, index) => {
    const photo = photos[index]
    slot.photo = photo
    slot.box.visibility = photo ? 'visible' : 'collapse'
    if (!photo) {
      slot.image.sharedTransitionTag = ''
      return
    }
    slot.image.sharedTransitionTag = photoTag(photo.key)
    slot.image.automationText = `collection-${photo.key}`
    slot.image.accessibilityLabel = translate('Open {0}').replace(
      '{0}',
      translate(photo.title),
    )
    slot.image.src = photo.src
    slot.image.height = photo.height
    slot.title.text = translate(photo.title)
    slot.number.text = photo.key.replace('place-', '').padStart(2, '0')
  })
  event.view = row
}
