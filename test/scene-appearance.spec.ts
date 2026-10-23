import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { Color } from '@nativescript/core'
import {
  animate,
  motionValue,
  playbackProgress,
  configure,
  motionScope,
  timeline,
} from '../src/index.js'
import {
  sceneKitLightIntensity,
  sceneKitLightColor,
  sceneKitMaterialTransparency,
  sceneKitMaterialDiffuse,
  sceneKitMaterialEmission,
} from '../src/native/index.js'
import { colorMixer, parseColor } from '../src/color.js'
import {
  setNativePropertyDriver,
  type NativePropertyDriver,
} from '../src/native-property-driver.js'
import { driver } from './helpers.js'

type Target = {
  type: 'light' | 'material'
  values: Record<string, number[]>
  invalid?: boolean
}
type Sink = { target: Target; key: string; disposed: boolean }
const light = (): Target => ({
  type: 'light',
  values: { intensity: [1000], color: [1, 0, 0, 1] },
})
const material = (): Target => ({
  type: 'material',
  values: { transparency: [1], diffuse: [1, 0, 0, 1], emission: [0, 0, 0, 1] },
})
const factory =
  (type: Target['type'], key: string) =>
  (target: Target): Sink => {
    if (target.type !== type || !Array.isArray(target.values[key]))
      throw new Error('invalid target/contents')
    return { target, key, disposed: false }
  }
