import {
  Application,
  Button,
  Color,
  File,
  GridLayout,
  Label,
  ListView,
  Page,
  Screen,
  StackLayout,
  View,
  isIOS,
  knownFolders,
} from '@nativescript/core'
import { CollectionView } from '@nativescript-community/ui-collectionview'
import {
  collectionViewListAdapter,
  dropZones,
  listChanges,
  listTransferOptions,
} from '@rafaelaugusto/jolt'
import {
  collectionViewReorderAdapter,
  reorder,
  ReorderSurface,
} from '../../dist/reorder/index'

type Card = { id: string; title: string; height: number; color: string }
const colors = ['#184956', '#315170', '#48577f', '#2f665c']
const cards = (): Card[] =>
  Array.from({ length: 64 }, (_, i) => ({
    id: 'card-' + i,
    title: 'Card ' + String(i + 1).padStart(2, '0'),
    height: [52, 88, 64][i % 3]!,
    color: colors[i % 4]!,
  }))
export function runCollectionLayouts() {
  Application.run({
    create() {
      const page = new Page(),
        root = new GridLayout(),
        nav = new StackLayout(),
        controls = new StackLayout(),
        host = new GridLayout(),
        status = new Label()
      page.actionBarHidden = true
      page.backgroundColor = new Color('#101d2a')
      root.rows = '48,48,46,*,56'
      root.padding = 12
      page.content = root
      const heading = new Label()
      heading.fontSize = 24
      heading.color = new Color('white')
      heading.text = 'Collection motion'
      root.addChild(heading)
      for (const [index, view] of [nav, controls, host, status].entries()) {
        GridLayout.setRow(view, index + 1)
        root.addChild(view)
      }
      nav.orientation = controls.orientation = 'horizontal'
      status.color = new Color('#c5eedc')
      status.textWrap = true
      status.automationText = 'result'
      let cleanup: (() => void)[] = [],
        read = () => ({}),
        epoch = 0,
        scene = '',
        text = ''
      const history: object[] = []
      function report(message: string, audit = false) {
        text = message
        status.text = message
        const state = { scene, message, audit, ...read() }
        history.push(state)
        File.fromPath(
          knownFolders.documents().path + '/collection-layouts.json',
        ).writeTextSync(JSON.stringify({ ...state, history }))
      }
      function button(parent: StackLayout, title: string, action: () => void) {
        const b = new Button()
        if (!isIOS) {
          b.minWidth = 0
          b.width =
            Math.floor((Screen.mainScreen.widthDIPs - 24) / (parent === nav ? 5 : 6)) - 3
        }
        b.text = title
        b.automationText = title
        b.fontSize = 12
        b.padding = 4
        b.marginRight = 3
        b.backgroundColor = new Color('#294357')
        b.color = new Color('white')
        b.on('tap', () => {
          try {
            action()
          } catch (e) {
            report('Error ' + e)
            console.error(e)
          }
        })
        parent.addChild(b)
      }
      function own<T extends { dispose(): void }>(owner: T) {
        cleanup.push(() => owner.dispose())
        return owner
      }
      function show(mode: string) {
        const ticket = ++epoch
        for (const stop of cleanup.splice(0).reverse()) stop()
        host.removeChildren()
        controls.removeChildren()
        read = () => ({})
        scene = mode
        if (mode === 'Transfer') {
          let left = ['Atlas', 'Birch', 'Cedar'],
            right = ['Dune', 'Elm'],
            commits = 0,
            reject = false,
            revision = 0
          const board = new GridLayout(),
            panels = [new StackLayout(), new StackLayout()]
          board.columns = '*,*'
          host.addChild(board)
          panels.forEach((panel, i) => {
            panel.col = i
            panel.clipToBounds = false
            panel.margin = 4
            panel.padding = 6
            panel.backgroundColor = new Color(i ? '#203e42' : '#223447')
            board.addChild(panel)
          })
          let input: ReturnType<typeof dropZones>[] = []
          function render() {
            for (const item of input) item.dispose()
            input = []
            panels.forEach((panel) => panel.removeChildren())
            const groups = [left, right],
              views: Label[][] = [[], []]
            panels.forEach((panel, group) => {
              groups[group]!.forEach((key, index) => {
                const row = new Label()
                row.text = key
                row.automationText = key
                row.height = 54
                row.padding = 13
                row.marginBottom = 4
                row.color = new Color('white')
                row.backgroundColor = new Color(colors[index % 4]!)
                panel.addChild(row)
                views[group]!.push(row)
              })
            })
            for (const [group, rows] of views.entries()) {
              const other = 1 - group,
                target = panels[other]!
              rows.forEach((row, index) => {
                const key = groups[group]![index]!
                const owner = dropZones(row, {
                  drag: { snap: [0] },
                  ...listTransferOptions({
                    key,
                    target: target as View,
                    sourceKeys: () => groups[group]!,
                    targetKeys: () => groups[other]!,
                    revision: () => revision,
                    centers: () =>
                      views[other]!.map((v, i) => ({
                        key: groups[other]![i]!,
                        center: v.getLocationInWindow().y + v.getActualSize().height / 2,
                      })),
                    accept: () => !reject,
                    preview(move) {
                      for (const [i, item] of views[other]!.entries()) {
                        item.borderTopWidth = move?.toIndex === i ? 3 : 0
                        item.borderBottomWidth =
                          move?.toIndex === views[other]!.length &&
                          i === views[other]!.length - 1
                            ? 3
                            : 0
                        item.borderColor = new Color('#92dfc3')
                      }
                      target.borderTopWidth = move && !views[other]!.length ? 3 : 0
                      target.borderColor = new Color('#92dfc3')
                      if (move)
                        report(
                          'Insert ' + key + ' before ' + (move.beforeKey ?? 'the end'),
                        )
                    },
                    commit(move) {
                      groups[group]!.splice(move.fromIndex, 1)
                      groups[other]!.splice(move.toIndex, 0, key)
                      revision++
                      commits++
                      report('Moved ' + key)
                      setTimeout(() => {
                        if (ticket === epoch) render()
                      }, 0)
                    },
                  }),
                })
                input.push(owner)
              })
            }
          }
          read = () => ({ left, right, commits, reject })
          cleanup.push(() => input.forEach((o) => o.dispose()))
          button(controls, 'Empty', () => {
            right.splice(0)
            revision++
            render()
            report('Empty destination')
          })
          button(controls, 'Reject', () => {
            reject = !reject
            report(reject ? 'Reject drops' : 'Accept drops')
          })
          setTimeout(() => {
            if (ticket !== epoch) return
            if (!isIOS)
              for (const panel of [board, ...panels]) panel.android.setClipChildren(false)
            render()
            report('Drag a card between lists')
          }, 300)
        } else {
          const measured = mode === 'Heights',
            horizontal = mode === 'Carousel' || mode === 'RTL'
          const list = measured ? new ListView() : new CollectionView()
          let items = cards(),
            commits = 0,
            cancels = 0,
            mutations = 0
          list.items = items
          list.automationText = 'cards'
          list.rowHeight = measured ? 'auto' : horizontal ? 120 : 80
          list.itemTemplate =
            '<Label text="{{ title }}" automationText="{{ title }}" height="' +
            (measured ? '{{ height }}' : horizontal ? '116' : '76') +
            '" padding="12" margin="2" color="white" backgroundColor="{{ color }}" />'
          if (list instanceof CollectionView) {
            list.orientation = horizontal ? 'horizontal' : 'vertical'
            list.colWidth = horizontal ? 110 : { unit: '%', value: 0.5 }
            if (horizontal) {
              list.height = 120
              list.verticalAlignment = 'middle'
            }
          }
          const surface = new ReorderSurface()
          surface.addChild(list)
          host.addChild(surface)
          setTimeout(() => {
            if (ticket !== epoch) return
            if (mode === 'RTL') {
              if (isIOS) list.ios.semanticContentAttribute = 4
              else list.android.setLayoutDirection(1)
            }
            try {
              const changes = own(
                listChanges<Card, string>(list, {
                  key: (r) => r.id,
                  ...(list instanceof CollectionView
                    ? { adapter: collectionViewListAdapter<Card>(list) }
                    : {}),
                }),
              )
              const reordering =
                list instanceof CollectionView
                  ? own(
                      reorder(collectionViewReorderAdapter<Card>(list), {
                        key: (r) => r.id,
                        onCancel() {
                          cancels++
                          report('Drag cancelled')
                        },
                        onCommit(move) {
                          const next = [...items],
                            card = next.splice(move.fromIndex, 1)[0]!
                          next.splice(move.toIndex, 0, card)
                          items = next
                          list.items = items
                          commits++
                          report('Moved ' + card.title + ' to ' + (move.toIndex + 1))
                        },
                      }),
                    )
                  : undefined
              const anchor = () => {
                const native = list.nativeViewProtected
                const index =
                  list instanceof CollectionView
                    ? list.findFirstVisibleItemIndex()
                    : isIOS
                      ? native.indexPathsForVisibleRows?.firstObject?.row
                      : native.getFirstVisiblePosition()
                return items[index]?.id
              }
              function anchorOffset() {
                const n = list.nativeViewProtected
                if (list instanceof CollectionView) {
                  const v = list.getViewForItemAtIndex(list.findFirstVisibleItemIndex())
                  return v?.getLocationRelativeTo(list)?.[horizontal ? 'x' : 'y']
                }
                if (isIOS) {
                  const path = n.indexPathsForVisibleRows?.firstObject
                  return path
                    ? n.rectForRowAtIndexPath(path).origin.y -
                        n.contentOffset.y -
                        n.adjustedContentInset.top
                    : undefined
                }
                const first = n.getChildAt(0)
                return first
                  ? (first.getTop() - n.getPaddingTop()) /
                      n.getResources().getDisplayMetrics().density
                  : undefined
              }
              read = () => ({
                offset: anchorOffset(),
                commits,
                cancels,
                mutations,
                anchor: anchor(),
                first: items[0]?.id,
                count: items.length,
              })
              const mutate = (next: Card[], name: string) => {
                changes.update(next)
                items = next
                mutations++
                report(name)
              }
              button(controls, 'Insert', () =>
                mutate(
                  [
                    { ...cards()[0]!, id: 'new-' + mutations, title: 'Inserted' },
                    ...items,
                  ],
                  'Inserted a card',
                ),
              )
              button(controls, 'Delete', () => {
                const i = Math.max(1, items.findIndex((r) => r.id === anchor()) + 1)
                mutate(
                  items.filter((_, n) => n !== i),
                  'Deleted a card',
                )
              })
              button(controls, 'Jump', () => {
                if (list instanceof CollectionView) list.scrollToIndex(18, false)
                else list.scrollToIndex(18)
                report('Jumped to card 19')
              })
              button(controls, 'Move', () => {
                const next = [...items]
                next.splice(3, 0, next.splice(1, 1)[0]!)
                mutate(next, 'Updated order')
              })
              if (reordering)
                button(controls, 'Cancel', () => {
                  setTimeout(() => {
                    if (ticket === epoch) reordering.cancel()
                  }, 1400)
                  report('Cancellation armed')
                })
              report(measured ? '52, 88 and 64 point rows' : 'Hold a card and drag')
            } catch (e) {
              report('Error ' + e)
              console.error(e)
            }
          }, 450)
        }
        button(controls, 'Audit', () => report(text, true))
      }
      for (const mode of ['Carousel', 'RTL', 'Heights', 'Grid', 'Transfer'])
        button(nav, mode, () => show(mode))
      page.once('loaded', () => show('Carousel'))
      return page
    },
  })
}
