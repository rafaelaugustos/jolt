/// <reference types="@nativescript/types-ios/lib/ios/objc-x86_64/objc!SceneKit" />
import { Application, Device, knownFolders, type View } from '@nativescript/core'
import {
  animate,
  configure,
  motionScope,
  motionValue,
  playbackProgress,
  timeline,
} from '@rafaelaugusto/jolt'
import {
  sceneKitFieldOfView,
  sceneKitPose,
  sceneKitLightIntensity,
  sceneKitMaterialDiffuse,
} from '@rafaelaugusto/jolt/native'
import { getDriver } from '../dist/driver/index.js'
declare class JoltSceneProbe extends NSObject {
  static weakCameraReleased(): boolean
}
type Target = View & { camera: SCNNode; keyLight: SCNLight; paint: SCNMaterial }
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const near = (a: number, b: number, tolerance: number) =>
  assert(Math.abs(a - b) <= tolerance, `${a} vs ${b} ± ${tolerance}`)
const rejects = (run: () => unknown) => {
  let failed = false
  try {
    run()
  } catch {
    failed = true
  }
  assert(failed, 'Unsupported target/value accepted')
}
export async function checkSceneCamera(
  target: Target,
  report: (message: string) => void,
  mode = 'all',
) {
  const activeBefore = JoltPropertyPlayer.activeCount(),
    sinksBefore = JoltReferenceProperties.sceneCameraSinkCount()
  const appearanceBefore = JoltReferenceProperties.sceneAppearanceSinkCount()
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
    samples: unknown[]
    detail?: string
  }[] = []
  let samples: unknown[] = [],
    scope = motionScope()
  const properties: { dispose(): void }[] = []
  const own = <T extends { dispose(): void }>(p: T): T => {
    properties.push(p)
    return p
  }
  const check = async (name: string, run: () => void | Promise<void>) => {
    samples = []
    scope = motionScope()
    report(name)
    try {
      await run()
      results.push({ name, passed: true, samples })
    } catch (error) {
      results.push({ name, passed: false, samples, detail: String(error) })
    } finally {
      scope.dispose()
      for (const p of properties.splice(0)) p.dispose()
      configure({ reducedMotion: 'user', timeScale: 1 })
      await wait(30)
      if (
        JoltPropertyPlayer.activeCount() !== activeBefore ||
        JoltReferenceProperties.sceneCameraSinkCount() !== sinksBefore ||
        JoltReferenceProperties.sceneAppearanceSinkCount() !== appearanceBefore
      )
        results.push({
          name: `${name}: cleanup`,
          passed: false,
          samples: [
            {
              active: JoltPropertyPlayer.activeCount(),
              sinks: JoltReferenceProperties.sceneCameraSinkCount(),
              appearance: JoltReferenceProperties.sceneAppearanceSinkCount(),
            },
          ],
        })
    }
  }
  try {
    if (mode === 'background') {
      await check(
        'Real background suspension holds FOV; explicit resume continues',
        async () => {
          const fov = own(sceneKitFieldOfView(target.camera.camera!))
          fov.set(70)
          const run = scope.add(fov.animate(30, { duration: 5000, ease: 'linear' }))
          let suspended = false,
            resumed = false,
            held = 0,
            writes = 0
          const suspend = () => {
            scope.suspend()
            suspended = true
            held = fov.get()
            writes = JoltReferenceProperties.sceneCameraWriteCount()
          }
          const resume = () => {
            resumed = true
          }
          Application.on(Application.suspendEvent, suspend)
          Application.on(Application.resumeEvent, resume)
          try {
            report('Camera background ready')
            const deadline = Date.now() + 15000
            while (!resumed && Date.now() < deadline) await wait(100)
            assert(suspended && resumed, 'Missing app lifecycle')
            near(fov.get(), held, 0.001)
            assert(
              run.paused && JoltReferenceProperties.sceneCameraWriteCount() === writes,
              'Background wrote camera',
            )
            scope.resume()
            await wait(180)
            assert(fov.get() < held && fov.get() > held - 3, 'Resume jumped or stopped')
            samples.push({ held, resumed: fov.get(), writesWhileSuspended: 0 })
          } finally {
            Application.off(Application.suspendEvent, suspend)
            Application.off(Application.resumeEvent, resume)
          }
        },
      )
    } else {
      await check(
        'Native target, range and projection validation preserve existing ownership',
        () => {
          rejects(() => sceneKitFieldOfView(SCNNode.node() as unknown as SCNCamera))
          const camera = SCNCamera.camera(),
            fov = own(sceneKitFieldOfView(camera))
          scope.add(fov.animate(35, { duration: 1000 }))
          for (const value of [0, 0.5, 180, 200, NaN, Infinity]) {
            rejects(() => fov.set(value))
            rejects(() => fov.animate(value))
          }
          assert(
            JoltPropertyPlayer.activeCount() === activeBefore + 1,
            'Invalid values interrupted owner',
          )
          const sink = JoltReferenceProperties.sceneFieldOfView(camera)
          try {
            rejects(() => sink.write(NSArray.arrayWithArray([NaN])))
            rejects(() => sink.write(NSArray.arrayWithArray([180])))
            rejects(() => sink.write(NSArray.arrayWithArray([40, 50])))
          } finally {
            sink.dispose()
          }
          const unsupported = SCNCamera.camera()
          unsupported.usesOrthographicProjection = true
          rejects(() => sceneKitFieldOfView(unsupported))
          unsupported.usesOrthographicProjection = false
          unsupported.fieldOfView = 0.5
          rejects(() => sceneKitFieldOfView(unsupported))
          unsupported.fieldOfView = 60
          // Even a custom matrix numerically equal to the standard square projection is unsupported.
          const custom = unsupported.projectionTransformWithViewportSize(
            CGSizeMake(100, 100),
          )
          unsupported.projectionTransform = custom
          rejects(() => sceneKitFieldOfView(unsupported))
          assert(
            SCNMatrix4EqualToMatrix4(custom, unsupported.projectionTransform),
            'Factory changed app projection',
          )
          samples.push({
            customPreserved: true,
            sinksAfterRejection: JoltReferenceProperties.sceneCameraSinkCount(),
          })
        },
      )
      await check(
        'Degree-linear playback, seeking and reversal disable implicit SceneKit easing',
        async () => {
          const camera = target.camera.camera!,
            fov = own(sceneKitFieldOfView(camera))
          fov.set(70)
          SCNTransaction.begin()
          SCNTransaction.animationDuration = 2
          const run = scope.add(fov.animate(30, { duration: 1000, ease: 'linear' }))
          SCNTransaction.commit()
          await wait(250)
          near(fov.get(), 70 - 40 * run.progress, 2)
          run.pause()
          const held = fov.get()
          await wait(90)
          near(fov.get(), held, 0.001)
          run.progress = 0.5
          near(fov.get(), 50, 0.001)
          run.play()
          await wait(100)
          const before = fov.get(),
            reverse = scope.add(fov.animate(80, { duration: 1000, ease: 'linear' }))
          near(fov.get(), before, 0.2)
          assert((await run.finished) === false, 'Interrupted animation completed')
          reverse.pause()
          reverse.progress = 0.5
          near(fov.get(), (before + 80) / 2, 0.001)
          assert(camera.animationKeys.count === 0, 'Implicit animation keys remain')
          samples.push({
            held,
            reversalStart: before,
            reversalMid: fov.get(),
            animationKeys: camera.animationKeys.count,
          })
        },
      )
      await check(
        'Projected geometry follows FOV, direction and actual viewport resize',
        async () => {
          const camera = target.camera.camera!,
            fov = own(sceneKitFieldOfView(camera)),
            view = target.nativeViewProtected as SCNView
          const oldHeight = target.height
          const width = () => {
            const left = view.projectPoint(new SCNVector3({ x: -0.8, y: 0.6, z: 0 }))
            const right = view.projectPoint(new SCNVector3({ x: 0.8, y: 0.6, z: 0 }))
            return Math.abs(right.x - left.x)
          }
          try {
            camera.projectionDirection = SCNCameraProjectionDirection.Vertical
            fov.set(70)
            await wait(100)
            const wide = width()
            fov.set(35)
            await wait(100)
            const close = width()
            near(
              close / wide,
              Math.tan((35 * Math.PI) / 180) / Math.tan((17.5 * Math.PI) / 180),
              0.03,
            )
            const size = view.bounds.size
            const vertical = camera.projectionTransformWithViewportSize(size)
            near(vertical.m22, 1 / Math.tan((17.5 * Math.PI) / 180), 0.0001)
            camera.projectionDirection = SCNCameraProjectionDirection.Horizontal
            const horizontal = camera.projectionTransformWithViewportSize(size)
            near(horizontal.m11, vertical.m22, 0.0001)
            await wait(80)
            const beforeResize = width()
            target.height = 210
            target.requestLayout()
            await wait(140)
            assert(
              Math.abs(view.bounds.size.height - 210) < 1,
              'Native viewport did not resize',
            )
            near(width(), beforeResize, 1)
            near(fov.get(), 35, 0.0001)
            samples.push({
              wideProjectedWidth: wide,
              closeProjectedWidth: close,
              ratio: close / wide,
              horizontalProjectedWidth: beforeResize,
              afterResize: width(),
              viewportHeight: view.bounds.size.height,
            })
          } finally {
            target.height = oldHeight
            target.requestLayout()
            camera.projectionDirection = SCNCameraProjectionDirection.Vertical
          }
        },
      )
      await check(
        'Lens coupling and shared camera wrappers preserve property ownership',
        async () => {
          const camera = SCNCamera.camera(),
            a = own(sceneKitFieldOfView(camera)),
            b = own(sceneKitFieldOfView(camera))
          camera.sensorHeight = 36
          a.set(60)
          near(camera.focalLength, 36 / (2 * Math.tan(Math.PI / 6)), 0.0001)
          a.stop()
          camera.focalLength = 50
          const handoff = camera.fieldOfView
          const old = scope.add(a.animate(30, { duration: 1000 })),
            next = scope.add(b.animate(75, { duration: 1000, ease: 'linear' }))
          assert((await old.finished) === false, 'Shared owner not interrupted')
          a.dispose()
          await wait(100)
          assert(
            next.progress < 1 && b.get() > handoff,
            'Old disposal stopped replacement',
          )
          b.stop()
          camera.sensorHeight = 24
          near(b.get(), camera.fieldOfView, 0.0001)
          samples.push({
            lensAt60Degrees: 36 / (2 * Math.tan(Math.PI / 6)),
            handoff,
            changedSensorFov: b.get(),
          })
        },
      )
      await check(
        'Derived and playback bindings share light/paint timing without JS observers',
        async () => {
          const fov = own(sceneKitFieldOfView(target.camera.camera!)),
            paint = own(sceneKitMaterialDiffuse(target.paint))
          const source = motionValue(0),
            run = scope.add(animate(source, 1, { duration: 1000, ease: 'linear' }))
          scope.use(() => fov.bind(source.to([0, 1], [70, 30]), (n) => n))
          scope.use(() => paint.bind(source, (n) => (n < 0.5 ? '#2563eb' : '#f97316')))
          run.pause()
          run.progress = 0.5
          near(fov.get(), 50, 0.001)
          run.play() // A running source exposes its future samples; a paused source holds one value.
          rejects(() => fov.bind(source, (n) => (n < 0.8 ? 50 : 180)))
          run.pause()
          run.progress = 0.7
          near(fov.get(), 42, 0.001)
          const replacement = playbackProgress(run)
          scope.use(() => fov.bind(replacement, (p) => 80 - p * 40))
          run.progress = 0.25
          near(fov.get(), 70, 0.001)
          run.play()
          await wait(100)
          near(fov.get(), 80 - run.progress * 40, 2)
          samples.push({ fov: fov.get(), progress: run.progress })
        },
      )
      await check(
        'Timeline controls FOV and light while pose remains independent',
        async () => {
          const fov = own(sceneKitFieldOfView(target.camera.camera!)),
            light = own(sceneKitLightIntensity(target.keyLight)),
            pose = own(sceneKitPose(target.camera))
          const before = pose.get()
          fov.set(70)
          light.set(500)
          const group = scope.add(
            timeline([
              { at: 0, run: () => fov.animate(30, { duration: 1000, ease: 'linear' }) },
              {
                at: 0,
                run: () => light.animate(1500, { duration: 1000, ease: 'linear' }),
              },
            ]),
          )
          await wait(100)
          group.pause()
          const angle = fov.get(),
            brightness = light.get()
          await wait(100)
          near(fov.get(), angle, 0.001)
          near(light.get(), brightness, 0.001)
          group.play()
          await wait(100)
          assert(fov.get() < angle && light.get() > brightness, 'Timeline did not resume')
          pose.get().position.forEach((p, i) => near(p, before.position[i]!, 0.0001))
          samples.push({
            pausedFov: angle,
            resumedFov: fov.get(),
            pausedIntensity: brightness,
            resumedIntensity: light.get(),
          })
        },
      )
      await check(
        'Orthographic/custom projection changes stop native playback without overwriting app state',
        async () => {
          for (const kind of ['orthographic', 'custom'] as const) {
            const camera = SCNCamera.camera(),
              fov = own(sceneKitFieldOfView(camera))
            const run = scope.add(fov.animate(30, { duration: 1000 }))
            await wait(60)
            if (kind === 'orthographic') camera.usesOrthographicProjection = true
            else camera.projectionTransform = SCNMatrix4Scale(SCNMatrix4Identity, 2, 3, 1)
            const value = camera.fieldOfView,
              projection = camera.projectionTransform
            await wait(80)
            assert((await run.finished) === false, 'Unsupported projection kept playing')
            near(camera.fieldOfView, value, 0.001)
            assert(
              SCNMatrix4EqualToMatrix4(camera.projectionTransform, projection),
              'Native player replaced app projection',
            )
            rejects(() => fov.set(50))
            samples.push({ kind, heldAngle: value, projectionPreserved: true })
          }
        },
      )
      await check(
        'Spatial reduced motion, timeScale and bounded spring overshoot',
        async () => {
          const fov = own(sceneKitFieldOfView(target.camera.camera!))
          configure({ reducedMotion: 'always' })
          const instant = fov.animate(32, { duration: 1000 })
          assert(
            instant.duration === 0 && (await instant.finished),
            'Reduced motion did not settle',
          )
          near(fov.get(), 32, 0.001)
          configure({ reducedMotion: 'never', timeScale: 0.5 })
          const scaled = scope.add(fov.animate(50, { duration: 500 }))
          assert(scaled.duration === 1000, 'timeScale ignored')
          scaled.stop()
          configure({ timeScale: 1 })
          for (const destination of [1, 179]) {
            fov.set(destination === 1 ? 179 : 1)
            const run = scope.add(fov.animate(destination, 'bouncy'))
            run.pause()
            let min = 180,
              max = 0
            for (let i = 0; i <= 40; i++) {
              run.progress = i / 40
              const angle = fov.get()
              min = Math.min(min, angle)
              max = Math.max(max, angle)
              assert(angle >= 1 && angle <= 179, 'Spring left supported range')
            }
            samples.push({ destination, min, max })
            run.stop()
          }
          const source = motionValue(0),
            run = scope.add(animate(source, 1, { duration: 1000 }))
          scope.use(() => fov.bind(source, (n) => 70 - n * 40))
          configure({ reducedMotion: 'always' })
          scope.add(animate(source, 1, { duration: 1000 }))
          near(fov.get(), 30, 0.001)
        },
      )
      await check(
        'Repeated scope suspension/disposal and weak camera targets return to baseline',
        () => {
          assert(JoltSceneProbe.weakCameraReleased(), 'Native sink retained its camera')
          for (let i = 0; i < 20; i++) {
            const camera = SCNCamera.camera(),
              fov = sceneKitFieldOfView(camera),
              owned = motionScope(),
              value = motionValue(0)
            owned.add(animate(value, 1, { duration: 1000 }))
            owned.use(() => fov.bind(value, (n) => 70 - n * 40))
            owned.suspend()
            owned.resume()
            owned.dispose()
            fov.dispose()
            fov.dispose()
            assert(
              JoltReferenceProperties.sceneCameraSinkCount() === sinksBefore,
              'Leaked camera sink',
            )
          }
          samples.push({ lifetimes: 20, weakCameraReleased: true })
        },
      )
      await check(
        'Busy JS stalls the shared UI thread and native playback catches up',
        async () => {
          const fov = own(sceneKitFieldOfView(target.camera.camera!))
          fov.set(70)
          const run = scope.add(fov.animate(30, { duration: 1200, ease: 'linear' }))
          await wait(80)
          const writes = JoltReferenceProperties.sceneCameraWriteCount(),
            deadline = Date.now() + 300
          while (Date.now() < deadline) {
            /* intentional UI stall */
          }
          assert(
            JoltReferenceProperties.sceneCameraWriteCount() === writes,
            'Unexpected background writes',
          )
          await wait(80)
          near(fov.get(), 70 - run.progress * 40, 2)
          samples.push({
            blockedMilliseconds: 300,
            writesDuringBlock: 0,
            fov: fov.get(),
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
      !observerFrames &&
      JoltPropertyPlayer.activeCount() === activeBefore &&
      JoltReferenceProperties.sceneCameraSinkCount() === sinksBefore,
    platform: Device.os,
    version: Device.osVersion,
    model: Device.model,
    mode,
    observerFrames,
    activeBefore,
    activeAfter: JoltPropertyPlayer.activeCount(),
    sinksBefore,
    sinksAfter: JoltReferenceProperties.sceneCameraSinkCount(),
    results,
  }
  await knownFolders
    .documents()
    .getFile('jolt-scene-camera.json')
    .writeText(JSON.stringify(output, null, 2))
  report(output.passed ? 'Camera checks passed' : 'Camera checks FAILED')
}
