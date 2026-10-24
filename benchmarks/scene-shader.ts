/// <reference types="@nativescript/types-ios/lib/ios/objc-x86_64/objc!SceneKit" />
import { Application, Device, knownFolders } from '@nativescript/core'
import {
  animate,
  configure,
  motionScope,
  motionValue,
  playbackProgress,
  springValue,
} from '@rafaelaugusto/jolt'
import {
  sceneKitEnvironmentIntensity,
  sceneKitUniform,
  type NativeProperty,
} from '@rafaelaugusto/jolt/native'
import { getDriver } from '../dist/driver/index.js'
declare class JoltSceneProbe extends NSObject {
  static customProgramMaterial(): SCNMaterial
  static meanLuminance(view: NSObject): number
  static beginWeakShaderTargets(): boolean
  static finishWeakShaderTargets(): boolean
}
interface Target {
  scene: SCNScene
  glass: SCNMaterial
  charge: SCNMaterial
  nativeViewProtected: SCNView
}
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const near = (a: number, b: number, tolerance = 0.025) =>
  assert(Math.abs(a - b) <= tolerance, `${a} != ${b} ± ${tolerance}`)
const rejects = (run: () => unknown, label = 'invalid input') => {
  let failed = false
  try {
    const value = run() as { dispose?: () => void } | undefined
    value?.dispose?.()
  } catch {
    failed = true
  }
  assert(failed, 'Expected rejection: ' + label)
}
const scalar = {
  type: 'float',
  range: [0, 1],
  units: ['fraction'],
  motion: 'appearance',
} as const
export async function checkSceneShader(
  target: Target,
  report: (message: string) => void,
  mode = 'all',
) {
  const baseline = JoltPropertyPlayer.activeCount(),
    retained = JoltSceneShaderProperties.sinkCount()
  const driver = getDriver(),
    frame = driver.frame
  let observerFrames = 0,
    scope = motionScope()
  driver.frame = (callback) => {
    observerFrames++
    return frame.call(driver, callback)
  }
  const resources: { dispose(): void }[] = []
  const own = <T extends { dispose(): void }>(p: T) => {
    resources.push(p)
    return p
  }
  const results: {
    name: string
    passed: boolean
    detail?: string
    samples: unknown[]
  }[] = []
  let samples: unknown[] = []
  const environment = () => own(sceneKitEnvironmentIntensity(target.scene))
  const cabin = () => own(sceneKitUniform(target.glass, 'cabinView', scalar))
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
      resources.splice(0).forEach((r) => r.dispose())
      configure({ reducedMotion: 'user', timeScale: 1 })
      await wait(30)
      if (
        JoltPropertyPlayer.activeCount() !== baseline ||
        JoltSceneShaderProperties.sinkCount() !== retained
      )
        results.push({
          name: name + ' cleanup',
          passed: false,
          samples: [
            JoltPropertyPlayer.activeCount(),
            JoltSceneShaderProperties.sinkCount(),
          ],
        })
    }
  }
  try {
    if (mode === 'background') {
      await check(
        'background pauses native writes and explicit resume continues',
        async () => {
          const p = environment()
          p.set(1.6)
          const run = scope.add(p.animate(0.45, { duration: 5000, ease: 'linear' }))
          let paused = false,
            resumed = false,
            value = 0,
            writes = 0
          const suspend = () => {
            scope.suspend()
            paused = true
            value = p.get()
            writes = JoltSceneShaderProperties.writeCount()
          }
          const resume = () => {
            resumed = true
          }
          Application.on(Application.suspendEvent, suspend)
          Application.on(Application.resumeEvent, resume)
          try {
            report('Shader background ready')
            const limit = Date.now() + 25000
            while (!resumed && Date.now() < limit) await wait(50)
            assert(paused && resumed, 'Missing real suspend/resume')
            near(p.get(), value, 0.001)
            assert(
              writes === JoltSceneShaderProperties.writeCount(),
              'Paused native writes continued',
            )
            scope.resume()
            await wait(200)
            assert(p.get() < value, 'Resume did not progress')
            run.stop()
          } finally {
            Application.off(Application.suspendEvent, suspend)
            Application.off(Application.resumeEvent, resume)
          }
        },
      )
    } else {
      await check(
        'environment multipliers change rendered illumination and preserve images',
        async () => {
          const p = environment(),
            image = target.scene.lightingEnvironment.contents,
            background = target.scene.background.contents
          const levels = []
          for (const value of [0, 0.45, 1.6, 4]) {
            p.set(value)
            await wait(300)
            near(p.get(), value, 0.0001)
            levels.push({
              value,
              luminance: JoltSceneProbe.meanLuminance(target.nativeViewProtected),
            })
          }
          samples.push(...levels)
          assert(
            levels[2]!.luminance > levels[1]!.luminance + 0.005,
            'Multiplier above one did not brighten the rendered environment',
          )
          assert(
            levels[1]!.luminance > levels[0]!.luminance + 0.005,
            'Environment lighting had no visible contribution',
          )
          assert(
            target.scene.lightingEnvironment.contents === image &&
              target.scene.background.contents === background,
            'Adapter replaced scene images',
          )
          p.set(1.6)
        },
      )
      await check(
        'shared source advances native environment and scalar/vector uniforms without double easing',
        async () => {
          const env = environment(),
            u = cabin(),
            tint = own(
              sceneKitUniform(target.charge, 'signalTint', {
                ...scalar,
                type: 'float3',
                units: ['linear r', 'linear g', 'linear b'],
              }),
            )
          const source = motionValue(0)
          scope.use(() => env.bind(source, (p) => 1.6 - 1.15 * p))
          scope.use(() => u.bind(source, (p) => p))
          scope.use(() => tint.bind(source, (p) => [p, 1 - p, 0.2 + 0.6 * p]))
          const writes = JoltSceneShaderProperties.writeCount()
          const run = scope.add(animate(source, 1, { duration: 1000, ease: 'linear' }))
          await wait(180)
          assert(u.get() > 0 && u.get() < 1, 'Missing native intermediate value')
          assert(
            JoltSceneShaderProperties.writeCount() > writes + 3,
            'No native frame writes',
          )
          run.pause()
          run.progress = 0.5
          await wait(50)
          near(env.get(), 1.025)
          near(u.get(), 0.5)
          const v = tint.get()
          v.forEach((n, i) => near(n, [0.5, 0.5, 0.5][i]!))
          samples.push({ environment: env.get(), cabin: u.get(), tint: v })
          const held = env.get()
          await wait(100)
          near(env.get(), held, 0.0001)
          run.play()
          await wait(180)
          assert(env.get() < held, 'Resume did not move')
          run.stop()
        },
      )
      await check('invalid schemas and values do not replace a valid owner', () => {
        const env = environment(),
          u = cabin()
        scope.add(u.animate(1, { duration: 1000 }))
        const active = JoltPropertyPlayer.activeCount()
        rejects(() => sceneKitEnvironmentIntensity(target.glass as never))
        for (const name of ['missing', 'u_reserved', 'diffuse.contents', 'diffuse'])
          rejects(() => sceneKitUniform(target.glass, name, scalar))
        rejects(() =>
          sceneKitUniform(target.glass, 'cabinView', {
            ...scalar,
            type: 'float3',
            units: ['x', 'y', 'z'],
          }),
        )
        for (const value of [-1, Infinity, NaN]) rejects(() => env.set(value))
        rejects(() => u.animate(2))
        assert(
          JoltPropertyPlayer.activeCount() === active,
          'Invalid command interrupted valid owner',
        )
      })
      await check(
        'independent uniforms and older disposal preserve the replacement owner',
        async () => {
          const material = SCNMaterial.material()
          material.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
            '#pragma arguments\nfloat first;\nfloat second;\n#pragma body\n_output.color.r = first + second;\n',
            SCNShaderModifierEntryPointFragment,
          )
          material.setValueForKey(0, 'first')
          material.setValueForKey(0, 'second')
          const a = own(sceneKitUniform(material, 'first', scalar)),
            b = own(sceneKitUniform(material, 'first', scalar)),
            other = own(sceneKitUniform(material, 'second', scalar))
          const old = scope.add(a.animate(1, { duration: 1000 }))
          scope.add(other.animate(1, { duration: 1000 }))
          await wait(120)
          const current = a.get()
          const next = scope.add(b.animate(0, { duration: 700 }))
          near(b.get(), current, 0.03)
          assert((await old.finished) === false, 'Old owner was not interrupted')
          a.dispose()
          await wait(150)
          assert(
            other.get() > 0 && JoltPropertyPlayer.activeCount() >= baseline + 2,
            'Older disposal stopped newer work',
          )
        },
      )
      await check('float2 and float4 geometry inputs round-trip coherently', () => {
        const geometry = SCNPlane.planeWithWidthHeight(1, 1)
        geometry.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
          '#pragma arguments\nfloat2 offset;\nfloat4 tint;\n#pragma body\n_geometry.position.xy += offset;\n',
          SCNShaderModifierEntryPointGeometry,
        )
        geometry.setValueForKey(NSValue.valueWithCGPoint(CGPointMake(0.1, 0.2)), 'offset')
        geometry.setValueForKey(
          NSValue.valueWithSCNVector4(new SCNVector4({ x: 0, y: 0.1, z: 0.2, w: 0.3 })),
          'tint',
        )
        const offset = own(
          sceneKitUniform(geometry, 'offset', {
            ...scalar,
            type: 'float2',
            units: ['x', 'y'],
          }),
        )
        const tint = own(
          sceneKitUniform(geometry, 'tint', {
            ...scalar,
            type: 'float4',
            range: [0, 0.3],
            units: ['r', 'g', 'b', 'a'],
          }),
        )
        offset.set([0.7, 0.9])
        tint.set([0.3, 0.2, 0.1, 0])
        offset.get().forEach((n, i) => near(n, [0.7, 0.9][i]!, 0.00001))
        tint.get().forEach((n, i) => near(n, [0.3, 0.2, 0.1, 0][i]!, 0.00001))
      })
      await check(
        'shader replacement invalidates playback and requires a fresh adapter',
        async () => {
          const previous = target.glass.shaderModifiers,
            u = cabin()
          u.set(0)
          const run = scope.add(u.animate(1, { duration: 1000 }))
          await wait(80)
          target.glass.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
            previous!.objectForKey(SCNShaderModifierEntryPointFragment) +
              '\n// replacement',
            SCNShaderModifierEntryPointFragment,
          )
          await wait(80)
          assert((await run.finished) === false, 'Replaced shader kept playing')
          rejects(() => u.get())
          const fresh = cabin()
          fresh.set(0.25)
          near(fresh.get(), 0.25)
          target.glass.shaderModifiers = previous
        },
      )
      await check(
        'missing initialization, invalid values, conditional schemas and custom programs',
        () => {
          const m = SCNMaterial.material()
          const source =
            '#pragma arguments\nfloat amount;\n#pragma body\n_output.color.r=amount;'
          m.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
            source,
            SCNShaderModifierEntryPointFragment,
          )
          rejects(() => sceneKitUniform(m, 'amount', scalar), 'missing initialization')
          m.setValueForKey(2, 'amount')
          rejects(() => sceneKitUniform(m, 'amount', scalar), 'out of range')
          m.setValueForKey(0, 'amount')
          m.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
            '#if 0\n' + source + '\n#endif',
            SCNShaderModifierEntryPointFragment,
          )
          rejects(() => sceneKitUniform(m, 'amount', scalar), 'conditional schema')
          m.shaderModifiers = NSDictionary.dictionaryWithObjectForKey(
            source,
            SCNShaderModifierEntryPointFragment,
          )
          // A separate target avoids SceneKit's shaderModifiers/program interaction.
          const custom = JoltSceneProbe.customProgramMaterial()
          assert(
            custom.program !== null,
            'Custom program did not reach the native material',
          )
          rejects(() => sceneKitUniform(custom, 'amount', scalar), 'custom program')
        },
      )
      await check(
        'environment image replacement and removal preserve intensity ownership',
        () => {
          const env = environment(),
            image = target.scene.lightingEnvironment.contents
          try {
            target.scene.lightingEnvironment.contents = null
            env.set(0.45)
            near(env.get(), 0.45)
            assert(
              target.scene.lightingEnvironment.contents === null,
              'Removed image was restored',
            )
            target.scene.lightingEnvironment.contents = image
            env.set(1.6)
            near(env.get(), 1.6)
          } finally {
            target.scene.lightingEnvironment.contents = image
          }
        },
      )
      await check(
        'derived and playback-progress sources work; retained live sources reject without fallback',
        () => {
          const u = cabin(),
            source = motionValue(0),
            run = scope.add(animate(source, 1, { duration: 1000, ease: 'linear' }))
          scope.use(() => u.bind(source.to([0, 1], [0.2, 0.8]), (v) => v))
          run.pause()
          run.progress = 0.5
          near(u.get(), 0.5)
          scope.use(() => u.bind(playbackProgress(run), (v) => v))
          run.progress = 0.7
          near(u.get(), 0.7)
          const live = own(springValue(source))
          const active = JoltPropertyPlayer.activeCount()
          rejects(() => u.bind(live, (v) => v))
          assert(
            JoltPropertyPlayer.activeCount() === active,
            'Live-source rejection changed ownership',
          )
        },
      )
      await check('compiled sinks do not retain scene or material targets', async () => {
        const initialized = JoltSceneProbe.beginWeakShaderTargets()
        await wait(100)
        const released = JoltSceneProbe.finishWeakShaderTargets()
        assert(initialized, 'Weak target probe setup failed')
        assert(released, 'A native sink retained its target')
      })
      await check('explicit Reduced Motion policy and time scale', () => {
        configure({ reducedMotion: 'always' })
        const u = cabin(),
          spatial = own(
            sceneKitUniform(target.glass, 'cabinView', { ...scalar, motion: 'spatial' }),
          )
        const instant = spatial.animate(0.8, { duration: 1000 })
        assert(instant.duration === 0, 'Spatial uniform did not settle immediately')
        near(spatial.get(), 0.8)
        const run = scope.add(u.animate(0.2, { duration: 1000 }))
        assert(run.duration === 1000, 'Appearance timing was removed')
        configure({ reducedMotion: 'never', timeScale: 2 })
        const faster = scope.add(u.animate(0.6, { duration: 1000 }))
        assert(faster.duration === 500, 'Time scale was ignored')
      })
    }
  } finally {
    driver.frame = frame
    scope.dispose()
    resources.splice(0).forEach((p) => p.dispose())
    configure({ reducedMotion: 'user', timeScale: 1 })
  }
  const result = {
    schema: 1,
    mode,
    platform: 'ios',
    os: Device.osVersion,
    runId: String(Date.now()),
    passed: results.every((r) => r.passed) && observerFrames === 0,
    observerFrames,
    results,
  }
  await knownFolders
    .documents()
    .getFile('jolt-scene-shader.json')
    .writeText(JSON.stringify(result, null, 2))
  report(result.passed ? 'Shader checks passed' : 'Shader checks failed')
  console.log('JOLT_SCENE_SHADER', JSON.stringify(result))
  return result
}
