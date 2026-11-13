import {
  Application,
  Button,
  Color,
  GridLayout,
  Label,
  ListView,
  Page,
  ScrollView,
  StackLayout,
  WrapLayout,
  knownFolders,
  File,
  isIOS,
} from '@nativescript/core'
import {
  animate,
  set,
  configure,
  reducedMotion,
  animateLayout,
  bind,
  listChanges,
  motionValue,
  scrollValue,
  type Animation,
} from '@rafaelaugusto/jolt'
import { exitCosts } from './costs'
import { inspectScrollValue } from '../../dist/motion-value'

/** Interactive production native fixture: no timer drives animation presentation. */
export function runValuesScrollLists() {
  Application.run({
    create: () => {
      const page = new Page()
      page.actionBarHidden = true
      page.backgroundColor = new Color('#0C1222')
      const root = new GridLayout()
      root.rows = 'auto,auto,*,auto'
      root.padding = 18
      page.content = root
      const title = new Label()
      title.text = 'Jolt · Values, scroll & lists'
      title.color = new Color('#E7ECF5')
      title.fontSize = 22
      title.fontWeight = 'bold'
      root.addChild(title)
      const nav = new WrapLayout()
      GridLayout.setRow(nav, 1)
      root.addChild(nav)
      const body = new GridLayout()
      GridLayout.setRow(body, 2)
      root.addChild(body)
      const status = new Label()
      status.textWrap = true
      status.fontSize = 12
      status.color = new Color('#B6C7DF')
      status.automationText = 'lab-status'
      GridLayout.setRow(status, 3)
      root.addChild(status)
      const releases: (() => void)[] = [],
        events: object[] = []
      const report = (name: string, detail: object = {}) => {
        events.push({ name, time: Date.now(), ...detail })
        status.text = name
        File.fromPath(
          knownFolders.documents().path + '/values-scroll-lists.json',
        ).writeTextSync(JSON.stringify({ platform: isIOS ? 'ios' : 'android', events }))
      }
      const button = (text: string, id: string, run: () => void) => {
        const b = new Button()
        b.text = text
        b.automationText = id
        b.fontSize = 13
        b.padding = 6
        b.margin = 3
        b.color = new Color('#E7ECF5')
        b.backgroundColor = new Color('#203553')
        b.on('tap', () => {
          try {
            run()
          } catch (error) {
            report('error', { message: String(error) })
            console.error(error)
          }
        })
        return b
      }
      const label = (text: string) => {
        const l = new Label()
        l.text = text
        l.textWrap = true
        l.color = new Color('#DCE8F7')
        l.fontSize = 15
        l.marginBottom = 12
        return l
      }
      const clear = () => {
        for (const release of releases.splice(0)) release()
        body.removeChildren()
      }
      function values() {
        clear()
        const stack = new StackLayout()
        body.addChild(stack)
        stack.addChild(
          label(
            'Combined values: (a + b) × 0.65\nOne graph drives translation, rotation and scale.',
          ),
        )
        const stage = new GridLayout()
        stage.height = 120
        stage.backgroundColor = new Color('#142039')
        stack.addChild(stage)
        const orb = new Label()
        orb.width = 52
        orb.height = 52
        orb.horizontalAlignment = 'left'
        orb.marginLeft = 12
        orb.borderRadius = 14
        orb.backgroundColor = new Color('#67E4BF')
        stage.addChild(orb)
        const a = motionValue(0),
          b = motionValue(0),
          sum = a.add(b),
          x = sum.mul(0.65),
          rotation = a.div(70).sin().mul(30),
          scale = sum.div(500).add(1)
        const binding = bind(orb, { x, rotate: rotation, scale })
        const controls = new WrapLayout()
        stack.addChild(controls)
        controls.addChild(
          button('Animate', 'values-go', () => {
            set(a, 0)
            set(b, 0)
            animate(a, 180, { duration: 1700 })
            animate(b, 90, { duration: 2300 })
            report('values-start')
          }),
        )
        controls.addChild(
          button('Interrupt', 'values-interrupt', () => {
            animate(a, 0, 'snappy')
            animate(b, 0, 'snappy')
            report('values-interrupt')
          }),
        )
        stack.addChild(
          label(
            'Native scroll source → mapped progress\nJolt does not add per-scroll JavaScript callbacks.',
          ),
        )
        const meter = new Label()
        meter.height = 6
        meter.backgroundColor = new Color('#67E4BF')
        meter.originX = 0
        stack.addChild(meter)
        const scroll = new ScrollView()
        scroll.height = 240
        scroll.automationText = 'native-scroll'
        const content = new StackLayout()
        scroll.content = content
        for (let i = 0; i < 25; i++) {
          const row = label(`Scroll checkpoint ${i + 1}`)
          row.height = 48
          row.marginBottom = 0
          row.padding = 12
          row.backgroundColor = new Color(i % 2 ? '#1A2B45' : '#142039')
          content.addChild(row)
        }
        stack.addChild(scroll)
        const source = scrollValue(scroll, { execution: 'native' }),
          mapped = source.to([0, 500], [0, 1]),
          scrollBinding = bind(meter, { scaleX: mapped })
        controls.addChild(
          button('Audit', 'values-audit', () =>
            report('values-audit', {
              sum: sum.get(),
              x: x.get(),
              scroll: inspectScrollValue(source),
            }),
          ),
        )
        releases.push(() => {
          binding()
          scrollBinding()
          source.dispose()
          a.dispose()
          b.dispose()
        })
        report('scene-values')
      }
      function layout() {
        clear()
        const stack = new StackLayout()
        body.addChild(stack)
        stack.addChild(
          label(
            'Removed cards fade while neighbors move.\nOnly removed views are captured.',
          ),
        )
        const controls = new WrapLayout()
        stack.addChild(controls)
        const cards = new StackLayout()
        cards.automationText = 'native-cards'
        stack.addChild(cards)
        let id = 0,
          animation: Animation | undefined
        const card = () => {
          const box = new GridLayout()
          box.height = 76
          box.marginBottom = 10
          box.borderRadius = 12
          box.backgroundColor = new Color('#295482')
          box.padding = 16
          box.addChild(label(`Card ${++id} · stable identity`))
          return box
        }
        const reset = () => {
          animation?.stop()
          cards.removeChildren()
          for (let i = 0; i < 4; i++) cards.addChild(card())
        }
        const mutate = (change: () => void) => {
          const start = performance.now()
          animation = animateLayout(cards, change, {
            duration: 850,
            exit: { opacity: 0, y: 22, scale: 0.92 },
          })
          report('layout-mutation', { synchronousMs: performance.now() - start })
          void animation.finished.then((done) => report('layout-settled', { done }))
        }
        controls.addChild(
          button('Mix changes', 'layout-mix', () =>
            mutate(() => {
              if (cards.getChildrenCount() > 1) cards.removeChild(cards.getChildAt(1))
              cards.insertChild(card(), 0)
              if (cards.getChildrenCount() > 2) {
                const child = cards.getChildAt(1)
                cards.removeChild(child)
                cards.addChild(child)
              }
            }),
          ),
        )
        controls.addChild(
          button('Remove', 'layout-remove', () =>
            mutate(() => {
              if (cards.getChildrenCount() > 1) cards.removeChild(cards.getChildAt(1))
            }),
          ),
        )
        controls.addChild(
          button('Cancel', 'layout-cancel', () => {
            animation?.stop()
            report('layout-cancel')
          }),
        )
        controls.addChild(
          button('Reinsert', 'layout-reinsert', () => {
            const view = cards.getChildAt(1)
            if (!view) return
            mutate(() => cards.removeChild(view))
            setTimeout(() => cards.insertChild(view, 1), 180)
          }),
        )
        controls.addChild(button('Reset', 'layout-reset', reset))
        controls.addChild(
          button('Audit costs', 'layout-costs', () => {
            reset()
            setTimeout(() => {
              try {
                report('exit-costs', exitCosts(cards.getChildAt(0)))
              } catch (error) {
                report('error', { message: String(error) })
              }
            }, 100)
          }),
        )
        reset()
        releases.push(() => animation?.stop())
        report('scene-layout')
      }
      function lists() {
        clear()
        const panel = new GridLayout()
        panel.rows = 'auto,auto,auto,*'
        body.addChild(panel)
        const heading = label(
          '200 keyed rows · fixed height\nScroll, insert above, remove, sort and filter.',
        )
        panel.addChild(heading)
        const controls = new WrapLayout()
        GridLayout.setRow(controls, 1)
        panel.addChild(controls)
        const list = new ListView()
        list.rowHeight = 60
        list.backgroundColor = new Color('#1A2B45')
        if (isIOS)
          list.on(ListView.itemLoadingEvent, (event: any) => {
            if (event.ios) event.ios.backgroundColor = new Color('#1A2B45').ios
          })
        list.separatorColor = new Color('#344A6B')
        list.automationText = 'native-list'
        GridLayout.setRow(list, 3)
        panel.addChild(list)
        type Item = { id: number; title: string }
        let items: Item[] = Array.from({ length: 200 }, (_, id) => ({
            id,
            title: `Row ${id} · stable key`,
          })),
          next = -1
        list.itemTemplateSelector = () => 'row'
        list.itemTemplates = [
          {
            key: 'row',
            createView: () => {
              const row = new GridLayout()
              row.height = 60
              row.padding = 14
              row.backgroundColor = new Color('#1A2B45')
              const text = label('')
              text.marginBottom = 0
              text.bind({ sourceProperty: 'title', targetProperty: 'text' })
              row.addChild(text)
              return row
            },
          },
        ]
        list.items = items
        const meter = new Label()
        meter.height = 5
        meter.backgroundColor = new Color('#67E4BF')
        meter.originX = 0
        GridLayout.setRow(meter, 2)
        panel.addChild(meter)
        const offset = scrollValue(list, { execution: 'native', rowHeight: 60 }),
          mapped = offset.to([0, 1500], [0, 1]),
          unbind = bind(meter, { scaleX: mapped })
        controls.addChild(
          button('List audit', 'list-audit', () =>
            report('list-audit', { scroll: inspectScrollValue(offset) }),
          ),
        )
        releases.push(() => {
          unbind()
          offset.dispose()
        })
        const changes = listChanges<Item>(list, {
          key: (item) => item.id,
          exit: 'fadeOut',
          move: { duration: 700 },
        })
        const anchor = () => {
          const native = list.nativeViewProtected
          const index = isIOS
            ? (native.indexPathsForVisibleRows?.firstObject?.row ?? 0)
            : native.getFirstVisiblePosition()
          const top = isIOS
            ? native.rectForRowAtIndexPath(NSIndexPath.indexPathForRowInSection(index, 0))
                .origin.y - native.contentOffset.y
            : (native.getChildAt(0)?.getTop() ?? 0) /
              native.getResources().getDisplayMetrics().density
          return { key: items[index]?.id, index, top }
        }
        const update = (data: Item[], name: string) => {
          const before = anchor()
          items = data
          const handle = changes.update(items)
          report(name, { count: items.length, before })
          void handle.finished.then((done) =>
            report(name + '-settled', { done, after: anchor() }),
          )
        }
        controls.addChild(
          button('Delete', 'list-delete', () => {
            const index = isIOS
              ? Math.floor(Math.max(0, list.ios.contentOffset.y) / 60) + 2
              : list.android.getFirstVisiblePosition() + 2
            update(
              items.filter((_, i) => i !== index),
              'list-delete',
            )
          }),
        )
        controls.addChild(
          button('Insert above', 'list-prepend', () => {
            const id = next--
            update([{ id, title: `Inserted ${id}` }, ...items], 'list-prepend')
          }),
        )
        controls.addChild(
          button('Reverse', 'list-sort', () => update([...items].reverse(), 'list-sort')),
        )
        controls.addChild(
          button('Filter', 'list-filter', () =>
            update(
              items.filter((item) => item.id % 2 === 0),
              'list-filter',
            ),
          ),
        )
        controls.addChild(
          button('Reset', 'list-reset', () =>
            update(
              Array.from({ length: 200 }, (_, id) => ({
                id,
                title: `Row ${id} · stable key`,
              })),
              'list-reset',
            ),
          ),
        )
        releases.push(() => changes.dispose())
        report('scene-list')
      }
      nav.addChild(
        button('Reduce motion', 'reduce-motion', () => {
          configure({ reducedMotion: reducedMotion() ? 'never' : 'always' })
          report('reduced-motion', { reduced: reducedMotion() })
        }),
      )
      nav.addChild(button('Values + scroll', 'scene-values', values))
      nav.addChild(button('Layout exits', 'scene-layout', layout))
      nav.addChild(button('Keyed lists', 'scene-list', lists))
      page.on('loaded', () => {
        try {
          values()
        } catch (error) {
          report('error', { message: String(error) })
        }
      })
      page.on('unloaded', clear)
      return page
    },
  })
}
