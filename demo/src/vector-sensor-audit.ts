import {
  Application,
  Button,
  Color,
  Device,
  File,
  GridLayout,
  isIOS,
  knownFolders,
  Label,
  Page,
  StackLayout,
} from '@nativescript/core'
import { bind, motionScope } from '@rafaelaugusto/jolt'
import { sensor, type Sensor, type SensorKind } from '@rafaelaugusto/jolt/sensors'
import { replaySensor } from '@rafaelaugusto/jolt/testing'

declare const JoltSensorSource: { activeCount(): number; sourceCount(): number }
declare const org: { rafaelaugusto: { jolt: { SensorSource: typeof JoltSensorSource } } }

/** Explicit diagnostic screen; test input is labelled and never called hardware evidence. */
export function vectorSensorAudit() {
  const page = new Page()
  page.actionBarHidden = true
  page.backgroundColor = new Color('#102922')
  const content = new StackLayout()
  content.padding = 16
  page.content = content
  const title = new Label()
  Object.assign(title, {
    text: 'Six sensor sources',
    color: '#eff5da',
    fontSize: 24,
    marginBottom: 6,
  })
  content.addChild(title)
  const mode = new Label()
  Object.assign(mode, {
    text: 'LIVE HARDWARE · availability varies',
    color: '#c9d7bc',
    fontSize: 12,
    textWrap: true,
  })
  content.addChild(mode)
  const kinds: SensorKind[] = [
    'rotation',
    'gravity',
    'acceleration',
    'linearAcceleration',
    'gyroscope',
    'magneticField',
  ]
  const limits = [Math.PI, 12, 12, 12, 6, 100]
  const units = ['rad', 'm/s²', 'm/s²', 'm/s²', 'rad/s', 'µT']
  const rows = kinds.map((kind) => {
    const row = new GridLayout()
    row.rows = 'auto,36'
    row.height = 64
    const label = new Label()
    Object.assign(label, { color: '#eff5da', fontSize: 12 })
    row.addChild(label)
    const rail = new GridLayout()
    rail.width = 180
    rail.rows = '12,12,12'
    GridLayout.setRow(rail, 1)
    row.addChild(rail)
    const dots = ['#f5b975', '#b9df8b', '#81c8ec'].map((color, index) => {
      const dot = new Label()
      Object.assign(dot, {
        width: 9,
        height: 9,
        borderRadius: 4,
        backgroundColor: color,
        automationText: `vector-${kind}-${index}`,
      })
      GridLayout.setRow(dot, index)
      rail.addChild(dot)
      return dot
    })
    content.addChild(row)
    return { label, dots }
  })
  const legend = new Label()
  Object.assign(legend, {
    text: 'X amber · Y green · Z blue · normalized display ranges',
    color: '#c9d7bc',
    fontSize: 11,
    textWrap: true,
  })
  content.addChild(legend)
  let scope: ReturnType<typeof motionScope> | undefined
  let sources: Sensor[] = [],
    simulated = false,
    disposed = false
  const buttons: Button[] = []
  const session = Date.now(),
    events: object[] = []
  const native = () => (isIOS ? JoltSensorSource : org.rafaelaugusto.jolt.SensorSource)
  const snapshot = (name: string) => {
    events.push({
      name,
      time: Date.now(),
      input: simulated ? 'explicit-test-input' : 'hardware',
      active: native().activeCount(),
      sourceCount: native().sourceCount(),
      sources: sources.map((source) => ({
        kind: source.kind,
        unit: source.unit,
        ...source.snapshot(),
      })),
    })
    const directory = isIOS
      ? knownFolders.documents().path
      : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
    const controls = buttons.flatMap((button) => {
      if (isIOS || !button.android) return []
      const rect = new android.graphics.Rect()
      if (!button.android.getGlobalVisibleRect(rect)) return []
      return [
        {
          id: button.automationText,
          x: rect.centerX(),
          y: rect.centerY(),
          width: rect.width(),
          height: rect.height(),
        },
      ]
    })
    File.fromPath(directory + '/vector-sensors.json').writeTextSync(
      JSON.stringify(
        {
          session,
          platform: isIOS ? 'ios' : 'android',
          model: Device.model,
          osVersion: Device.osVersion,
          controls,
          events,
        },
        null,
        2,
      ),
    )
  }
  const setup = (testInput: boolean) => {
    if (disposed) return
    scope?.dispose()
    simulated = testInput
    scope = motionScope()
    mode.text = testInput
      ? 'EXPLICIT TEST INPUT · not physical sensor evidence'
      : 'LIVE HARDWARE · availability varies'
    sources = kinds.map((kind, index) => {
      const row = rows[index]!
      const source = sensor(kind, {
        scope,
        onStatus: (status) => {
          row.label.text = `${kind} · ${units[index]} · ${status}`
        },
      })
      row.label.text = `${kind} · ${source.unit} · ${source.status}`
      if (testInput) {
        const amplitude = limits[index]! * 0.8
        replaySensor(
          source,
          Array.from({ length: 601 }, (_, step) => {
            const phase = (step / 600) * Math.PI * 4
            return {
              time: step * 25,
              values:
                kind === 'rotation'
                  ? [
                      0,
                      Math.sin(Math.sin(phase) * 0.6),
                      0,
                      Math.cos(Math.sin(phase) * 0.6),
                    ]
                  : [
                      Math.sin(phase) * amplitude,
                      Math.sin(phase + 1) * amplitude,
                      Math.cos(phase) * amplitude,
                    ],
            }
          }),
        )
      }
      for (const [axis, dot] of row.dots.entries()) {
        const value = [source.x, source.y, source.z][axis]!
        scope!.use(() =>
          bind(dot, { x: value.to([-limits[index]!, limits[index]!], [-75, 75]) }),
        )
      }
      return source
    })
    snapshot(testInput ? 'preview' : 'hardware')
  }
  const controls = new GridLayout()
  controls.columns = '*,*'
  controls.rows = '44,44,44'
  content.addChild(controls)
  const actions: [string, string, () => void][] = [
    ['Live hardware', 'vector-live', () => setup(false)],
    ['Test input', 'vector-preview', () => setup(true)],
    [
      'Pause',
      'vector-pause',
      () => {
        scope?.suspend()
        snapshot('paused')
      },
    ],
    [
      'Resume',
      'vector-resume',
      () => {
        scope?.resume()
        snapshot('resumed')
      },
    ],
    ['Snapshot', 'vector-snapshot', () => snapshot('snapshot')],
    ['Close', 'vector-close', () => page.closeModal()],
  ]
  actions.forEach(([text, id, action], index) => {
    const button = new Button()
    buttons.push(button)
    Object.assign(button, {
      text,
      automationText: id,
      color: '#102922',
      backgroundColor: '#d6e7b5',
      borderRadius: 10,
      margin: 3,
      fontSize: 12,
    })
    GridLayout.setRow(button, Math.floor(index / 2))
    GridLayout.setColumn(button, index % 2)
    button.on('tap', action)
    controls.addChild(button)
  })
  const dispose = () => {
    if (disposed) return
    disposed = true
    scope?.dispose()
    snapshot('disposed')
  }
  page.once('loaded', () => setup(false))
  page.on('layoutChanged', () => {
    if (sources.length && !disposed) snapshot('layout')
  })
  page.on('closedModally', dispose)
  return { page, dispose }
}
