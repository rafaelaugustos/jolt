/// <reference types="@nativescript/types-ios/lib/ios/objc-x86_64/objc!SceneKit" />
import { Application, Color, Device, knownFolders } from '@nativescript/core'
import {
  animate,
  configure,
  motionScope,
  motionValue,
  playbackProgress,
  set,
  stop,
  timeline,
} from '@rafaelaugusto/jolt'
import {
  sceneKitPose,
  sceneKitLightIntensity,
  sceneKitLightColor,
  sceneKitMaterialTransparency,
  sceneKitMaterialDiffuse,
  sceneKitMaterialEmission,
} from '@rafaelaugusto/jolt/native'
import { getDriver } from '../dist/driver/index.js'
import { colorMixer, parseColor } from '../dist/color.js'
declare class JoltSceneProbe extends NSObject {
  static weakTargetReleased(): boolean
}
interface SceneTargets {
  camera: SCNNode
  keyLight: SCNLight
  paint: SCNMaterial
  charge: SCNMaterial
  glass: SCNMaterial
  sharedNodes: SCNNode[]
}
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
const near = (a: number, b: number, tolerance: number, message = 'Value mismatch') =>
  assert(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b} ± ${tolerance}`)
const rejects = (run: () => unknown) => {
  let failed = false
  try {
    run()
  } catch {
    failed = true
  }
  assert(failed, 'Invalid input accepted')
}
export async function checkSceneAppearance(
  target: SceneTargets,
  report: (message: string) => void,
  mode = 'all',
) {
  const baseline = JoltPropertyPlayer.activeCount(),
    sinks = JoltReferenceProperties.sceneAppearanceSinkCount()
  const driver = getDriver(),
    frame = driver.frame
  let observerFrames = 0
  driver.frame = (callback) => {
    observerFrames++
    return frame.call(driver, callback)
  }
  const results: {
    name: string
    passed: boolean
    detail?: string
    samples: unknown[]
  }[] = []
  let samples: unknown[] = [],
    scope = motionScope()
  const properties: { dispose(): void }[] = []
  const own = <T extends { dispose(): void }>(p: T): T => {
    properties.push(p)
    return p
  }
  const check = async (name: string, run: () => void | Promise<void>) => {
    report(name)
    samples = []
    scope = motionScope()
    try {
      await run()
      results.push({ name, passed: true, samples })
    } catch (error) {
      results.push({ name, passed: false, detail: String(error), samples })
    } finally {
      scope.dispose()
      for (const p of properties.splice(0)) p.dispose()
      configure({ reducedMotion: 'user', timeScale: 1 })
      await wait(30)
      if (
        JoltPropertyPlayer.activeCount() !== baseline ||
        JoltReferenceProperties.sceneAppearanceSinkCount() !== sinks
      )
        results.push({
          name: `${name}: cleanup`,
          passed: false,
          samples: [
            {
              active: JoltPropertyPlayer.activeCount(),
              sinks: JoltReferenceProperties.sceneAppearanceSinkCount(),
            },
          ],
        })
    }
  }
  try {
    if (mode === 'background') {
      await check(
        'Real background pauses owned work; explicit resume preserves continuity',
        async () => {
          const light = own(sceneKitLightIntensity(target.keyLight))
          light.set(400)
          const run = scope.add(light.animate(2000, { duration: 5000, ease: 'linear' }))
          let suspended = false,
            resumed = false,
            value = 0,
            writes = 0
          const suspend = () => {
            scope.suspend()
            suspended = true
            value = light.get()
            writes = JoltReferenceProperties.sceneAppearanceWriteCount()
          }
          const resume = () => {
            resumed = true
          }
          Application.on(Application.suspendEvent, suspend)
          Application.on(Application.resumeEvent, resume)
          try {
            report('Scene background ready')
            const deadline = Date.now() + 15000
            while (!resumed && Date.now() < deadline) await wait(100)
            assert(suspended && resumed, 'Missing native app lifecycle')
            near(light.get(), value, 0.01, 'Paused background changed value')
            assert(
              JoltReferenceProperties.sceneAppearanceWriteCount() === writes &&
                run.paused,
              'Background kept writing',
            )
            samples.push({
              paused: value,
              writesWhileSuspended:
                JoltReferenceProperties.sceneAppearanceWriteCount() - writes,
            })
            scope.resume()
            await wait(180)
            assert(
              light.get() > value && light.get() < value + 120,
              'Resume jumped/failed',
            )
          } finally {
            Application.off(Application.suspendEvent, suspend)
            Application.off(Application.resumeEvent, resume)
          }
        },
      )
    } else {
      await check(
        'Reject wrong targets, textures/images/numbers/nil/patterns without mutation',
        () => {
          rejects(() => sceneKitLightIntensity(target.paint as unknown as SCNLight))
          rejects(() =>
            sceneKitMaterialDiffuse(target.keyLight as unknown as SCNMaterial),
          )
          const material = SCNMaterial.material()
          for (const contents of [
            null,
            UIImage.new(),
            NSNumber.numberWithDouble(0.5),
            'texture.png',
            CALayer.new(),
          ]) {
            material.diffuse.contents = contents
            rejects(() => sceneKitMaterialDiffuse(material))
            assert(
              material.diffuse.contents === contents,
              'Unsupported contents replaced',
            )
          }
          material.diffuse.contents = UIColor.colorWithPatternImage(
            UIImage.systemImageNamed('star.fill')!,
          )
          rejects(() => sceneKitMaterialDiffuse(material))
        },
      )
      await check('Ranges, independent properties and native scalar set/get', () => {
        const light = own(sceneKitLightIntensity(target.keyLight)),
          alpha = own(sceneKitMaterialTransparency(target.glass))
        light.set(0)
        near(light.get(), 0, 0)
        light.set(1500)
        near(light.get(), 1500, 0)
        for (const value of [-1, NaN, Infinity]) rejects(() => light.set(value))
        for (const value of [-0.1, 1.1, NaN]) rejects(() => alpha.set(value))
        const roughness = target.glass.roughness.contents
        alpha.set(0.4)
        near(alpha.get(), 0.4, 0.0001)
        assert(
          target.glass.roughness.contents === roughness,
          'Unrelated property changed',
        )
        samples.push({ intensity: light.get(), transparency: alpha.get() })
      })
      await check(
        'UIColor/CGColor grayscale and Display P3 convert to sRGB, alpha and OKLab samples',
        () => {
          const m = SCNMaterial.material()
          m.diffuse.contents = UIColor.colorWithWhiteAlpha(0.5, 0.4).CGColor
          const diffuse = own(sceneKitMaterialDiffuse(m))
          const gray = new Color(parseColor(diffuse.get()))
          near(gray.r, 128, 1)
          near(gray.a, 102, 1)
          m.diffuse.contents = UIColor.colorWithDisplayP3RedGreenBlueAlpha(1, 0, 0, 0.5)
          const red = new Color(parseColor(diffuse.get()))
          near(red.r, 255, 1)
          near(red.a, 128, 1)
          for (const property of [
            diffuse,
            own(sceneKitLightColor(target.keyLight)),
            own(sceneKitMaterialEmission(target.charge)),
          ]) {
            property.set(new Color(0x80ff0000))
            const run = scope.add(
              property.animate('#0000ff', { duration: 1000, ease: 'linear' }),
            )
            run.pause()
            run.progress = 0.5
            const actual = parseColor(property.get()),
              expected = colorMixer(0x80ff0000, 0xff0000ff)(0.5)
            for (const shift of [0, 8, 16, 24])
              near(
                (actual >>> shift) & 255,
                (expected >>> shift) & 255,
                1,
                'Premultiplied OKLab midpoint',
              )
            property.set('transparent')
            assert(parseColor(property.get()) === 0, 'Transparent color failed')
            samples.push({ actual, expected })
          }
        },
      )
      await check(
        'Native tween, pause/seek/resume and current-value interruption without second easing',
        async () => {
          const property = own(sceneKitLightIntensity(target.keyLight))
          property.set(500)
          SCNTransaction.begin()
          SCNTransaction.animationDuration = 2
          let run
          try {
            run = scope.add(property.animate(1500, { duration: 1000, ease: 'linear' }))
          } finally {
            SCNTransaction.commit()
          }
          await wait(250)
          run.pause()
          const quarter = property.get()
          near(quarter, 500 + run.progress * 1000, 40, 'Native track drift/double easing')
          await wait(150)
          near(property.get(), quarter, 0.01, 'Pause drift')
          run.progress = 0.5
          near(property.get(), 1000, 0.01)
          run.play()
          await wait(120)
          assert(property.get() > 1050, 'Resume stalled')
          const before = property.get(),
            next = scope.add(property.animate(300, { duration: 500, ease: 'linear' }))
          near(property.get(), before, 2, 'Interruption jump')
          assert((await run.finished) === false, 'Old owner still running')
          next.pause()
          next.progress = 0.5
          near(property.get(), (before + 300) / 2, 2)
          samples.push({
            quarter,
            elapsedProgress: run.progress,
            before,
            interruptedMidpoint: property.get(),
            animationKeys: target.keyLight.animationKeys.count,
          })
          assert(
            target.keyLight.animationKeys.count === 0,
            'Unexpected implicit animation',
          )
        },
      )
      await check(
        'Shared material identity and stale wrapper disposal preserve newer work',
        async () => {
          const firstNode = target.sharedNodes[0]!,
            secondNode = target.sharedNodes[1]!
          assert(
            firstNode.geometry!.firstMaterial === secondNode.geometry!.firstMaterial,
            'Demo material is not shared',
          )
          const a = own(sceneKitMaterialEmission(firstNode.geometry!.firstMaterial!)),
            b = own(sceneKitMaterialEmission(secondNode.geometry!.firstMaterial!))
          a.set('black')
          const old = scope.add(a.animate('red', { duration: 1000 }))
          const next = scope.add(b.animate('blue', { duration: 1000 }))
          assert((await old.finished) === false, 'Shared owner not interrupted')
          a.dispose()
          next.pause()
          next.progress = 0.5
          assert(parseColor(b.get()) !== 0xff000000, 'Old disposal stopped new owner')
        },
      )
      await check(
        'Binding replacement validates maps before interrupting; texture replacement invalidates natively',
        async () => {
          const material = SCNMaterial.material()
          material.diffuse.contents = UIColor.redColor
          const property = own(sceneKitMaterialDiffuse(material)),
            value = motionValue(0)
          const run = scope.add(animate(value, 1, { duration: 1000, ease: 'linear' }))
          scope.use(() =>
            property.bind(value, (p) => new Color(255, Math.round(p * 255), 0, 100)),
          )
          rejects(() =>
            property.bind(value, (p) => (p > 0.4 && p < 0.6 ? 'invalid-color' : 'red')),
          )
          await wait(130)
          assert(
            JoltPropertyPlayer.activeCount() > baseline,
            'Invalid replacement stopped owner',
          )
          material.diffuse.contents = 'app-owned-texture.png'
          rejects(() => property.set('blue'))
          await wait(100)
          assert(
            JoltPropertyPlayer.activeCount() === baseline,
            'Invalid contents kept a native player',
          )
          assert(
            material.diffuse.contents === 'app-owned-texture.png',
            'Texture overwritten',
          )
          run.stop()
        },
      )
      await check(
        'Shared/derived values and observable playback control native appearance without JS frames',
        async () => {
          const light = own(sceneKitLightIntensity(target.keyLight)),
            opacity = own(sceneKitMaterialTransparency(target.glass)),
            value = motionValue(0)
          const run = scope.add(animate(value, 1, { duration: 1200, ease: 'linear' }))
          scope.use(() => light.bind(value.to([0, 1], [0, 2]), (n) => 500 + n * 500))
          scope.use(() => opacity.bind(playbackProgress(run), (p) => 1 - p * 0.6))
          await wait(200)
          run.pause()
          run.progress = 0.5
          near(light.get(), 1000, 1)
          near(opacity.get(), 0.7, 0.002)
          run.play()
          await wait(150)
          assert(light.get() > 1050 && opacity.get() < 0.68, 'Source controls not shared')
          samples.push({ intensity: light.get(), transparency: opacity.get() })
        },
      )
      await check('Scalar charge layer adds while the base keeps advancing', async () => {
        const value = motionValue(0),
          light = own(sceneKitLightIntensity(target.keyLight))
        scope.use(() => light.bind(value, (p) => 500 + Math.max(0, p) * 1000))
        const base = scope.add(animate(value, 1, { duration: 1600, ease: 'linear' }))
        await wait(200)
        scope.animate(value, [0, 0.4, 0], {
          duration: 600,
          ease: 'linear',
          layer: 'charge',
        })
        await wait(280)
        const peak = light.get(),
          baseAtPeak = base.progress
        assert(peak > 500 + baseAtPeak * 1000 + 180, 'Pulse replaced/did not add to base')
        await wait(400)
        stop(value, { layer: 'charge' })
        near(
          light.get(),
          500 + base.progress * 1000,
          50,
          'Base did not continue through pulse',
        )
        samples.push({ peak, baseAtPeak, after: light.get(), baseAfter: base.progress })
      })
      await check(
        'Timeline controls light and material together; disposal returns to baseline',
        async () => {
          const light = own(sceneKitLightIntensity(target.keyLight)),
            opacity = own(sceneKitMaterialTransparency(target.glass))
          light.set(500)
          opacity.set(1)
          const group = scope.add(
            timeline([
              {
                at: 0,
                run: () => light.animate(1500, { duration: 1000, ease: 'linear' }),
              },
              {
                at: 0,
                run: () => opacity.animate(0.2, { duration: 1000, ease: 'linear' }),
              },
            ]),
          )
          group.pause()
          const heldLight = light.get(),
            heldOpacity = opacity.get()
          await wait(100)
          near(light.get(), heldLight, 1)
          near(opacity.get(), heldOpacity, 0.002)
          group.play()
          await wait(100)
          assert(
            light.get() > heldLight && opacity.get() < heldOpacity,
            'Group did not resume',
          )
        },
      )
      await check(
        'Reduced motion retains appearance timing while spatial pose jumps',
        async () => {
          configure({ reducedMotion: 'always' })
          const light = own(sceneKitLightIntensity(target.keyLight)),
            pose = own(sceneKitPose(target.camera))
          light.set(500)
          const a = scope.add(light.animate(1500, { duration: 800, ease: 'linear' })),
            p = scope.add(
              pose.animate(
                {
                  position: [0, 3.3, 8.5],
                  orientation: [-Math.sin(0.16), 0, 0, Math.cos(0.16)],
                },
                { duration: 800 },
              ),
            )
          assert(
            a.duration === 800 && p.duration === 0,
            'Reduced-motion classification wrong',
          )
          await wait(150)
          assert(light.get() > 500 && light.get() < 1000, 'Appearance timing skipped')
        },
      )
      await check(
        'Weak target release and repeated scene ownership do not retain players/sinks',
        async () => {
          assert(JoltSceneProbe.weakTargetReleased(), 'Native sink retained its target')
          for (let i = 0; i < 20; i++) {
            const m = SCNMaterial.material()
            m.diffuse.contents = UIColor.redColor
            const owned = motionScope(),
              property = sceneKitMaterialDiffuse(m),
              value = motionValue(0)
            const run = owned.add(animate(value, 1, { duration: 500 }))
            owned.use(() => property.bind(value, () => 'blue'))
            owned.dispose()
            property.dispose()
            run.stop()
            assert(
              JoltReferenceProperties.sceneAppearanceSinkCount() === sinks,
              'Repeated disposal retained sinks',
            )
          }
        },
      )
      await check(
        'Busy JS shares the UI thread; native writes resume with elapsed time',
        async () => {
          const light = own(sceneKitLightIntensity(target.keyLight))
          light.set(500)
          const run = scope.add(light.animate(1500, { duration: 1200, ease: 'linear' }))
          await wait(100)
          const before = JoltReferenceProperties.sceneAppearanceWriteCount(),
            until = Date.now() + 400
          while (Date.now() < until) {
            /* deliberate UI-thread stall */
          }
          assert(
            JoltReferenceProperties.sceneAppearanceWriteCount() === before,
            'Unexpected background-thread writes',
          )
          await wait(80)
          near(
            light.get(),
            500 + run.progress * 1000,
            45,
            'Native clock drift after busy JS',
          )
          samples.push({
            blockedMilliseconds: 400,
            writesDuringBlock: 0,
            value: light.get(),
            progress: run.progress,
          })
        },
      )
    }
  } finally {
    scope.dispose()
    for (const p of properties.splice(0)) p.dispose()
    driver.frame = frame
    configure({ reducedMotion: 'user', timeScale: 1 })
  }
  const output = {
    passed:
      results.every((r) => r.passed) &&
      observerFrames === 0 &&
      JoltPropertyPlayer.activeCount() === baseline &&
      JoltReferenceProperties.sceneAppearanceSinkCount() === sinks,
    platform: Device.os,
    version: Device.osVersion,
    model: Device.model,
    mode,
    observerFrames,
    activeBefore: baseline,
    activeAfter: JoltPropertyPlayer.activeCount(),
    sinksBefore: sinks,
    sinksAfter: JoltReferenceProperties.sceneAppearanceSinkCount(),
    results,
  }
  await knownFolders
    .documents()
    .getFile('jolt-scene-appearance.json')
    .writeText(JSON.stringify(output, null, 2))
  report(output.passed ? 'Scene checks passed' : 'Scene checks FAILED')
}