const plays: {
  samples: readonly (readonly number[])[]
  cancelled: boolean
  paused: boolean
  time: number
  end: (done: boolean) => void
}[] = []
const native: NativePropertyDriver = {
  validate() {},
  alive: (raw) => {
    const s = raw as Sink
    return !s.disposed && !s.target.invalid
  },
  read: (raw) => {
    const s = raw as Sink
    return [...s.target.values[s.key]!]
  },
  write: (raw, value) => {
    const s = raw as Sink
    s.target.values[s.key] = [...value]
  },
  dispose: (raw) => {
    ;(raw as Sink).disposed = true
  },
  play(_sink, _track, samples, _last, end) {
    const state = { samples, cancelled: false, paused: false, time: 0, end }
    plays.push(state)
    return {
      cancel: () => {
        state.cancelled = true
      },
      control: (time, paused) => {
        state.time = time
        state.paused = paused
      },
    }
  },
}
const resources: { dispose(): void }[] = []
const own = <T extends { dispose(): void }>(value: T) => {
  resources.push(value)
  return value
}
beforeEach(() => {
  plays.length = 0
  setNativePropertyDriver(native)
  vi.stubGlobal('JoltReferenceProperties', {
    sceneLightIntensity: factory('light', 'intensity'),
    sceneLightColor: factory('light', 'color'),
    sceneMaterialTransparency: factory('material', 'transparency'),
    sceneMaterialDiffuse: factory('material', 'diffuse'),
    sceneMaterialEmission: factory('material', 'emission'),
  })
})
afterEach(() => {
  for (const resource of resources.splice(0)) resource.dispose()
  expect(driver.frames.size).toBe(0)
  setNativePropertyDriver(undefined)
  vi.unstubAllGlobals()
})
describe('SceneKit appearance adapters', () => {
  it('rejects wrong native targets and non-color material contents before taking ownership', () => {
    expect(() => sceneKitLightIntensity(material() as any)).toThrow(/invalid/)
    const target = material(),
      old = own(sceneKitMaterialDiffuse(target as any))
    old.animate('blue', { duration: 1000 })
    target.values.diffuse = undefined as any
    expect(() => sceneKitMaterialDiffuse(target as any)).toThrow(/contents/)
    expect(plays[0]!.cancelled).toBe(false)
  })
  it('validates numeric ranges before interruption and clamps spring overshoot', () => {
    const intensity = own(sceneKitLightIntensity(light() as any)),
      opacity = own(sceneKitMaterialTransparency(material() as any))
    intensity.animate(2000, { duration: 1000 })
    for (const bad of [-1, NaN, Infinity])
      expect(() => intensity.animate(bad)).toThrow(/finite/)
    expect(plays[0]!.cancelled).toBe(false)
    for (const bad of [-0.1, 1.1, NaN]) expect(() => opacity.set(bad)).toThrow(/finite/)
    opacity.animate(0, 'bouncy')
    expect(plays.at(-1)!.samples.every(([v]) => v! >= 0 && v! <= 1)).toBe(true)
    intensity.set(0)
    expect(intensity.get()).toBe(0)
  })
  it.each([sceneKitLightColor, sceneKitMaterialDiffuse, sceneKitMaterialEmission])(
    'samples premultiplied OKLab colors, preserves alpha and accepts Color values',
    (adapter) => {
      const property = own(
        adapter((adapter === sceneKitLightColor ? light() : material()) as any),
      )
      property.set(new Color(0x80ff0000))
      expect(parseColor(property.get())).toBe(0x80ff0000)
      property.animate('#0000ff', { duration: 1000, ease: 'linear' })
      const mid = plays.at(-1)!.samples[30]!,
        expected = colorMixer(0x80ff0000, 0xff0000ff)(0.5)
      const a = (expected >>> 24) / 255
      expect(mid).toEqual([
        (((expected >>> 16) & 255) / 255) * a,
        (((expected >>> 8) & 255) / 255) * a,
        ((expected & 255) / 255) * a,
        a,
      ])
      expect(() => property.set('not-a-color')).toThrow(/color/)
      expect(plays.at(-1)!.cancelled).toBe(false)
      property.set('transparent')
      expect(parseColor(property.get())).toBe(0)
    },
  )
  it('shares per-property ownership on a shared material; old disposal preserves the replacement', async () => {
    const target = material(),
      first = own(sceneKitMaterialDiffuse(target as any)),
      second = own(sceneKitMaterialDiffuse(target as any))
    const emission = own(sceneKitMaterialEmission(target as any))
    const old = first.animate('blue', { duration: 1000 })
    emission.animate('red', { duration: 1000 })
    second.animate('green', { duration: 1000 })
    await expect(old.finished).resolves.toBe(false)
    first.dispose()
    expect(plays.map((p) => p.cancelled)).toEqual([true, false, false])
    second.set('white')
    expect(plays[1]!.cancelled).toBe(false)
  })
  it('starts interruption at the current native value and keeps timeline controls', async () => {
    const target = light(),
      a = own(sceneKitLightIntensity(target as any))
    const old = a.animate(2000, { duration: 1000 })
    target.values.intensity = [1234] // displayed value supplied by the native sink
    const group = timeline([
      { at: 0, run: () => a.animate(400, { duration: 1000, ease: 'linear' }) },
    ])
    await expect(old.finished).resolves.toBe(false)
    expect(plays.at(-1)!.samples[0]).toEqual([1234])
    group.pause()
    expect(plays.at(-1)!.paused).toBe(true)
    group.play()
    expect(plays.at(-1)!.paused).toBe(false)
    group.stop()
  })
  it('binds derived values and observable playback without JS observer frames and cleans scope subscriptions', () => {
    const value = motionValue(0),
      run = animate(value, 1, { duration: 1000, ease: 'linear' })
    const property = own(sceneKitLightIntensity(light() as any)),
      scope = own(motionScope())
    scope.use(() => property.bind(value.to([0, 1], [0, 2]), (n) => n * 500))
    expect(plays.at(-1)!.samples[30]).toEqual([500])
    scope.suspend()
    expect(plays.at(-1)!.cancelled).toBe(true)
    scope.resume()
    const previous = plays.at(-1)!
    const off = property.bind(playbackProgress(run), (p) => 100 + p * 100)
    expect(previous.cancelled).toBe(true)
    run.pause()
    run.progress = 0.7
    expect(property.get()).toBeCloseTo(170)
    run.play()
    off()
    run.stop()
  })
  it('retains non-spatial timing under reduced motion and releases work after target invalidation', async () => {
    configure({ reducedMotion: 'always' })
    const target = light(),
      property = own(sceneKitLightIntensity(target as any))
    const animation = property.animate(1500, { duration: 1000 })
    expect(animation.duration).toBe(1000)
    target.invalid = true
    expect(() => property.set(500)).toThrow(/target/)
    plays[0]!.end(false)
    await expect(animation.finished).resolves.toBe(false)
    expect(plays[0]!.cancelled).toBe(true)
  })
})
