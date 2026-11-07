import { createWebRuntime } from '../../src/web/public.js'
import { createMotionInspector } from '../../src/web/inspector.js'
import { portableScene } from '../web-portable/scene.js'
/** Actual WebGL sinks. Recording is disabled; identical RAF probe in both variants. */
export async function measureInspection() {
  const runtime = createWebRuntime(document),
    scope = runtime.scope()
  const canvas = document.createElement('canvas')
  canvas.width = 760
  canvas.height = 230
  document.body.append(canvas)
  const scene = portableScene(canvas, scope)
  if (!scene) throw new Error('WebGL is required for this measured example.')
  const properties = scene.properties,
    group = scope.propertyGroup({
      a: properties[0]!,
      b: properties[1]!,
      c: properties[2]!,
    })
  const activity = scope.renderActivity({ change: scene.render, redraw: scene.draw })
  const report = {
    browser: navigator.userAgent,
    clock: 'performance.now',
    renderer:
      'Software WebGL in automated Chromium; do not infer hardware GPU performance',
    limitations:
      'JS wall time and RAF callback intervals only. No process CPU, PSS, native sampling or allocation measurements.',
    runs: [] as object[],
    complete: false,
  }
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  try {
    for (let repetition = -1; repetition < 5; repetition++) {
      for (const enabled of repetition % 2 ? [true, false] : [false, true]) {
        const inspector = enabled
          ? createMotionInspector(document, runtime, { development: true, capacity: 240 })
          : undefined
        properties.forEach((property, i) =>
          inspector?.adapters.watch(property, `material${i}`),
        )
        const callbacks: number[] = [],
          setters: number[] = [],
          preparation: number[] = []
        let frame = 0,
          running = true
        const sample = () => {
          callbacks.push(performance.now())
          if (running) frame = requestAnimationFrame(sample)
        }
        frame = requestAnimationFrame(sample)
        try {
          for (let phase = 0; phase < 5; phase++) {
            const start = performance.now()
            for (let update = 0; update < 50; update++)
              properties.forEach((property) => property.set((update % 10) / 10))
            setters.push(performance.now() - start)
            const before = performance.now(),
              value = phase % 2 ? 0.2 : 0.9
            const playback = group.animate(
              { a: value, b: value, c: value },
              { duration: 180 },
            )
            preparation.push(performance.now() - before)
            activity.track(playback)
            await playback.finished
            await wait(40)
          }
          report.runs.push({
            repetition,
            enabled,
            setters,
            preparation,
            callbacks,
            snapshot: inspector?.read().adapters,
          })
        } finally {
          running = false
          cancelAnimationFrame(frame)
          inspector?.dispose()
        }
      }
    }
    report.complete = true
    return report
  } finally {
    scope.dispose()
    runtime.dispose()
    canvas.remove()
  }
}
