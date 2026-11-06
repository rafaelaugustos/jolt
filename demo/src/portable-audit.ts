import {
  Application,
  File,
  GridLayout,
  isIOS,
  knownFolders,
  type View,
} from '@nativescript/core'
import { animate, renderActivity } from '@rafaelaugusto/jolt'
import { drawBatch, shape, type DrawingItem } from '@rafaelaugusto/jolt/shapes'
import { propertyGroup, type NativeProperty } from '@rafaelaugusto/jolt/native'
import { portableDots, portableStyles } from './portable-recipe'

interface Probe {
  finish(): string
  cancel(): void
}
declare const JoltBudgetProbe: {
  start(view: UIView): Probe
  environment(): string
  resources(): string
}
const androidProbe = () =>
  (
    org.rafaelaugusto.jolt as unknown as {
      fixture: {
        BudgetProbe: {
          new (view: android.view.View): Probe
          environment(view: android.view.View): string
          resources(view: android.view.View): string
        }
      }
    }
  ).fixture.BudgetProbe

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const native = (view: View) => view.nativeViewProtected
const probe = (view: View) =>
  isIOS ? JoltBudgetProbe.start(native(view)) : new (androidProbe())(native(view))
const environment = (view: View) =>
  JSON.parse(
    isIOS ? JoltBudgetProbe.environment() : androidProbe().environment(native(view)),
  )
const resources = (view: View) =>
  JSON.parse(isIOS ? JoltBudgetProbe.resources() : androidProbe().resources(native(view)))
