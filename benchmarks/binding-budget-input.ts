import {
  Application,
  AbsoluteLayout,
  Button,
  Color,
  GridLayout,
  Label,
  ListView,
  Page,
  ScrollView,
  StackLayout,
  type View,
} from '@nativescript/core'
import {
  bind,
  drag,
  motionValue,
  scrollHeader,
  scrollValue,
  stop,
  type DerivedValue,
} from '../dist/index.js'
import { gestures, GestureSurface } from '../dist/gestures/index.js'
import { getDriver } from '../dist/driver/index.js'
import { instrumentBudgetDriver } from './binding-budget-driver'
import { inputProbe } from './binding-native-diagnostics'

export const inputCases = ['drag-js', 'pan-native', 'scroll-js', 'header-native'] as const
type InputCase = (typeof inputCases)[number]
interface Services {
  environment(view: View): Record<string, unknown>
  resources(view: View): unknown
  probe(view: View): { finish(): string; cancel(): void }
  live(): { nodes: number; clock: number }
  save(report: object): void
  build: Record<string, unknown>
  session: string
  recording: boolean
  inputDelayMs: number
}
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Actual OS gestures are supplied by XCTest/ADB; no synthetic value updates. */
export async function mountInputBudget(page: Page, name: string, services: Services) {
  if (!inputCases.includes(name as InputCase)) throw new Error('Unknown input workload')
  const kind = name as InputCase
  const root = new GridLayout()
  root.rows = 'auto, auto, *, 210, auto'
  root.padding = 20
  page.content = root
  const title = new Label()
  title.text = 'JOLT / INPUT LAB'
  title.color = new Color('#d6ff5f')
  title.fontSize = 16
  root.addChild(title)
  const status = new Label()
  status.text = `${kind} · waiting for layout`
  status.automationText = 'budget-input-state'
  status.color = new Color('#c3d2c7')
  status.fontSize = 16
  status.marginTop = 12
  status.marginBottom = 16
  GridLayout.setRow(status, 1)
  root.addChild(status)
  const stage = new AbsoluteLayout()
  stage.backgroundColor = new Color('#19221e')
  stage.borderRadius = 18
  stage.clipToBounds = true
  GridLayout.setRow(stage, 2)
  root.addChild(stage)
  const pad = new GestureSurface()
  pad.backgroundColor = new Color('#23362c')
  pad.borderRadius = 18
  pad.marginTop = 16
  pad.automationText = 'budget-input-pad'
  GridLayout.setRow(pad, 3)
  root.addChild(pad)
  const button = new Button()
  button.text = 'Start input window'
  button.automationText = 'budget-input-control'
  button.backgroundColor = new Color('#d6ff5f')
  button.color = new Color('#101413')
  button.borderRadius = 16
  GridLayout.setRow(button, 4)
  root.addChild(button)
  await wait(400)
  const releases: (() => void)[] = []
  const diagnostic = instrumentBudgetDriver()
  let jsMoves = 0,
    semanticCallbacks = 0,
    inputState: (() => unknown) | undefined
  let target: View
  let inputSurface: View = pad
  if (kind === 'header-native') {
    root.removeChild(stage)
    root.removeChild(pad)
    const host = new GridLayout()
    host.clipToBounds = true
    GridLayout.setRow(host, 2)
    GridLayout.setRowSpan(host, 2)
    root.addChild(host)
    const list = new ListView()
    inputSurface = list
    list.automationText = 'budget-input-pad'
    let spacer = 280
    list.items = Array.from({ length: 81 }, (_, i) => `Item ${i}`)
    list.on('itemLoading', (args: { index: number; view?: View }) => {
      const label = args.view instanceof Label ? args.view : new Label()
      label.text = args.index ? `Track ${args.index} / Native list` : ''
      label.color = new Color('#d2e5d9')
      label.paddingLeft = 20
      label.height = label.minHeight = label.maxHeight = args.index ? 52 : spacer
      label.backgroundColor = new Color(args.index % 2 ? '#19221e' : '#202c25')
      args.view = label
    })
    host.addChild(list)
    const header = new GridLayout()
    header.height = 280
    header.verticalAlignment = 'top'
    header.backgroundColor = new Color('#334c3d')
    const artwork = new GridLayout()
    artwork.backgroundColor = new Color('#527f63')
    header.addChild(artwork)
    const label = new Label()
    label.text = 'One native scroll.'
    label.fontSize = 28
    label.color = new Color('#e8ffba')
    label.verticalAlignment = 'bottom'
    label.margin = 22
    header.addChild(label)
    const toolbar = new GridLayout()
    toolbar.height = 60
    toolbar.verticalAlignment = 'top'
    toolbar.backgroundColor = new Color('#18291f')
    const compact = new Label()
    compact.text = 'One native scroll.'
    compact.color = new Color('#e8ffba')
    compact.margin = 16
    toolbar.addChild(compact)
    const section = new Label()
    section.text = 'TRACKS / 80'
    section.height = 36
    section.verticalAlignment = 'top'
    section.color = new Color('#d6ff5f')
    section.backgroundColor = new Color('#23362c')
    section.paddingLeft = 16
    host.addChild(header)
    host.addChild(toolbar)
    host.addChild(section)
    await wait(400)
    const controller = scrollHeader(list, {
      header,
      artwork,
      title: label,
      toolbar,
      toolbarTitle: compact,
      section,
      rowHeight: 52,
      expandedHeight: 280,
      minimumHeight: 60,
      setSpacerHeight(height) {
        spacer = height
        list.refresh()
      },
      onState() {
        semanticCallbacks++
      },
    })
    await controller.remeasure()
    target = artwork
    inputState = () => controller.state
    releases.push(() => controller.dispose())
  } else {
    const views = Array.from({ length: 64 }, (_, i) => {
      const tile = new GridLayout()
      tile.width = tile.height = 16
      tile.borderRadius = 5
      tile.backgroundColor = new Color(i % 2 ? '#83c9ad' : '#d6ff5f')
      AbsoluteLayout.setLeft(tile, 4 + ((i % 8) * (stage.getActualSize().width - 60)) / 8)
      AbsoluteLayout.setTop(
        tile,
        16 + (Math.floor(i / 8) * (stage.getActualSize().height - 32)) / 8,
      )
      stage.addChild(tile)
      return tile
    })
    await wait(250)
    let source: DerivedValue
    if (kind === 'pan-native') {
      const controller = gestures(pad, {
        pan: { axis: 'x', bounds: { left: 24, right: 184 } },
        initial: { x: 24 },
        onStart() {
          semanticCallbacks++
        },
        onEnd() {
          semanticCallbacks++
        },
        onCancel() {
          semanticCallbacks++
        },
      })
      source = controller.x
      inputState = () => controller.position
      releases.push(() => controller.dispose())
    } else if (kind === 'drag-js') {
      const value = motionValue(24)
      const controller = drag(pad, {
        axis: 'x',
        value,
        bounds: { left: 24, right: 184 },
        snap: [24, 184],
        onMove() {
          jsMoves++
        },
      })
      source = value
      inputState = () => controller.position
      releases.push(() => {
        controller.dispose()
        stop(value)
      })
    } else {
      const scroll = new ScrollView(),
        content = new StackLayout()
      for (let i = 0; i < 30; i++) {
        const row = new Label()
        row.text = `Scroll / ${i + 1}`
        row.height = 48
        row.paddingLeft = 18
        row.color = new Color('#d6ff5f')
        content.addChild(row)
      }
      scroll.content = content
      pad.addChild(scroll)
      await wait(250)
      const value = scrollValue(scroll)
      const moved = () => jsMoves++
      scroll.on('scroll', moved)
      source = value.to([0, 700], [24, 184])
      inputState = () => ({ offset: scroll.verticalOffset })
      releases.push(() => {
        scroll.off('scroll', moved)
        value.dispose()
      })
    }
    releases.push(
      bind(views, {
        x: source.to([24, 184], [24, 48]),
        scale: source.to([24, 184], [1.25, 1.35]),
      }),
    )
    target = views[0]!
    releases.push(() => stop(views))
    if (kind !== 'scroll-js') {
      const hint = new Label()
      hint.text = 'Drag left ↔ right'
      hint.color = new Color('#c3d2c7')
      hint.horizontalAlignment = 'center'
      hint.verticalAlignment = 'middle'
      pad.addChild(hint)
    }
  }
  await wait(200)
  const env = services.environment(target)
  const report = {
    schema: 1,
    session: services.session,
    input: kind,
    build: services.build,
    device: env,
    recording: services.recording,
    inputDelayMs: services.inputDelayMs,
    completed: false,
    events: [] as object[],
  }
  let suspensions = 0
  const suspended = () => suspensions++
  Application.on(Application.suspendEvent, suspended)
  releases.push(() => Application.off(Application.suspendEvent, suspended))
  let sampler: ReturnType<Services['probe']> | undefined,
    touches: ReturnType<typeof inputProbe> | undefined,
    started = false,
    disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const release of releases.reverse()) release()
  }
  const capture = (name: string) => ({
    name,
    timeMs: getDriver().now(),
    driver: diagnostic.snapshot(),
    jsMoves,
    semanticCallbacks,
    suspensions,
    live: services.live(),
    inputState: inputState?.(),
  })
  status.text = 'Ready'
  button.on('tap', async () => {
    if (!started) {
      started = true
      sampler = services.probe(target)
      touches = inputProbe(inputSurface, services.inputDelayMs)
      report.events.push(capture('start'))
      button.text = 'Finish input window'
      status.text = 'Sampling'
    } else if (!disposed) {
      report.events.push(capture('end'))
      const native = JSON.parse(sampler!.finish())
      const input = JSON.parse(touches!.finish())
      touches = undefined
      sampler = undefined
      dispose()
      report.events.push(capture('disposed'))
      await wait(650)
      report.events.push(capture('idle'))
      report.completed = true
      services.save({
        ...report,
        native,
        touchTrace: input,
        resources: services.resources(target),
        ...diagnostic.evidence(),
      })
      diagnostic.restore()
      status.text = 'Completed'
      button.isEnabled = false
    }
  })
  page.once('unloaded', () => {
    dispose()
    sampler?.cancel()
    touches?.cancel()
    diagnostic.restore()
  })
}
