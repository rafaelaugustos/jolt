import {
  Application,
  Button,
  Color,
  File,
  GridLayout,
  Label,
  ListView,
  Page,
  ScrollView,
  StackLayout,
  WrapLayout,
  knownFolders,
  isIOS,
  type View,
} from '@nativescript/core'
import { CollectionView } from '@nativescript-community/ui-collectionview'
import {
  bind,
  collectionViewListAdapter,
  configure,
  listChanges,
  scrollValue,
} from '@rafaelaugusto/jolt'
import { inspectScrollValue } from '../../dist/motion-value'
import {
  GestureSurface,
  gestures,
  gestureRelations,
  scrollHandoff,
} from '../../dist/gestures/index'
import {
  ReorderSurface,
  collectionViewReorderAdapter,
  reorder,
} from '../../dist/reorder/index'

/** Real native widgets and production adapters. Only explicit controls take JS snapshots. */
export function runCollectionsScroll() {
  Application.run({
    create() {
      const page = new Page()
      page.actionBarHidden = true
      page.backgroundColor = new Color('#101622')
      const root = new GridLayout()
      root.rows = 'auto,auto,auto,*,auto'
      root.padding = 16
      page.content = root
      const label = (text: string) => {
        const view = new Label()
        view.text = text
        view.textWrap = true
        view.color = new Color('#edf2ff')
        view.fontSize = 16
        return view
      }
      const title = label('Jolt · Collections & scroll')
      title.fontSize = 23
      root.addChild(title)
      const nav = new WrapLayout()
      GridLayout.setRow(nav, 1)
      root.addChild(nav)
      const controls = new WrapLayout()
      GridLayout.setRow(controls, 2)
      root.addChild(controls)
      const body = new GridLayout()
      GridLayout.setRow(body, 3)
      root.addChild(body)
      const status = label('Ready')
      status.fontSize = 12
      status.height = 90
      status.automationText = 'collection-status'
      GridLayout.setRow(status, 4)
      root.addChild(status)
      const events: object[] = [],
        releases: (() => void)[] = []
      let generation = 0,
        scene = '',
        snapshot: () => object = () => ({})
      const report = (name: string, detail: object = {}) => {
        const state = { scene, name, ...snapshot(), ...detail }
        events.push(state)
        status.text = JSON.stringify(state, (key, value) =>
          key === 'producerMs' ? undefined : value,
        )
        File.fromPath(
          knownFolders.documents().path + '/collections-scroll.json',
        ).writeTextSync(JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }))
      }
      const button = (text: string, run: () => void, parent = controls) => {
        const b = new Button()
        b.text = text
        b.automationText = text
        b.fontSize = 11
        b.padding = 5
        b.margin = 2
        b.color = new Color('#edf2ff')
        b.backgroundColor = new Color('#24354e')
        b.on('tap', () => {
          try {
            run()
          } catch (error) {
            report('ERROR', { error: String(error) })
            console.error(error)
          }
        })
        parent.addChild(b)
        return b
      }
      const own = <T extends { dispose(): void }>(value: T): T => {
        releases.push(() => value.dispose())
        return value
      }
      const ready = (action: () => void) => {
        const epoch = generation
        setTimeout(() => {
          if (epoch !== generation) return
          try {
            action()
            report('ready')
          } catch (error) {
            report('ERROR', { error: String(error) })
            console.error(error)
          }
        }, 350)
      }
      const data = () =>
        Array.from({ length: 200 }, (_, index) => ({
          id: `row-${index}`,
          text: `Row ${String(index + 1).padStart(3, '0')} · hold to move`,
        }))
      const collection = () => {
        const list = new CollectionView()
        list.rowHeight = 64
        list.colWidth = { unit: '%', value: 1 }
        list.items = data()
        list.automationText = 'collection-list'
        list.itemTemplate =
          '<Label text="{{ text }}" height="64" padding="16" color="#edf2ff" backgroundColor="#24354e" borderBottomWidth="1" borderBottomColor="#101622" />'
        return list
      }
      const coreList = () => {
        const list = new ListView()
        list.rowHeight = 64
        list.items = data()
        list.automationText = 'collection-list'
        list.itemTemplate =
          '<Label text="{{ text }}" height="64" padding="16" color="#edf2ff" backgroundColor="#24354e" />'
        return list
      }
      const scroller = (horizontal: boolean) => {
        const scroll = new ScrollView()
        scroll.orientation = horizontal ? 'horizontal' : 'vertical'
        scroll.automationText = 'collection-list'
        const content = new StackLayout()
        content.orientation = scroll.orientation
        scroll.content = content
        for (let i = 0; i < 30; i++) {
          const row = label(`Card ${i + 1}`)
          row.padding = 16
          row.backgroundColor = new Color(i % 2 ? '#24354e' : '#304768')
          if (horizontal) {
            row.width = 130
            row.height = 190
          } else row.height = 64
          content.addChild(row)
        }
        return scroll
      }
      function setup(mode: string) {
        generation++
        for (const release of releases.splice(0).reverse()) release()
        body.removeChildren()
        controls.removeChildren()
        scene = mode
        snapshot = () => ({})
        if (mode === 'Changes' || mode === 'Reorder') {
          const list = collection(),
            host = new ReorderSurface(),
            surface = new GestureSurface()
          host.addChild(list)
          surface.addChild(host)
          body.addChild(surface)
          let items = data(),
            commits = 0,
            cancels = 0,
            taps = 0,
            armed = '',
            panel: ReturnType<typeof gestures> | undefined
          let travel: ReturnType<typeof scrollValue> | undefined,
            lastMove: object | undefined
          list.on('itemTap', () => {
            taps++
            report('row tap')
          })
          snapshot = () => {
            const index = Math.max(0, list.findFirstVisibleItemIndex()),
              row = list.getViewForItemAtIndex(index)
            return {
              count: items.length,
              first: items[0]?.id,
              commits,
              cancels,
              taps,
              offset: list.scrollOffset,
              anchor: items[index]?.id,
              anchorY: row?.getLocationRelativeTo(list)?.y,
              panel: panel?.y.get(),
              travel: travel && inspectScrollValue(travel),
              lastMove,
              requested: list.rowHeight,
              effective: list._effectiveRowHeight,
              rowSize: row?.getActualSize(),
            }
          }
          ready(() => {
            if (mode === 'Changes') {
              const changes = own(
                listChanges(list, {
                  key: (row: { id: string }) => row.id,
                  adapter: collectionViewListAdapter(list),
                  exit: { opacity: 0 },
                }),
              )
              const change = (next: typeof items) => {
                items = next
                changes.update(items)
                report('mutation')
              }
              button('Prepend', () =>
                change([
                  { id: 'new-' + Date.now(), text: 'Inserted · anchor stays put' },
                  ...items,
                ]),
              )
              button('Remove', () =>
                change(
                  items.filter(
                    (_, index) =>
                      index !== Math.max(0, list.findFirstVisibleItemIndex() + 1),
                  ),
                ),
              )
              button('Reverse', () => change([...items].reverse()))
            } else {
              const controller = own(
                reorder(
                  collectionViewReorderAdapter<{ id: string; text: string }>(list),
                  {
                    key: (row) => row.id,
                    onStart: (key) => {
                      if (travel) inspectScrollValue(travel, false)
                      report('drag start', { key })
                      if (armed) {
                        const action = armed,
                          epoch = generation
                        armed = ''
                        setTimeout(() => {
                          if (epoch !== generation) return
                          if (action === 'cancel') controller.cancel()
                          else {
                            items =
                              action === 'remove'
                                ? items.filter((row) => row.id !== key)
                                : data()
                            list.items = [...items]
                          }
                          report(action)
                        }, 850)
                      }
                    },
                    onCancel: () => {
                      cancels++
                      report('cancel')
                    },
                    onCommit: (move) => {
                      const [row] = items.splice(move.fromIndex, 1)
                      items.splice(move.toIndex, 0, row!)
                      list.items = [...items]
                      commits++
                      lastMove = { ...move, committed: items[move.toIndex]?.id }
                      report('commit')
                    },
                  },
                ),
              )
              panel = own(
                gestures(surface, {
                  pan: { axis: 'y', bounds: { top: 0, bottom: 180 } },
                  scrollView: scrollHandoff(list),
                }),
              )
              releases.push(bind(surface, { y: panel.y }))
              own(
                gestureRelations([
                  { gesture: panel, other: controller, relation: 'waitFor' },
                ]),
              )
              const stride = list.getViewForItemAtIndex(0)?.getActualSize().height ?? 64
              travel = own(scrollValue(list, { execution: 'native', rowHeight: stride }))
              for (const action of ['replace', 'remove', 'cancel'])
                button('Arm ' + action, () => {
                  armed = action
                  report('armed', { action })
                })
            }
            button('Jump 100', () => {
              list.scrollToIndex(100, false)
              setTimeout(() => report('jump'), 300)
            })
            button('Replace', () => {
              items = data()
              list.items = [...items]
              report('replacement')
            })
            button('Audit', () => report('audit'))
          })
        } else if (mode.endsWith('handoff')) {
          const horizontal = mode === 'X handoff',
            surface = new GestureSurface()
          surface.automationText = 'handoff-panel'
          surface.rows = 'auto,*'
          surface.backgroundColor = new Color('#24354e')
          const grip = label('One contact: expand → scroll → reverse')
          grip.height = 48
          grip.padding = 12
          surface.addChild(grip)
          const list =
            mode === 'List handoff'
              ? coreList()
              : mode === 'CV handoff'
                ? collection()
                : scroller(true)
          GridLayout.setRow(list, 1)
          surface.addChild(list)
          body.addChild(surface)
          ready(() => {
            let starts = 0,
              ends = 0,
              cancels = 0
            const control = own(
              gestures(surface, {
                pan: {
                  axis: horizontal ? 'x' : 'y',
                  bounds: horizontal ? { left: 0, right: 120 } : { top: 0, bottom: 180 },
                },
                initial: horizontal ? { x: 120 } : { y: 180 },
                scrollView: scrollHandoff(list, { axis: horizontal ? 'x' : 'y' }),
                onStart: () => {
                  starts++
                },
                onEnd: () => {
                  ends++
                  report('end')
                },
                onCancel: () => {
                  cancels++
                },
              }),
            )
            releases.push(bind(surface, horizontal ? { x: control.x } : { y: control.y }))
            const source = own(
              scrollValue(list, {
                execution: 'native',
                axis: horizontal ? 'x' : 'y',
                rowHeight: 64,
              }),
            )
            snapshot = () => ({
              panel: horizontal ? control.x.get() : control.y.get(),
              scroll: source.get(),
              starts,
              ends,
              cancels,
            })
            button('Reset', () => {
              control.jumpTo(horizontal ? { x: 120 } : { y: 180 })
              if (list instanceof ScrollView) list.scrollToHorizontalOffset(0, false)
              else list.scrollToIndex(0)
              report('reset')
            })
            button('Replace', () => {
              if (!(list instanceof ScrollView)) list.items = data()
              report('replacement')
            })
            button('Audit', () => report('audit'))
          })
        } else if (mode === 'LTR' || mode === 'RTL') {
          const scroll = new ScrollView()
          scroll.orientation = 'horizontal'
          scroll.automationText = 'horizontal-reorder'
          const content = new StackLayout()
          content.orientation = 'horizontal'
          scroll.content = content
          body.addChild(scroll)
          let rows = [
            'Alpha',
            'Bravo',
            'Charlie',
            'Delta',
            'Echo',
            'Foxtrot',
            'Golf',
            'Hotel',
          ].map((key, index) => {
            const target = label(key)
            target.automationText = key
            target.width = 112 + (index % 3) * 24
            target.height = 190
            target.padding = 16
            target.marginRight = 10
            target.borderRadius = 14
            target.backgroundColor = new Color(index % 2 ? '#866ce2' : '#304768')
            return { key, target }
          })
          const render = () => {
            content.removeChildren()
            for (const row of mode === 'RTL' ? [...rows].reverse() : rows)
              content.addChild(row.target)
          }
          render()
          let commits = 0,
            cancels = 0,
            armed = '',
            reduced = false
          let travel: ReturnType<typeof scrollValue> | undefined
          snapshot = () => ({
            order: rows.map((row) => row.key),
            commits,
            cancels,
            offset: scroll.horizontalOffset,
            extent: scroll.scrollableWidth,
            travel: travel && inspectScrollValue(travel),
          })
          ready(() => {
            if (mode === 'RTL')
              scroll.scrollToHorizontalOffset(scroll.scrollableWidth, false)
            travel = own(scrollValue(scroll, { execution: 'native', axis: 'x' }))
            const controller = own(
              reorder(content, {
                items: () => rows,
                axis: 'x',
                direction: mode === 'RTL' ? 'rtl' : 'ltr',
                onStart: (key) => {
                  inspectScrollValue(travel!, false)
                  report('drag start', { key })
                  if (armed) {
                    const action = armed,
                      epoch = generation
                    armed = ''
                    setTimeout(() => {
                      if (epoch !== generation) return
                      if (action === 'cancel') controller.cancel()
                      else if (action === 'remove') {
                        rows = rows.filter((row) => row.key !== key)
                        render()
                        controller.refresh()
                      } else {
                        rows[0]!.target.width = Number(rows[0]!.target.width) + 30
                        controller.refresh()
                      }
                      report(action)
                    }, 850)
                  }
                },
                onCancel: () => {
                  cancels++
                  report('cancel')
                },
                onCommit: (move) => {
                  const [row] = rows.splice(move.fromIndex, 1)
                  rows.splice(move.toIndex, 0, row!)
                  render()
                  commits++
                  report('commit')
                },
              }),
            )
            for (const action of ['cancel', 'remove', 'resize'])
              button('Arm ' + action, () => {
                armed = action
                report('armed')
              })
            button('Reduce', () => {
              reduced = !reduced
              configure({ reducedMotion: reduced ? 'always' : 'user' })
              report('reduced')
            })
            releases.push(() => configure({ reducedMotion: 'user' }))
            button('Audit', () => report('audit'))
          })
        } else {
          const horizontal = mode !== 'Y source',
            plugin = mode === 'CV source'
          const stack = new GridLayout()
          stack.rows = '100,*'
          body.addChild(stack)
          const meter = label('Five native properties')
          meter.width = 180
          meter.height = 70
          meter.borderRadius = 14
          meter.backgroundColor = new Color('#866ce2')
          stack.addChild(meter)
          const list = plugin ? collection() : scroller(horizontal)
          if (plugin) {
            list.orientation = 'horizontal'
            ;(list as CollectionView).colWidth = 130
            ;(list as CollectionView).rowHeight = { unit: '%', value: 1 }
          }
          GridLayout.setRow(list, 1)
          stack.addChild(list)
          ready(() => {
            const stride = plugin
              ? ((list as CollectionView).getViewForItemAtIndex(0)?.getActualSize()
                  .width ?? 130)
              : 0
            const source = own(
              scrollValue(list, {
                execution: 'native',
                axis: horizontal ? 'x' : 'y',
                rowHeight: stride,
              }),
            )
            inspectScrollValue(source, true)
            const progress = source.to([0, 1000], [0, 1])
            releases.push(
              bind(meter, {
                x: progress.mul(50),
                y: progress.mul(20),
                rotate: progress.mul(30),
                scale: progress.mul(0.2).add(1),
                opacity: progress.mul(-0.4).add(1),
              }),
            )
            let baseline: ReturnType<typeof scrollValue> | undefined
            if (list instanceof ScrollView) {
              const comparison = label('JS · same 5 properties')
              comparison.width = 180
              comparison.height = 70
              comparison.backgroundColor = new Color('#304768')
              comparison.horizontalAlignment = 'right'
              stack.addChild(comparison)
              meter.horizontalAlignment = 'left'
              baseline = own(
                scrollValue(list, {
                  execution: 'javascript',
                  axis: horizontal ? 'x' : 'y',
                }),
              )
              inspectScrollValue(baseline, true)
              const mapped = baseline.to([0, 1000], [0, 1])
              releases.push(
                bind(comparison, {
                  x: mapped.mul(50),
                  y: mapped.mul(20),
                  rotate: mapped.mul(30),
                  scale: mapped.mul(0.2).add(1),
                  opacity: mapped.mul(-0.4).add(1),
                }),
              )
            }
            snapshot = () => ({
              source: inspectScrollValue(source),
              baseline: baseline && inspectScrollValue(baseline),
              stride,
              widget:
                list instanceof CollectionView
                  ? list.scrollOffset
                  : horizontal
                    ? (list as ScrollView).horizontalOffset
                    : (list as ScrollView).verticalOffset,
            })
            button('Audit', () => report('audit'))
            button('Origin', () => {
              if (list instanceof ScrollView) {
                if (horizontal) list.scrollToHorizontalOffset(0, false)
                else list.scrollToVerticalOffset(0, false)
              }
              setTimeout(() => {
                inspectScrollValue(source, true)
                if (baseline) inspectScrollValue(baseline, true)
                report('origin')
              }, 250)
            })
            button('Offset 400', () => {
              if (list instanceof CollectionView) {
                if (isIOS)
                  list.nativeViewProtected.setContentOffsetAnimated(
                    CGPointMake(400, 0),
                    false,
                  )
                else {
                  const native = list.nativeViewProtected,
                    density = native.getResources().getDisplayMetrics().density
                  const logical =
                    native.getLayoutDirection() === android.view.View.LAYOUT_DIRECTION_RTL
                      ? Math.max(
                          0,
                          list.items.length * stride - list.getActualSize().width - 400,
                        )
                      : 400
                  native
                    .getLayoutManager()
                    .scrollToPositionWithOffset(
                      Math.floor(logical / stride),
                      -Math.round((logical % stride) * density),
                    )
                }
              } else if (horizontal) list.scrollToHorizontalOffset(400, false)
              else list.scrollToVerticalOffset(400, false)
              setTimeout(() => report('offset'), 250)
            })
            button('RTL source', () => {
              if (isIOS)
                list.nativeViewProtected.semanticContentAttribute =
                  UISemanticContentAttribute.ForceRightToLeft
              else
                list.nativeViewProtected.setLayoutDirection(
                  android.view.View.LAYOUT_DIRECTION_RTL,
                )
              report('rtl')
            })
          })
        }
        report('scene')
      }
      for (const name of [
        'Changes',
        'Reorder',
        'List handoff',
        'CV handoff',
        'X handoff',
        'LTR',
        'RTL',
        'Y source',
        'X source',
        'CV source',
      ])
        button(name, () => setup(name), nav)
      page.on('loaded', () => setup('Changes'))
      page.on('unloaded', () => {
        generation++
        for (const release of releases.splice(0).reverse()) release()
      })
      return page
    },
  })
}
