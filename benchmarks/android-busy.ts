import {
  Application,
  Button,
  Color,
  GridLayout,
  Label,
  Page,
  StackLayout,
  knownFolders,
  isAndroid,
} from '@nativescript/core'
import { BusyTrial, TRIAL_MS, type BusyMode } from '../demo/src/busy-trial'

declare const __BENCHMARK_BUILD__: Record<string, unknown>
const ACTION = 'org.nativescript.jolt.BUSY_BENCHMARK'
const report: Record<string, unknown> = { build: __BENCHMARK_BUILD__, phase: 'loading' }
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
function save(phase: string, details: Record<string, unknown> = {}) {
  Object.assign(report, { phase, ...details })
  knownFolders
    .externalDocuments()
    .getFile('jolt-busy.json')
    .writeTextSync(JSON.stringify(report, null, 2))
}
function check(value: unknown, message: string) {
  if (!value) throw Error(message)
}

Application.run({
  create: () => {
    if (!isAndroid) throw Error('Android only.')
    const page = new Page()
    page.actionBarHidden = true
    page.backgroundColor = new Color('#18181b')
    const root = new StackLayout()
    root.padding = 24
    page.content = root
    const title = new Label()
    title.text = 'Busy JavaScript'
    title.fontSize = 26
    title.color = new Color('white')
    root.addChild(title)
    const status = new Label()
    status.text = 'Checking…'
    status.textWrap = true
    status.color = new Color('#a1a1aa')
    status.marginBottom = 20
    root.addChild(status)
    function panel(text: string, color: string) {
      const row = new StackLayout()
      row.marginBottom = 18
      root.addChild(row)
      const heading = new Label()
      heading.text = text
      heading.color = new Color('white')
      row.addChild(heading)
      const stage = new GridLayout()
      stage.height = 110
      stage.backgroundColor = '#27272a'
      row.addChild(stage)
      const tile = new GridLayout()
      tile.width = tile.height = 72
      tile.backgroundColor = color
      stage.addChild(tile)
      return tile
    }
    const jolt = panel('Jolt · spin preset', '#f59e0b')
    const layered = panel('ViewPropertyAnimator · withLayer', '#8b5cf6')
    const reveal = panel('Native circular reveal · control', '#22c55e')
    for (const [view, text] of [
      [jolt, 'J'],
      [layered, 'L'],
    ] as const) {
      const label = new Label()
      label.text = text
      label.fontSize = 42
      label.fontWeight = 'bold'
      label.color = new Color('white')
      label.textAlignment = 'center'
      view.addChild(label)
    }
    const trial = new BusyTrial({ jolt, layered, reveal })
    let busy = true,
      generation = 0
    Application.on(Application.suspendEvent, () => generation++)
    const buttons = new GridLayout()
    buttons.columns = '*, *, *'
    root.addChild(buttons)
    async function run(mode: string | null) {
      if (busy || !['idle', 'main', 'worker'].includes(mode ?? '')) return
      busy = true
      try {
        const visibleGeneration = generation
        check(jolt.android.hasWindowFocus(), 'Keep the benchmark in the foreground.')
        check(
          android.animation.ValueAnimator.getDurationScale() === 1,
          'Use Animator duration scale 1x.',
        )
        status.text = mode!
        await wait(120)
        const result = await trial.run(mode as BusyMode, () => save('playing', { mode }))
        check(
          generation === visibleGeneration && jolt.android.hasWindowFocus(),
          'Trial left foreground.',
        )
        check(
          result.mode === 'idle' || result.work.elapsedMs >= 300,
          'Work ended too early.',
        )
        check(
          result.mode !== 'worker' || result.work.threadId !== result.mainThreadId,
          'Worker ran on the main thread.',
        )
        check(result.layerAfter === 0, 'Hardware layer leaked.')
        status.text = `${mode} · done`
        save('done', { result })
      } catch (error) {
        status.text = String(error)
        save('error', { error: String(error) })
      } finally {
        busy = false
      }
    }
    for (const [index, mode] of ['idle', 'main', 'worker'].entries()) {
      const button = new Button()
      button.text = mode
      button.on('tap', () => void run(mode))
      GridLayout.setColumn(button, index)
      buttons.addChild(button)
    }
    let loaded = false
    page.on('loaded', () => {
      if (loaded) return
      loaded = true
      void (async () => {
        await wait(500)
        check(android.os.Build.VERSION.SDK_INT >= 26, 'Android 8+ required.')
        check(
          android.animation.ValueAnimator.getDurationScale() === 1,
          'Use Animator duration scale 1x.',
        )
        // Start/cancel a worker trial before playback to exercise pending-worker cleanup.
        const pending = trial.run('worker')
        trial.stop()
        await pending.then(
          () => {
            throw Error('Pending trial did not cancel.')
          },
          () => {},
        )
        await trial.run('worker')
        const stopped = trial.run('idle')
        await wait(100)
        trial.stop()
        await stopped.then(
          () => {
            throw Error('Running trial did not cancel.')
          },
          () => {},
        )
        check(layered.android.getLayerType() === 0, 'Cancelled trial leaked a layer.')
        jolt.rotate = 0
      layered.rotate = 0
      jolt.android.setRotation(0)
      layered.android.setRotation(0)
      const bounds = Object.fromEntries(
          Object.entries({ jolt, layered, reveal }).map(([name, view]) => {
            const location = Array.create('int', 2)
            view.android.getLocationOnScreen(location)
            return [
              name,
              {
                x: location[0],
                y: location[1],
                width: view.android.getWidth(),
                height: view.android.getHeight(),
              },
            ]
          }),
        )
        save('ready', {
          lifecyclePassed: true,
          duration: TRIAL_MS,
          workMs: 300,
          workDelayMs: 400,
          bounds,
          sdk: android.os.Build.VERSION.SDK_INT,
          device: android.os.Build.MODEL,
          debuggable: !!(
            Application.android.context.getApplicationInfo().flags &
            android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE
          ),
        })
        status.text = 'Ready'
        busy = false
        Application.android.registerBroadcastReceiver(
          ACTION,
          (_context, intent) => void run(intent.getStringExtra('mode')),
        )
      })().catch((error) => {
        status.text = String(error)
        save('error', { error: String(error) })
      })
    })
    return page
  },
})
