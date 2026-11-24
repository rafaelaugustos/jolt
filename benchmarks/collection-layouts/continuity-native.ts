import {
  Application,
  type View,
  Button,
  Color,
  File,
  GridLayout,
  Label,
  Page,
  ScrollView,
  StackLayout,
  knownFolders,
  isIOS,
} from '@nativescript/core'
import { CollectionView } from '@nativescript-community/ui-collectionview'
import { dropZones, listTransferOptions, listTransferScroll } from '@rafaelaugusto/jolt'
import { bottomSheet, GestureSurface } from '../../dist/bottom-sheet/index'
import { scrollHandoff } from '../../dist/gestures/index'

const ink = new Color('#f2f6fb'),
  teal = new Color('#28675e'),
  blue = new Color('#334b6e')
function label(text: string, background = blue) {
  const view = new Label()
  view.text = view.automationText = text
  view.backgroundColor = background
  view.color = ink
  view.padding = 12
  return view
}
export function runCollectionContinuity() {
  Application.run({
    create() {
      const page = new Page(),
        root = new GridLayout(),
        nav = new StackLayout(),
        host = new GridLayout()
      root.rows = '52,48,*,66'
      root.padding = 12
      page.content = root
      page.actionBarHidden = true
      page.backgroundColor = new Color('#12212c')
      const heading = label('Collection gestures', new Color('#12212c'))
      heading.fontSize = 23
      root.addChild(heading)
      nav.row = 1
      nav.orientation = 'horizontal'
      root.addChild(nav)
      host.row = 2
      root.addChild(host)
      const status = label('Ready', new Color('#12212c'))
      status.row = 3
      status.automationText = 'outcome'
      status.textWrap = true
      root.addChild(status)
      let scene = '',
        seq = 0,
        stop = () => {},
        read: () => object = () => ({}),
        cancel: () => void = () => {}
      const history: object[] = []
      function report(message: string) {
        status.text = message
        const entry = { scene, message, ...read() }
        history.push(entry)
        File.fromPath(knownFolders.documents().path + '/continuity.json').writeTextSync(
          JSON.stringify({ entry, history }),
        )
      }
      function button(text: string, action: () => void) {
        const button = new Button()
        button.text = button.automationText = text
        button.fontSize = 13
        button.padding = 4
        button.minWidth = 0
        button.width = 78
        button.on('tap', action)
        nav.addChild(button)
      }
      function show(mode: string) {
        const serial = ++seq
        stop()
        stop = () => {}
        cancel = () => {}
        read = () => ({})
        host.removeChildren()
        scene = mode
        if (mode === 'Grid sheet') {
          const panel = new GestureSurface(),
            grip = label('Featured cards  ·  drag to explore', teal),
            list = new CollectionView()
          panel.rows = '48,*'
          panel.backgroundColor = blue
          host.addChild(panel)
          panel.addChild(grip)
          list.colWidth = { unit: '%', value: 0.5 }
          list.rowHeight = 66
          list.automationText = 'sheet-grid'
          list.row = 1
          list.items = Array.from({ length: 100 }, (_, i) => ({
            title: 'Card ' + String(i + 1).padStart(2, '0'),
            color: i % 2 ? '#335074' : '#295d62',
          }))
          list.itemTemplate =
            '<Label text="{{ title }}" height="62" margin="2" padding="12" color="white" backgroundColor="{{ color }}" />'
          panel.addChild(list)
          setTimeout(() => {
            if (serial !== seq) return
            const max = Math.floor(host.getActualSize().height - 8),
              min = Math.min(230, max / 2)
            const sheet = bottomSheet(panel, {
              handle: grip,
              snap: [min, max],
              scrollView: scrollHandoff(list, { axis: 'y' }),
              keyboard: 'none',
              dismissible: false,
            })
            let maxFirst = 0
            list.on('scroll', () => {
              maxFirst = Math.max(maxFirst, list.findFirstVisibleItemIndex())
            })
            read = () => ({
              maxFirst,
              first: list.findFirstVisibleItemIndex(),
              height: sheet.visibleHeight,
              min,
              max,
            })
            stop = () => sheet.dispose()
            sheet.open(min)
            report('Drag up through the grid, then reverse')
          }, 350)
        } else {
          const board = new GridLayout(),
            origin = new StackLayout(),
            scroll = new ScrollView(),
            rows = new StackLayout()
          board.columns = '*,*'
          host.addChild(board)
          origin.marginRight = 6
          origin.clipToBounds = false
          scroll.col = 1
          scroll.automationText = 'destination'
          scroll.content = rows
          board.addChild(scroll)
          board.addChild(origin)
          const keys = Array.from(
              { length: 48 },
              (_, i) => 'Task ' + String(i + 1).padStart(2, '0'),
            ),
            source = ['Atlas']
          const tiles = keys.map((key, i) => {
            const tile = label(key, i % 2 ? teal : blue)
            tile.height = 50
            tile.marginBottom = 3
            rows.addChild(tile)
            return tile
          })
          const card = label('Atlas', new Color('#82633d'))
          card.height = 54
          origin.addChild(card)
          let commits = 0,
            index = -1,
            preview = -1,
            armed = false
          read = () => ({ commits, index, preview, offset: scroll.verticalOffset })
          setTimeout(() => {
            if (serial !== seq) return
            if (!isIOS)
              for (const v of [origin, board]) {
                v.android.setClipChildren(false)
                v.android.setClipToPadding(false)
              }
            const policy = listTransferOptions({
              key: 'Atlas',
              target: scroll as View,
              sourceKeys: () => source,
              targetKeys: () => keys,
              edgeScroll: listTransferScroll(scroll),
              centers: () =>
                tiles.flatMap((v, i) =>
                  v.isLoaded
                    ? [
                        {
                          key: keys[i]!,
                          center:
                            v.getLocationInWindow().y + v.getActualSize().height / 2,
                        },
                      ]
                    : [],
                ),
              preview(move) {
                if (tiles[preview]) tiles[preview]!.borderTopWidth = 0
                preview = move?.toIndex ?? -1
                const tile = tiles[preview]
                if (tile) {
                  tile.borderColor = new Color('#e7cc82')
                  tile.borderTopWidth = 3
                }
                if (move) status.text = 'Insert Atlas at position ' + (preview + 1)
              },
              commit(move) {
                commits++
                index = move.toIndex
                keys.splice(index, 0, source.shift()!)
                setTimeout(() => {
                  if (serial !== seq) return
                  owner.dispose()
                  origin.removeChild(card)
                  card.translateX = card.translateY = 0
                  rows.insertChild(card, index)
                  report('Moved Atlas to position ' + (index + 1))
                }, 0)
              },
            })
            const owner = dropZones(card, {
              ...policy,
              drag: { snap: [0] },
            })
            const afterScroll = () => {
              if (armed && scroll.verticalOffset > 50) {
                armed = false
                owner.cancel()
                report('Cancelled')
              }
            }
            scroll.on('scroll', afterScroll)
            stop = () => {
              scroll.off('scroll', afterScroll)
              owner.dispose()
            }
            cancel = () => {
              armed = true
              report('Cancel next drag')
            }
            report('Hold Atlas at the lower edge of the other list')
          }, 350)
        }
      }
      button('Grid sheet', () => show('Grid sheet'))
      button('Transfer', () => show('Transfer'))
      button('Cancel', () => cancel())
      button('Audit', () => report('Audit'))
      page.once('loaded', () => show('Grid sheet'))
      return page
    },
  })
}
