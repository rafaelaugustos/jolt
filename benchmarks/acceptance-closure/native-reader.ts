import {
  Application,
  Button,
  Color,
  File,
  GridLayout,
  Label,
  ListView,
  Page,
  StackLayout,
  WrapLayout,
  isIOS,
  knownFolders,
  type View,
} from '@nativescript/core'
import { CollectionView } from '@nativescript-community/ui-collectionview'
import {
  animateLayout,
  configure,
  listChanges,
  collectionViewListAdapter,
  type Animation,
} from '@rafaelaugusto/jolt'

/** Acceptance-only UI. Readers and gestures are driven by the external OS runners. */
export function runReaderAcceptance() {
  Application.run({
    create: () => {
      const page = new Page()
      page.actionBarHidden = true
      page.backgroundColor = new Color('#0c1222')
      const root = new GridLayout()
      root.rows = 'auto,auto,*,auto'
      root.padding = 18
      page.content = root
      const title = new Label()
      title.text = 'Jolt · Reader acceptance'
      title.fontSize = 22
      title.color = new Color('#e7ecf5')
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
      status.height = 56
      status.color = new Color('#b6c7df')
      status.automationText = 'reader-status'
      GridLayout.setRow(status, 3)
      root.addChild(status)
      const events: object[] = []
      const session = Date.now()
      let scene = 'exits'
      let release = () => {}
      const timers = new Set<ReturnType<typeof setTimeout>>()
      const later = (run: () => void, delay: number) => {
        const timer = setTimeout(() => {
          timers.delete(timer)
          run()
        }, delay)
        timers.add(timer)
      }
      const flights = () =>
        isIOS
          ? JoltSharedLayoutFlight.activeCount()
          : org.rafaelaugusto.jolt.SharedLayoutFlight.activeCount()
      const focused = () => {
        if (isIOS) {
          const view = UIAccessibilityFocusedElement(null) as any
          return view
            ? {
                label: String(view.accessibilityLabel ?? ''),
                id: String(view.accessibilityIdentifier ?? ''),
                className: String(NSStringFromClass(view.class())),
                isView: view instanceof UIView,
              }
            : null
        }
        const visit = (view: any): any => {
          if (view.isAccessibilityFocused())
            return {
              label: String(view.getContentDescription?.() ?? view.getText?.() ?? ''),
              id: String(view.getTag?.() ?? ''),
            }
          for (let i = 0; i < (view.getChildCount?.() ?? 0); i++) {
            const found = visit(view.getChildAt(i))
            if (found) return found
          }
          return null
        }
        return page.nativeViewProtected
          ? visit(page.nativeViewProtected.getRootView())
          : null
      }
      const report = (name: string, detail: object = {}) => {
        const event = {
          name,
          time: Date.now(),
          flights: flights(),
          focus: focused(),
          readerRunning: isIOS ? UIAccessibilityIsVoiceOverRunning() : true,
          ...detail,
        }
        events.push(event)
        status.text = `${name} · focus: ${event.focus?.label ?? 'none'} · copies: ${event.flights}`
        const json = JSON.stringify({
          session,
          scene,
          platform: isIOS ? 'ios-simulator' : 'android-emulator',
          events,
        })
        for (const filename of [
          'reader-acceptance',
          `reader-acceptance-${session}-${scene}`,
        ])
          File.fromPath(
            knownFolders.documents().path + '/' + filename + '.json',
          ).writeTextSync(json)
      }
      const button = (text: string, id: string, run: () => void) => {
        const view = new Button()
        view.text = text
        view.automationText = id
        view.accessibilityLabel = text
        view.fontSize = 13
        view.margin = 3
        view.padding = 8
        view.color = new Color('#e7ecf5')
        view.backgroundColor = new Color('#203553')
        view.on('tap', () => {
          try {
            run()
          } catch (error) {
            report('error', { message: String(error) })
          }
        })
        return view
      }
      const clear = () => {
        for (const timer of timers) clearTimeout(timer)
        timers.clear()
        release()
        release = () => {}
        body.removeChildren()
        report('cleanup')
      }
      const label = (text: string, id: string) => {
        const view = new Label()
        view.text = text
        view.automationText = id
        view.accessibilityLabel = text
        view.accessible = true
        view.color = new Color('#e7ecf5')
        view.fontSize = 18
        return view
      }
      const exits = () => {
        clear()
        scene = 'exits'
        configure({ reducedMotion: 'never' })
        const panel = new StackLayout(),
          controls = new WrapLayout(),
          cards = new StackLayout()
        body.addChild(panel)
        panel.addChild(controls)
        panel.addChild(cards)
        let animation: Animation | undefined
        let bravo: View | undefined
        const names = ['Alpha', 'Bravo', 'Charlie', 'Delta']
        const reset = () => {
          animation?.stop()
          cards.removeChildren()
          for (const name of names) {
            const box = new GridLayout()
            box.height = 72
            box.padding = 16
            box.marginBottom = 10
            box.borderRadius = 12
            box.backgroundColor = new Color('#295482')
            box.addChild(label('Card ' + name, 'card-' + name.toLowerCase()))
            cards.addChild(box)
            if (name === 'Bravo') bravo = box
          }
          report('exits-ready')
        }
        const remove = (target?: View) => {
          if (!target || target.parent !== cards) return
          animation = animateLayout(cards, () => cards.removeChild(target), {
            duration: 30000,
            exit: { opacity: 0, y: 22, scale: 0.92 },
          })
          report('exit-start')
          void animation.finished.then((done) => report('exit-settled', { done }))
        }
        controls.addChild(button('Remove Bravo', 'exit-remove', () => remove(bravo)))
        controls.addChild(
          button('Remove next', 'exit-next', () => remove(cards.getChildAt(1))),
        )
        controls.addChild(
          button('Cancel exit', 'exit-cancel', () => {
            report('exit-cancel-before')
            animation?.stop()
            report('exit-cancel')
          }),
        )
        controls.addChild(
          button('Reinsert Bravo', 'exit-reinsert', () => {
            if (bravo && !bravo.parent) cards.insertChild(bravo, 1)
            report('exit-reinsert')
          }),
        )
        controls.addChild(button('Reset cards', 'exit-reset', reset))
        controls.addChild(
          button('Reduced removal', 'exit-reduced', () => {
            reset()
            configure({ reducedMotion: 'always' })
            remove(bravo)
            report('exit-reduced')
          }),
        )
        release = () => {
          animation?.stop()
          configure({ reducedMotion: 'user' })
        }
        reset()
      }
      const lists = (collection = false) => {
        clear()
        scene = collection ? 'collections' : 'lists'
        configure({ reducedMotion: 'never' })
        const panel = new GridLayout()
        panel.rows = 'auto,*'
        body.addChild(panel)
        const controls = new WrapLayout()
        panel.addChild(controls)
        const list = collection ? new CollectionView() : new ListView()
        list.rowHeight = 60
        if (list instanceof CollectionView) list.colWidth = { unit: '%', value: 1 }
        list.automationText = 'reader-list'
        if (list instanceof ListView) list.separatorColor = new Color('#344a6b')
        list.backgroundColor = new Color('#1a2b45')
        GridLayout.setRow(list, 1)
        panel.addChild(list)
        type Item = { id: number; title: string; tag: string }
        let items: Item[] = Array.from({ length: 200 }, (_, id) => ({
          id,
          title: 'Row ' + id,
          tag: 'reader-row-' + id,
        }))
        list.itemTemplateSelector = () => 'row'
        list.itemTemplates = [
          {
            key: 'row',
            createView: () => {
              const row = new GridLayout()
              row.height = 60
              row.padding = 14
              row.backgroundColor = new Color('#1a2b45')
              const text = label('', '')
              text.bind({ sourceProperty: 'title', targetProperty: 'text' })
              text.bind({ sourceProperty: 'title', targetProperty: 'accessibilityLabel' })
              text.bind({ sourceProperty: 'tag', targetProperty: 'automationText' })
              row.addChild(text)
              return row
            },
          },
        ]
        list.items = items
        const changes = listChanges<Item>(list, {
          key: (item) => item.id,
          exit: 'fadeOut',
          move: { duration: 1200 },
          adapter: collection ? collectionViewListAdapter<Item>(list) : undefined,
        })
        const update = (next: Item[], name: string) => {
          report(name + '-before', { keys: items.slice(0, 8).map((item) => item.id) })
          items = next
          const handle = changes.update(items)
          report(name + '-start', { keys: items.slice(0, 8).map((item) => item.id) })
          void handle.finished.then((done) => {
            report(name + '-settled', { done })
            later(() => report(name + '-focus', { done }), 600)
          })
        }
        const move = () => {
          const next = [...items]
          const one = next.findIndex((item) => item.id === 1),
            two = next.findIndex((item) => item.id === 2)
          ;[next[one], next[two]] = [next[two]!, next[one]!]
          update(next, 'list-move')
        }
        const arm = (name: string, run: () => void) => {
          report(name + '-armed')
          later(run, 8000)
        }
        controls.addChild(button('Arm move', 'list-move', () => arm('list-move', move)))
        controls.addChild(
          button('Arm insert', 'list-insert', () =>
            arm('list-insert', () =>
              update(
                [{ id: -1, title: 'Inserted row', tag: 'reader-row-inserted' }, ...items],
                'list-insert',
              ),
            ),
          ),
        )
        controls.addChild(
          button('Arm interrupt', 'list-interrupt', () =>
            arm('list-interrupt', () => {
              move()
              later(move, 350)
            }),
          ),
        )
        controls.addChild(
          button('Outside anchor', 'outside-anchor', () => report('outside-anchor')),
        )
        controls.addChild(
          button('Reduced move', 'list-reduced', () =>
            arm('list-reduced', () => {
              configure({ reducedMotion: 'always' })
              move()
            }),
          ),
        )
        controls.addChild(button('Read focus', 'read-focus', () => report('list-focus')))
        release = () => {
          changes.dispose()
          configure({ reducedMotion: 'user' })
        }
        report('lists-ready', { count: items.length, collection })
      }
      nav.addChild(button('Exit traversal', 'reader-exits', exits))
      nav.addChild(button('List focus', 'reader-lists', () => lists()))
      nav.addChild(button('Collection focus', 'reader-collections', () => lists(true)))
      nav.addChild(button('Dispose scene', 'reader-dispose', clear))
      page.on('loaded', exits)
      page.on('unloaded', clear)
      return page
    },
  })
}
