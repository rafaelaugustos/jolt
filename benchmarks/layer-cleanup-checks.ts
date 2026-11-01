import {
  Application,
  Device,
  File,
  isIOS,
  knownFolders,
  type View,
} from '@nativescript/core'
import { animate, configure, set, stop } from '@rafaelaugusto/jolt'
import { getDriver } from '../dist/driver/index.js'
import { currentValue, inspectViewMotion } from '../dist/engine.js'
import { waitForPresentation } from './native-presentation'

export async function runLayerCleanupChecks(
  view: View,
  update = (_message: string) => {},
  negative = false,
) {
  const driver = getDriver(),
    originalCommit = driver.commit
  const samples: object[] = []
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  const read = (property: 'scaleX' | 'scaleY') => {
    if (!isIOS)
      return Number(
        property === 'scaleX' ? view.android.getScaleX() : view.android.getScaleY(),
      )
    const layer = (view.ios as UIView).layer.presentationLayer()
    if (!layer) throw new Error('Missing native presentation layer')
    return Number(
      layer.valueForKeyPath(
        property === 'scaleX' ? 'transform.scale.x' : 'transform.scale.y',
      ),
    )
  }
  const check = async (name: string, expectedX: number, expectedY: number) => {
    await waitForPresentation(driver.frame)
    const actual = { x: read('scaleX'), y: read('scaleY') }
    const model = { x: view.scaleX, y: view.scaleY }
    samples.push({ name, actual, model, expected: { x: expectedX, y: expectedY } })
    update(
      `${name}\nModel ${model.x.toFixed(3)} / ${model.y.toFixed(3)}\nNative ${actual.x.toFixed(3)} / ${actual.y.toFixed(3)}`,
    )
    for (const [value, expected] of [
      [actual.x, expectedX],
      [actual.y, expectedY],
      [model.x, expectedX],
      [model.y, expectedY],
    ])
      if (Math.abs(value! - expected!) > 0.005)
        throw new Error(`${name}: ${value} != ${expected}`)
    await wait(180)
  }
  const reset = () => {
    stop(view)
    configure({ reducedMotion: 'never' })
    set(view, { scaleX: 1.2, scaleY: 0.6, x: 0, rotate: 0 })
  }
  try {
    // Negative control reproduces the pre-fix settled-channel path on Android.
    if (negative) driver.commit = undefined
    reset()
    await animate(view, { scale: 0.75 }, { layer: 'feedback', duration: 180 })
    update('Release running — remove only feedback')
    const release = animate(
      view,
      { scale: 1 },
      { layer: 'feedback', duration: 900, ease: 'linear' },
    )
    await wait(160)
    stop(view, ['scale'], { layer: 'feedback' })
    if (await release.finished) throw new Error('Removed layer reported completion')
    await check('Interrupted release', 1.2, 0.6)
    await wait(200)
    await check('No stale write', 1.2, 0.6)

    reset()
    await animate(view, { scale: 0.9 }, { layer: 'held', duration: 0 })
    await animate(view, { scale: 0.8 }, { layer: 'feedback', duration: 0 })
    const base = animate(
      view,
      { scaleX: 1.4, scaleY: 0.8 },
      { duration: 1200, ease: 'linear' },
    )
    animate(view, { scale: 1 }, { layer: 'feedback', duration: 900 })
    await wait(160)
    stop(view, ['scale'], { layer: 'feedback' })
    await waitForPresentation(driver.frame)
    const moving = { actual: read('scaleX'), expected: currentValue(view, 'scaleX') }
    samples.push({ name: 'Moving base plus held layer', ...moving })
    if (Math.abs(moving.actual - moving.expected) > 0.04)
      throw new Error('Moving base presentation drift')
    if (!(await base.finished)) throw new Error('Base was cancelled with feedback')
    await check('Base and held layer survive', 1.26, 0.72)
    stop(view, ['scale'], { layer: 'held' })
    await check('Held layer removed', 1.4, 0.8)

    for (const during of [false, true]) {
      reset()
      if (!during) configure({ reducedMotion: 'always' })
      await animate(view, { scale: 0.8 }, { layer: 'feedback', duration: 180 })
      const release = animate(view, { scale: 1 }, { layer: 'feedback', duration: 900 })
      if (during) {
        await wait(160)
        configure({ reducedMotion: 'always' })
      }
      stop(view, ['scale'], { layer: 'feedback' })
      await release.finished
      await check(
        during ? 'Reduction enabled during release' : 'Reduced motion',
        1.2,
        0.6,
      )
    }
    if (inspectViewMotion(view).length) throw new Error('Retained animation tracks')
    update('Passed layer cleanup checks')
    return {
      platform: Device.os,
      version: Device.osVersion,
      samples,
      negative,
      status: 'passed',
    }
  } finally {
    driver.commit = originalCommit
    stop(view)
    configure({ reducedMotion: 'user' })
  }
}

export function layerCleanupDemo(
  view: View,
  update: (message: string) => void,
  negative: boolean,
) {
  let running = false
  return {
    async run() {
      if (running) return
      running = true
      const directory = isIOS
        ? knownFolders.documents().path
        : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
      try {
        const report = await runLayerCleanupChecks(view, update, negative)
        File.fromPath(directory + '/jolt-layer-cleanup.json').writeTextSync(
          JSON.stringify(report),
        )
      } catch (error) {
        update(`Failed layer cleanup: ${String(error)}`)
        File.fromPath(directory + '/jolt-layer-cleanup.json').writeTextSync(
          JSON.stringify({
            status: 'failed',
            error: String(error),
            negative,
            platform: Device.os,
          }),
        )
      }
    },
  }
}