function counts(view: View) {
  if (!isIOS) {
    const visit = (view: android.view.View): number => {
      let count = 1
      if (view instanceof android.view.ViewGroup)
        for (let i = 0; i < view.getChildCount(); i++) count += visit(view.getChildAt(i))
      return count
    }
    return {
      views: visit(native(view)),
      shapes: org.rafaelaugusto.jolt.ShapeLayer.liveCount(),
      batches: org.rafaelaugusto.jolt.BatchDrawing.liveCount(),
      players: org.rafaelaugusto.jolt.PropertyPlayer.activeCount(),
    }
  }
  const visit = (layer: CALayer): number => {
    let count = 1
    for (let i = 0; i < (layer.sublayers?.count ?? 0); i++)
      count += visit(layer.sublayers!.objectAtIndex(i))
    return count
  }
  return {
    layers: visit((native(view) as UIView).layer),
    batches: JoltBatchDrawing.liveCount(),
    players: JoltPropertyPlayer.activeCount(),
  }
}
function save(value: object) {
  const directory = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
  File.fromPath(directory + '/portable-measurements.json').writeTextSync(
    JSON.stringify(value),
  )
}
function circlePath(item: DrawingItem) {
  if (item.kind !== 'circle') throw new Error('Expected chart circle.')
  const { cx: x, cy: y, radius: r } = item
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`
}
/** Real native workloads. Never run a screen recorder in these timed windows. */
export async function measurePortable(
  stage: GridLayout,
  kind: 'groups' | 'drawing' | 'activity',
  properties: NativeProperty<number>[],
  status: (message: string) => void,
  alive: () => boolean = () => true,
  propertyViews: View[] = [],
) {
  await wait(500) // NativeScript loaded precedes Android window attachment.
  if (!isIOS && !native(stage).getDisplay())
    throw new Error('Measurement requires an attached native display.')
  const result = {
    kind,
    buildMode: 'NativeScript demo with production JavaScript; Android debug APK',
    environment: environment(stage),
    recorded: false,
    metric:
      'Native callback opportunities; not presented-frame timestamps. RSS and ART counters, not PSS or total allocations.',
    runs: [] as object[],
    complete: false,
  }
  const group = properties.length
    ? propertyGroup({ a: properties[0]!, b: properties[1]!, c: properties[2]! })
    : undefined
  await wait(500)
  for (const density of kind === 'drawing' ? [259, 512, 1024] : [3]) {
    for (let repetition = -1; repetition < 5; repetition++) {
      const variants =
        repetition % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']
      for (const variant of variants) {
        if (!alive() || Application.suspended)
          throw new Error('Measurement interrupted; discard incomplete runs.')
        status(
          `${kind} · ${density} · ${variant} · ${repetition < 0 ? 'warm-up' : `run ${repetition + 1}/5`}`,
        )
        await wait(150)
        const before = resources(stage),
          countBefore = counts(stage),
          recorder = probe(stage)
        const begin = performance.now()
        let cleanup = () => {},
          update = (_phase: number) => {},
          setupMs = 0
        let renderMetrics: object | undefined
        const updateMs: number[] = [],
          sinks: { firstChangeMs: number; writes: number; draws: number }[] = []
        try {
          if (kind === 'drawing') {
            let items = portableDots(density)
            if (variant === 'candidate') {
              const drawing = drawBatch(stage, {
                viewBox: [0, 0, 760, 300],
                items,
                styles: portableStyles,
              })
              cleanup = () => drawing.dispose()
              update = (phase) =>
                drawing.update(
                  items.slice(0, 37).map((item) => ({
                    ...item,
                    kind: 'circle',
                    cx: item.kind === 'circle' ? item.cx : 0,
                    cy: 15 + phase * 5,
                    radius: 4,
                  })),
                )
            } else {
              const hosts: GridLayout[] = [],
                drawings: ReturnType<typeof shape>[] = []
              cleanup = () => {
                drawings.forEach((drawing) => drawing.dispose())
                hosts.forEach((host) => stage.removeChild(host))
              }
              for (let index = 0; index < items.length; index += 32) {
                const host = new GridLayout()
                stage.addChild(host)
                hosts.push(host)
                drawings.push(
                  shape(host, {
                    viewBox: [0, 0, 760, 300],
                    d: items
                      .slice(index, index + 32)
                      .map(circlePath)
                      .join(''),
                    fill: '#63e3c2',
                    strokeWidth: 0,
                  }),
                )
              }
              update = (phase) => {
                items = items.map((item, i) =>
                  i < 37 && item.kind === 'circle'
                    ? { ...item, cy: 15 + phase * 5 }
                    : item,
                )
                for (let index = 0; index < 37; index += 32)
                  drawings[index / 32]!.set({
                    d: items
                      .slice(index, index + 32)
                      .map(circlePath)
                      .join(''),
                  })
              }
            }
            setupMs = performance.now() - begin
            const animation = animate(
              stage,
              { x: [0, 8, 0] },
              { duration: 1200, ease: 'linear' },
            )
            for (let phase = 0; phase < 5; phase++) {
              await wait(160)
              const at = performance.now()
              update(phase)
              updateMs.push(performance.now() - at)
            }
            await animation.finished
          } else {
            const to = { a: 0.8, b: 0.4, c: 1 }
            if (kind === 'activity' && isIOS)
              throw new Error(
                'This timing fixture measures the Android Canvas renderer, not SceneKit.',
              )
            const RenderProbe = !isIOS
              ? (
                  org.rafaelaugusto.jolt as unknown as {
                    fixture: {
                      RenderingProbe: {
                        new (target: android.view.View): {
                          setActive(active: boolean): void
                          redraw(): void
                          finish(): string
                        }
                      }
                    }
                  }
                ).fixture.RenderingProbe
              : undefined
            const renderer =
              kind === 'activity' && RenderProbe
                ? new RenderProbe(native(stage))
                : undefined
            const activity =
              renderer &&
              renderActivity({
                change: (active) => renderer.setActive(active),
                redraw: () => renderer.redraw(),
              })
            let timer: ReturnType<typeof setTimeout> | undefined
            cleanup = () => {
              if (timer) clearTimeout(timer)
              activity?.dispose()
              if (renderer) renderMetrics = JSON.parse(renderer.finish())
            }
            const duration = kind === 'activity' ? 900 : 1200
            group!.set({ a: 0.1, b: 0.1, c: 0.1 })
            if (!isIOS) propertyViews.forEach((view) => native(view).startProbe())
            const animations =
              variant === 'candidate' || kind === 'activity'
                ? [group!.animate(to, { duration, ease: 'linear' })]
                : properties.map((property, i) =>
                    property.animate([to.a, to.b, to.c][i]!, {
                      duration,
                      ease: 'linear',
                    }),
                  )
            if (renderer) {
              if (variant === 'candidate') activity!.track(animations[0]!)
              else {
                renderer.setActive(true)
                timer = setTimeout(() => renderer.setActive(false), 1300)
              }
            }
            setupMs = performance.now() - begin
            await Promise.all(animations.map((animation) => animation.finished))
            if (kind === 'activity') await wait(800)
            if (!isIOS)
              propertyViews.forEach((view) =>
                sinks.push(JSON.parse(native(view).finishProbe())),
              )
          }
          const during = counts(stage),
            recording = JSON.parse(recorder.finish())
          cleanup()
          await wait(80)
          result.runs.push({
            density,
            repetition,
            warmup: repetition < 0,
            variant,
            setupMs,
            updateMs,
            renderMetrics,
            sinks,
            nativeFirstWriteSkewMs:
              sinks.length && sinks.every((sink) => sink.firstChangeMs > 0)
                ? Math.max(...sinks.map((sink) => sink.firstChangeMs)) -
                  Math.min(...sinks.map((sink) => sink.firstChangeMs))
                : null,
            before,
            recording,
            counts: { before: countBefore, during, after: counts(stage) },
            after: resources(stage),
          })
          save(result)
        } catch (error) {
          recorder.cancel()
          cleanup()
          group?.dispose()
          save({ ...result, error: String(error) })
          throw error
        }
      }
    }
  }
  group?.dispose()
  result.complete = true
  save(result)
  status('Measurements complete · recording was disabled')
}
