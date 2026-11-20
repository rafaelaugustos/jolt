import {
  Application,
  Color,
  File,
  GridLayout,
  Label,
  Page,
  StackLayout,
  isIOS,
  knownFolders,
} from '@nativescript/core'
import { animate, bind, configure, motionValue, set } from '@rafaelaugusto/jolt'
import { PortableReveal, portableReveal } from '../../demo/src/portable-reveal'
import { measureInspection } from '../../demo/src/inspection-audit'
import { environment, probe, resources } from '../../demo/src/portable-audit'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
declare const __PLAYBACK_EFFICIENCY_BUILD__: object

// Measurement-only entry point. Run without a recorder or another native test.
Application.run({
  create() {
    const page = new Page()
    page.actionBarHidden = true
    page.backgroundColor = new Color('#0c1222')
    const stack = new StackLayout()
    stack.padding = 24
    page.content = stack
    const status = new Label()
    status.color = new Color('#e7ecf5')
    status.textWrap = true
    stack.addChild(status)
    const bars = Array.from({ length: 3 }, () => {
      const bar = new PortableReveal()
      bar.height = 12
      bar.marginTop = 8
      stack.addChild(bar)
      return bar
    })
    const stage = new GridLayout()
    stage.rows = Array(16).fill('20').join(',')
    stack.addChild(stage)
    const views = Array.from({ length: 16 }, (_, index) => {
      const view = new Label()
      view.width = 28
      view.height = 14
      view.horizontalAlignment = 'center'
      view.backgroundColor = new Color('#67e4bf')
      GridLayout.setRow(view, index)
      stage.addChild(view)
      return view
    })
    let alive = true,
      started = false
    page.on('unloaded', () => {
      alive = false
    })
    const directory = () =>
      isIOS
        ? knownFolders.documents().path
        : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
    const save = (name: string, data: object) =>
      File.fromPath(directory() + '/' + name).writeTextSync(JSON.stringify(data))
    page.on('loaded', async () => {
      if (started) return
      started = true
      configure({ reducedMotion: 'never' })
      const properties = bars.map((bar) => portableReveal(bar.nativeViewProtected))
      try {
        await measureInspection(
          stage,
          properties,
          (text) => {
            status.text = text
          },
          () => alive,
        )
        await wait(700)
        const report = {
          kind: 'one-combined-node-sixteen-views',
          build: __PLAYBACK_EFFICIENCY_BUILD__,
          environment: environment(stage),
          recorded: false,
          complete: false,
          workload:
            'Two finite native timelines; one shared (a + b) * 0.65 graph bound to x on 16 native views. Three 1600 ms phases per repetition, no application subscriptions.',
          limitations:
            'Emulator diagnostics only. Choreographer opportunities are not presented frames; ART counters exclude V8/native/GPU allocations; RSS is not PSS. No physical-device or comparative performance conclusion.',
          runs: [] as object[],
        }
        const a = motionValue(0),
          b = motionValue(0),
          sum = a.add(b),
          combined = sum.mul(0.65)
        const unbind = views.map((view) => bind(view, { x: combined }))
        const read = () =>
          views.map((view) =>
            isIOS
              ? view.translateX
              : view.nativeViewProtected.getTranslationX() /
                view.nativeViewProtected.getResources().getDisplayMetrics().density,
          )
        try {
          for (let repetition = -1; repetition < 5; repetition++) {
            if (!alive || Application.suspended)
              throw new Error('Measurement interrupted')
            status.text = `Combined graph · 16 views · ${repetition < 0 ? 'warmup' : 'run ' + (repetition + 1) + '/5'}`
            set(a, 0)
            set(b, 0)
            await wait(250)
            const before = resources(stage),
              recorder = probe(views[0]!)
            const phases: object[] = []
            try {
              for (const [left, right] of [
                [140, -60],
                [-70, 30],
                [0, 0],
              ]) {
                const begin = performance.now()
                const first = animate(a, left!, { duration: 1600 }),
                  second = animate(b, right!, { duration: 1600 })
                const preparationMs = performance.now() - begin
                const done = await Promise.all([first.finished, second.finished])
                const values = read(),
                  expected = (left! + right!) * 0.65
                if (
                  !done.every(Boolean) ||
                  values.some((value) => Math.abs(value - expected) > 0.1)
                )
                  throw new Error(
                    'Combined graph did not reach every bound native target',
                  )
                phases.push({ left, right, expected, values, preparationMs })
              }
              report.runs.push({
                repetition,
                before,
                after: resources(stage),
                native: JSON.parse(recorder.finish()),
                phases,
              })
            } finally {
              recorder.cancel()
            }
            save('combined-measurements.json', report)
          }
          report.complete = true
          save('combined-measurements.json', report)
          status.text = 'Both measurements complete · no recording in timed windows'
        } finally {
          unbind.forEach((off) => off())
          combined.dispose()
          sum.dispose()
          a.dispose()
          b.dispose()
        }
      } catch (error) {
        status.text = String(error)
        save('acceptance-metrics-error.json', { error: String(error) })
      } finally {
        properties.forEach((property) => property.dispose())
        configure({ reducedMotion: 'user' })
      }
    })
    return page
  },
})
