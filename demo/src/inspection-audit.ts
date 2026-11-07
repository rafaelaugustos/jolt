import { Application, File, isIOS, knownFolders, type View } from '@nativescript/core'
import { createMotionInspector } from '@rafaelaugusto/jolt/inspector'
import { propertyGroup, type NativeProperty } from '@rafaelaugusto/jolt/native'
import { probe, environment, resources } from './portable-audit'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
/** Equivalent workload, alternating collection off/on. Native probe is identical in both. */
export async function measureInspection(
  stage: View,
  properties: NativeProperty<number>[],
  status: (message: string) => void,
  alive: () => boolean,
) {
  await wait(700)
  const report = {
    kind: 'adapter-inspector',
    environment: environment(stage),
    build: 'Production JavaScript; debug native package; no screen recorder',
    limitations:
      'Native callback intervals, process CPU and ART counters. No presented-frame, GPU, total allocation or PSS claims. Collector times cover JS preparation/writes only.',
    runs: [] as object[],
    complete: false,
  }
  const directory = isIOS
    ? knownFolders.documents().path
    : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
  const save = () =>
    File.fromPath(directory + '/inspection-measurements.json').writeTextSync(
      JSON.stringify(report),
    )
  const group = propertyGroup(
    Object.fromEntries(properties.map((property, i) => [`p${i}`, property])),
  )
  try {
    for (let repetition = -1; repetition < 5; repetition++) {
      for (const enabled of repetition % 2 ? [true, false] : [false, true]) {
        if (!alive() || Application.suspended)
          throw new Error('Measurement interrupted; discard incomplete runs.')
        status(
          `${enabled ? 'Inspector on' : 'Inspector off'} · ${repetition < 0 ? 'warmup' : `run ${repetition + 1}/5`}`,
        )
        const inspector = enabled
          ? createMotionInspector({ development: true, capacity: 240 })
          : undefined
        properties.forEach((property, i) =>
          inspector?.adapters.watch(property, `property${i}`),
        )
        await wait(150)
        const before = resources(stage),
          recorder = probe(stage)
        const setters: number[] = [],
          preparation: number[] = []
        try {
          // A deliberately redundant setter burst exposes bridge/update work in the report.
          for (let phase = 0; phase < 5; phase++) {
            const start = performance.now()
            for (let update = 0; update < 50; update++)
              properties.forEach((property) => property.set((update % 10) / 10))
            setters.push(performance.now() - start)
            const begin = performance.now()
            const animation = group.animate(
              Object.fromEntries(
                properties.map((_, i) => [`p${i}`, phase % 2 ? 0.2 : 0.9]),
              ),
              { duration: 180 },
            )
            preparation.push(performance.now() - begin)
            inspector?.label(animation, phase % 2 ? 'click' : 'pulse')
            await animation.finished
            await wait(40)
          }
          const native = JSON.parse(recorder.finish()),
            after = resources(stage),
            snapshot = inspector?.adapters.read()
          report.runs.push({
            repetition,
            enabled,
            before,
            after,
            setters,
            preparation,
            native,
            snapshot,
          })
        } finally {
          recorder.cancel()
          inspector?.dispose()
        }
        save()
      }
    }
    report.complete = true
    save()
    status('Inspector measurement complete · 10 measured runs + 2 warmups')
  } finally {
    group.dispose()
  }
}
