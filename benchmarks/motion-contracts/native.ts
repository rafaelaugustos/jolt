import {
  Application,
  Button,
  Color,
  File,
  GridLayout,
  Image,
  ImageSource,
  Label,
  Page,
  ScrollView,
  StackLayout,
  WrapLayout,
  knownFolders,
  isIOS,
} from '@nativescript/core'
import {
  set,
  bind,
  drag,
  gestureRelations,
  motionValue,
  springValue,
  press,
  zoomable,
  type GestureRelations,
  type Zoomable,
} from '@rafaelaugusto/jolt'
import { GestureSurface, gestures, type Gestures } from '../../dist/gestures/index'
import { bottomSheet, type BottomSheet } from '../../dist/bottom-sheet/index'
import { reorder, type Reorder } from '../../dist/reorder/index'

/** Interactive native acceptance lab. Recognizers, arbitration and presentation use production code. */
export function runMotionContracts() {
  Application.run({
    create: () => {
      const page = new Page()
      page.actionBarHidden = true
      page.backgroundColor = new Color('#101622')
      const root = new GridLayout()
      root.rows = 'auto,auto,*,auto'
      root.padding = 18
      page.content = root
      const title = new Label()
      title.text = 'Jolt · Motion contracts'
      title.color = new Color('#edf2ff')
      title.fontSize = 24
      title.fontWeight = 'bold'
      root.addChild(title)
      const nav = new WrapLayout()
      GridLayout.setRow(nav, 1)
      root.addChild(nav)
      const body = new GridLayout()
      body.backgroundColor = new Color('#172337')
      body.borderRadius = 18
      GridLayout.setRow(body, 2)
      root.addChild(body)
      const status = new Label()
      status.textWrap = true
      status.color = new Color('#c1cde1')
      status.fontSize = 13
      status.height = 90
      status.automationText = 'contract-status'
      GridLayout.setRow(status, 3)
      root.addChild(status)
      let generation = 0,
        relations: GestureRelations | undefined,
        outer: Gestures | undefined,
        inner: Gestures | undefined,
        sheet: BottomSheet | undefined,
        photo: Zoomable | undefined,
        list: Reorder<string> | undefined
      let spring: ReturnType<typeof springValue> | undefined,
        derivative: ReturnType<ReturnType<typeof springValue>['velocity']> | undefined
      const releases: (() => void)[] = [],
        log: string[] = []
      let rows: { key: string; target: GestureSurface }[] = []
      const snapshot = () => ({
        log: [...log],
        outer: outer ? { x: outer.x.get(), y: outer.y.get() } : undefined,
        inner: inner ? { x: inner.x.get(), y: inner.y.get() } : undefined,
        height: sheet?.visibleHeight,
        photo: photo?.state,
        order: rows.map((row) => row.key),
        spring: spring?.get(),
        speed: spring?.getVelocity(),
        derivative: derivative?.get(),
      })
      const report = (name?: string) => {
        if (name) log.push(name)
        const s = snapshot()
        status.text =
          (log.slice(-3).join(' → ') || 'Ready') +
          '\n' +
          (photo
            ? `photo ${photo.state.scale.toFixed(2)}× · sheet ${sheet?.visibleHeight.toFixed(0)}`
            : spring
              ? `position ${spring.get().toFixed(1)} · velocity ${spring.getVelocity().toFixed(1)} · derivative ${derivative?.get().toFixed(1)}`
              : `inner x ${inner?.x.get().toFixed(0) ?? 0} · outer x ${outer?.x.get().toFixed(0) ?? 0}`)
        File.fromPath(
          knownFolders.documents().path + '/motion-contracts.json',
        ).writeTextSync(JSON.stringify(s))
      }
      const button = (name: string, run: () => void, parent = nav) => {
        const b = new Button()
        b.text = name
        b.automationText = name
        b.fontSize = 12
        b.padding = 8
        b.margin = 3
        b.color = new Color('#edf2ff')
        b.backgroundColor = new Color('#24354e')
        b.on('tap', run)
        parent.addChild(b)
        return b
      }
      const label = (text: string) => {
        const l = new Label()
        l.text = text
        l.textWrap = true
        l.color = new Color('#edf2ff')
        l.padding = 18
        l.fontSize = 17
        return l
      }
      const surface = (name: string) => {
        const v = new GestureSurface()
        v.automationText = name
        v.backgroundColor = new Color('#866ce2')
        v.borderRadius = 14
        return v
      }
      const own = <T extends { dispose(): void }>(value: T) => {
        releases.push(() => value.dispose())
        return value
      }
      const later = (fn: () => void) => {
        const current = generation
        setTimeout(() => {
          if (current !== generation) return
          try {
            fn()
            report()
          } catch (error) {
            report('ERROR ' + String(error))
            throw error
          }
        }, 160)
      }
      function setup(mode: string) {
        generation++
        relations?.dispose()
        relations = undefined
        for (const release of releases.splice(0).reverse()) release()
        body.removeChildren()
        log.length = 0
        outer = inner = undefined
        sheet = photo = list = undefined
        spring = derivative = undefined
        rows = []
        if (
          mode === 'Inner waits' ||
          mode === 'Outer waits' ||
          mode === 'Press & carousel'
        ) {
          const parent = surface('contract-outer')
          parent.backgroundColor = new Color('#25435b')
          parent.margin = 12
          body.addChild(parent)
          const child = surface('contract-inner')
          child.height = 150
          child.margin = 35
          child.verticalAlignment = 'middle'
          child.addChild(
            label(
              mode === 'Press & carousel'
                ? 'Press, then pan the carousel'
                : 'Drag horizontally\n' + mode + ' for failure',
            ),
          )
          parent.addChild(child)
          later(() => {
            const innerWaits = mode === 'Inner waits'
            outer = own(
              gestures(parent, {
                pan: { axis: mode === 'Press & carousel' ? 'x' : innerWaits ? 'y' : 'x' },
                onStart: () => report('outer start'),
                onEnd: () => report('outer end'),
                onCancel: () => report('outer cancel'),
              }),
            )
            releases.push(bind(parent, { x: outer.x, y: outer.y }))
            if (mode === 'Press & carousel') {
              const feedback = press(child, { scale: 0.9 })
              releases.push(feedback)
              relations = gestureRelations([
                { gesture: outer, other: feedback, relation: 'block' },
              ])
            } else {
              inner = own(
                gestures(child, {
                  pan: { axis: innerWaits ? 'x' : 'y' },
                  onStart: () => report('inner start'),
                  onEnd: () => report('inner end'),
                  onCancel: () => report('inner cancel'),
                }),
              )
              releases.push(bind(child, { x: inner.x, y: inner.y }))
              relations = gestureRelations([
                {
                  gesture: innerWaits ? inner : outer,
                  other: innerWaits ? outer : inner,
                  relation: 'waitFor',
                },
              ])
            }
          })
        } else if (mode === 'Photo & sheet') {
          const panel = surface('contract-panel')
          panel.backgroundColor = new Color('#25435b')
          panel.rows = '44,*'
          body.addChild(panel)
          const grip = label('Photo inside a sheet · pinch wins')
          grip.automationText = 'contract-grip'
          grip.padding = 8
          panel.addChild(grip)
          const viewport = new GridLayout()
          viewport.automationText = 'contract-photo'
          GridLayout.setRow(viewport, 1)
          panel.addChild(viewport)
          const image = new Image()
          image.stretch = 'aspectFit'
          image.imageSource = ImageSource.fromFileSync(
            knownFolders.currentApp().path + '/motion-photo.png',
          )
          viewport.addChild(image)
          later(() => {
            sheet = own(
              bottomSheet(panel, {
                handle: grip,
                snap: [180, 420],
                dismissible: false,
                keyboard: 'none',
              }),
            )
            photo = own(
              zoomable(image, {
                viewport,
                dismiss: false,
                onSettled: () => report('photo settled'),
              }),
            )
            later(() => {
              relations = gestureRelations([
                { gesture: sheet!, other: photo!, relation: 'waitFor', otherKind: 'pan' },
                { gesture: photo!, kind: 'pinch', other: sheet!, relation: 'block' },
              ])
              sheet!.open(420)
            })
          })
        } else if (mode === 'Swipe & reorder') {
          const scroll = new ScrollView(),
            container = new StackLayout()
          scroll.content = container
          body.addChild(scroll)
          for (const key of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot']) {
            const row = surface(key)
            row.height = 74
            row.margin = 8
            row.addChild(label(key + ' · swipe or hold'))
            container.addChild(row)
            rows.push({ key, target: row })
          }
          later(() => {
            list = own(
              reorder(container, {
                items: () => rows,
                scroll,
                longPress: 350,
                onStart: () => report('reorder start'),
                onCancel: (e) => report('reorder cancel:' + e.reason),
                onCommit(move) {
                  const from = rows.findIndex((row) => row.key === move.key),
                    row = rows.splice(from, 1)[0]!
                  const to =
                    move.beforeKey === null
                      ? rows.length
                      : rows.findIndex((row) => row.key === move.beforeKey)
                  rows.splice(to, 0, row)
                  container.removeChild(row.target)
                  container.insertChild(row.target, to)
                  report('reorder commit')
                },
              }),
            )
            const row = rows[0]!.target
            const swipe = own(
              drag(row, {
                axis: 'x',
                snap: [0],
                onStart: () => report('swipe start'),
                onRelease: () => report('swipe end'),
                onCancel: () => report('swipe cancel'),
              }),
            )
            relations = gestureRelations([
              { gesture: swipe, other: list, relation: 'waitFor' },
            ])
          })
        } else {
          const controls = new WrapLayout()
          controls.verticalAlignment = 'top'
          body.addChild(controls)
          const dot = new GridLayout()
          dot.width = 56
          dot.height = 56
          dot.borderRadius = 28
          dot.backgroundColor = new Color('#a68aff')
          dot.horizontalAlignment = 'left'
          dot.marginLeft = 20
          body.addChild(dot)
          later(() => {
            const source = own(motionValue(0))
            spring = own(springValue(source, { stiffness: 15, damping: 1.2 }))
            const scaled = own(spring.mul(2))
            derivative = own(scaled.velocity())
            releases.push(bind(dot, { x: spring }))
            button(
              'Move',
              () => {
                set(source, source.get() ? 0 : 220)
              },
              controls,
            )
            button(
              'Pause',
              () => {
                spring!.pause()
                report('paused')
              },
              controls,
            )
            button(
              'Resume',
              () => {
                spring!.play()
                report('resumed')
              },
              controls,
            )
          })
        }
        report()
      }
      for (const name of [
        'Inner waits',
        'Outer waits',
        'Photo & sheet',
        'Swipe & reorder',
        'Press & carousel',
        'Paused velocity',
      ])
        button(name, () => setup(name))
      button('Snapshot', () => report())
      page.on('loaded', () => setup('Inner waits'))
      page.on('unloaded', () => {
        generation++
        relations?.dispose()
        for (const release of releases.splice(0).reverse()) release()
      })
      return page
    },
  })
}
