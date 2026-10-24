import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  animate,
  configure,
  motionValue,
  playbackProgress,
  motionScope,
} from '../src/index.js'
import { sceneKitEnvironmentIntensity, sceneKitUniform } from '../src/native/index.js'
import {
  setNativePropertyDriver,
  type NativePropertyDriver,
} from '../src/native-property-driver.js'
import { driver } from './helpers.js'

type Target = {
  values: Record<string, number[]>
  valid: boolean
  type: 'scene' | 'material' | 'geometry'
}
type Sink = { target: Target; key: string; disposed: boolean }
const make = (type: Target['type'] = 'material'): Target => ({
  type,
  valid: true,
  values: {
    environment: [1.6],
    amount: [0],
    tint: [0.2, 0.3, 0.4],
    offset: [0, 0],
    rgba: [0, 0, 0, 1],
  },
})
const properties: { dispose(): void }[] = []
const own = <T extends { dispose(): void }>(resource: T) => {
  properties.push(resource)
  return resource
}
const plays: {
  samples: readonly (readonly number[])[]
  cancelled: boolean
  time: number
  paused: boolean
  end(done: boolean): void
}[] = []
const native: NativePropertyDriver = {
  validate() {},
  alive: (raw) => {
    const s = raw as Sink
    return !s.disposed && s.target.valid
  },
  read: (raw) => {
    const s = raw as Sink
    return [...s.target.values[s.key]!]
  },
  write: (raw, v) => {
    const s = raw as Sink
    s.target.values[s.key] = [...v]
  },
  dispose: (raw) => {
    ;(raw as Sink).disposed = true
  },
  play(_s, _t, samples, _f, end) {
    const p = { samples, cancelled: false, time: 0, paused: false, end }
    plays.push(p)
    return {
      cancel: () => {
        p.cancelled = true
      },
      control: (time, paused) => {
        p.time = time
        p.paused = paused
      },
    }
  },
}
const factory = vi.fn(
  (target: Target, key: string, error: { value?: { localizedDescription: string } }) => {
    if (
      !target.valid ||
      !target.values[key] ||
      (key === 'environment') !== (target.type === 'scene')
    ) {
      error.value = { localizedDescription: 'Invalid native schema or target' }
      return null
    }
    return { target, key, disposed: false }
  },
)
const schema = {
  type: 'float',
  range: [0, 1],
  units: ['fraction'],
  motion: 'appearance',
} as const
const uniform = (target = make()) => own(sceneKitUniform(target as any, 'amount', schema))
beforeEach(() => {
  plays.length = 0
  factory.mockClear()
  setNativePropertyDriver(native)
  vi.stubGlobal('interop', {
    Reference: class {
      value: unknown
    },
  })
  vi.stubGlobal('JoltSceneShaderProperties', {
    environmentError: (t: Target, e: any) => factory(t, 'environment', e),
    uniformNameConfigurationError: (t: Target, n: string, _c: string, e: any) =>
      factory(t, n, e),
  })
})
afterEach(() => {
  properties.splice(0).forEach((p) => p.dispose())
  expect(driver.frames.size).toBe(0)
  setNativePropertyDriver(undefined)
  vi.unstubAllGlobals()
})
describe('SceneKit environment and typed uniforms', () => {
  it('supports the studio multiplier and validates before interrupting a valid owner', () => {
    const p = own(sceneKitEnvironmentIntensity(make('scene') as any))
    expect(p.get()).toBe(1.6)
    p.animate(0.45, { duration: 1000 })
    for (const value of [-1, NaN, Infinity]) expect(() => p.set(value)).toThrow(/finite/)
    expect(plays[0]!.cancelled).toBe(false)
    p.animate(0, 'bouncy')
    expect(plays.at(-1)!.samples.every(([v]) => v! >= 0)).toBe(true)
  })
  it('rejects paths, reserved prefixes, unsupported types and incomplete schemas before native allocation', () => {
    for (const name of [
      'missing.path',
      'u_color',
      'a_pos',
      'v_pos',
      'scn_color',
      'x[0]',
      '',
    ])
      expect(() => sceneKitUniform(make() as any, name, schema)).toThrow()
    for (const options of [
      { ...schema, type: 'matrix' },
      { ...schema, range: [1, 0] },
      { ...schema, range: [0, Infinity] },
      { ...schema, range: [0, 1e40] },
      { ...schema, units: [] },
      { ...schema, motion: 'guess' },
    ])
      expect(() => sceneKitUniform(make() as any, 'amount', options as any)).toThrow()
    expect(factory).not.toHaveBeenCalled()
  })
  it('converts native setup errors into actionable JS errors and checks runtime availability', () => {
    expect(() => sceneKitEnvironmentIntensity(make() as any)).toThrow(/native schema/)
    expect(() => sceneKitUniform(make() as any, 'missing', schema)).toThrow(
      /native schema/,
    )
    vi.stubGlobal('JoltSceneShaderProperties', undefined)
    expect(() => uniform()).toThrow(/rebuild/)
  })
  it.each([
    ['float2', 'offset', [0.2, 0.4]],
    ['float3', 'tint', [0.2, 0.4, 0.6]],
    ['float4', 'rgba', [0.2, 0.4, 0.6, 0.8]],
  ] as const)(
    'keeps %s components coherent and does not apply implicit color conversion',
    (type, name, value) => {
      const p = own(
        sceneKitUniform(make() as any, name, {
          ...schema,
          type,
          units: value.map(() => 'linear component'),
        }),
      )
      p.set(value as any)
      expect(p.get()).toEqual(value)
      expect(() => p.set([0.2] as any)).toThrow(/component/)
      p.animate(value.map(() => 1) as any, 'bouncy')
      expect(
        plays
          .at(-1)!
          .samples.every(
            (v) => v.length === value.length && v.every((n) => n >= 0 && n <= 1),
          ),
      ).toBe(true)
    },
  )
  it('shares ownership by target and uniform name even with different valid schemas', async () => {
    const target = make(),
      a = uniform(target)
    const b = own(sceneKitUniform(target as any, 'amount', { ...schema, range: [0, 2] }))
    const color = own(
      sceneKitUniform(target as any, 'tint', {
        ...schema,
        type: 'float3',
        units: ['r', 'g', 'b'],
      }),
    )
    const old = a.animate(1, { duration: 1000 })
    color.animate([0.6, 0.7, 0.8], { duration: 1000 })
    target.values.amount = [0.3]
    b.animate(1.5, { duration: 1000 })
    await expect(old.finished).resolves.toBe(false)
    expect(plays[2]!.samples[0]).toEqual([0.3])
    a.dispose()
    expect(plays.map((p) => p.cancelled)).toEqual([true, false, false])
  })
  it('copies schema arrays and rejects invalid writes before takeover', () => {
    const options = { ...schema, range: [0, 1] as [number, number], units: ['fraction'] }
    const p = own(sceneKitUniform(make() as any, 'amount', options))
    options.range[1] = 10
    options.units.push('extra')
    p.animate(1, { duration: 1000 })
    expect(() => p.animate(2)).toThrow(/0..1/)
    expect(plays[0]!.cancelled).toBe(false)
  })
  it('binds derived and playback values with pause/seek and no observation frames', () => {
    const p = uniform(),
      source = motionValue(0),
      scope = own(motionScope())
    const run = scope.add(animate(source, 1, { duration: 1000, ease: 'linear' }))
    scope.use(() => p.bind(source.to([0, 1], [0, 0.8]), (v) => v))
    expect(plays.at(-1)!.samples[30]).toEqual([0.4])
    const off = p.bind(playbackProgress(run), (v) => v)
    run.pause()
    run.progress = 0.7
    expect(p.get()).toBeCloseTo(0.7)
    off()
    scope.dispose()
  })
  it('uses the declared motion policy under Reduced Motion and releases invalidated targets', async () => {
    configure({ reducedMotion: 'always' })
    const target = make(),
      appearance = uniform(target)
    const spatial = own(
      sceneKitUniform(make('geometry') as any, 'amount', {
        ...schema,
        motion: 'spatial',
      }),
    )
    expect(spatial.animate(1, { duration: 1000 }).duration).toBe(0)
    const run = appearance.animate(1, { duration: 1000 })
    expect(run.duration).toBe(1000)
    target.valid = false
    expect(() => appearance.get()).toThrow(/target/)
    plays.at(-1)!.end(false)
    await expect(run.finished).resolves.toBe(false)
  })
})
