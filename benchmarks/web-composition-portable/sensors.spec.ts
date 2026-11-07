import { expect, test } from '@playwright/test'
import type {} from './fixture.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.composition)
})

test('vector kinds share acquisition, preserve units and reject incomplete samples independently', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    Object.defineProperty(window, 'DeviceMotionEvent', {
      configurable: true,
      value: function () {},
    })
    const added: EventListenerOrEventListenerObject[] = [],
      removed: EventListenerOrEventListenerObject[] = []
    const add = window.addEventListener.bind(window),
      remove = window.removeEventListener.bind(window)
    window.addEventListener = ((
      name: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (name === 'devicemotion') added.push(listener)
      add(name, listener, options)
    }) as typeof window.addEventListener
    window.removeEventListener = ((
      name: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (name === 'devicemotion') removed.push(listener)
      remove(name, listener, options)
    }) as typeof window.removeEventListener
    const scope = window.composition.runtime.scope()
    const sensors = [
      'acceleration',
      'linearAcceleration',
      'gravity',
      'gyroscope',
      'magneticField',
    ].map((kind) => scope.sensor(kind as 'acceleration', { coordinates: 'device' }))
    const before = added.length
    const off = sensors.map((s) => s.x.subscribe(() => {}))
    const emit = (linear: object | null) =>
      window.dispatchEvent(
        Object.assign(new Event('devicemotion'), {
          accelerationIncludingGravity: { x: 1, y: 2, z: 9.8 },
          acceleration: linear,
          rotationRate: { alpha: 180, beta: 90, gamma: -45 },
        }),
      )
    emit(null)
    const partial = sensors.map((s) => s.snapshot())
    emit({ x: 0.5, y: 0.5, z: 0 })
    const complete = sensors.map((s) => s.snapshot())
    scope.suspend()
    const afterPause = removed.length
    emit({ x: 100, y: 100, z: 100 })
    const paused = sensors.map((s) => s.snapshot().samples)
    scope.resume()
    const resumed = added.length
    off.forEach((fn) => fn())
    const afterOff = removed.length
    scope.dispose()
    return {
      before,
      partial,
      complete,
      afterPause,
      paused,
      resumed,
      afterOff,
      disposed: sensors.every((s) => s.disposed),
    }
  })
  expect(result.before).toBe(0)
  expect(result.partial.map((s) => s.samples)).toEqual([1, 0, 0, 1, 0])
  expect(result.complete.map((s) => s.unit)).toEqual([
    'm/s²',
    'm/s²',
    'm/s²',
    'rad/s',
    'µT',
  ])
  expect(result.complete[0]!.values).toEqual([1, 2, 9.8])
  expect(result.complete[1]!.values).toEqual([0.5, 0.5, 0])
  expect(result.complete[2]!.values).toEqual([-0.5, -1.5, -9.8])
  expect(result.complete[3]!.values).toEqual([Math.PI / 2, -Math.PI / 4, Math.PI])
  expect(result.complete[4]).toMatchObject({
    status: 'unavailable',
    available: false,
    backend: 'none',
    reason: 'unsupported-kind',
  })
  expect(result.afterPause).toBe(1)
  expect(result.resumed).toBe(2)
  expect(result.afterOff).toBe(2)
  expect(result.paused).toEqual([2, 1, 1, 2, 0])
  expect(result.disposed).toBe(true)
})

test('permission requires an explicit gesture, retries denied data and cannot revive disposal', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    let prompts = 0,
      grant = false,
      resolve: ((value: string) => void) | undefined
    Object.defineProperty(window, 'DeviceMotionEvent', {
      configurable: true,
      value: Object.assign(function () {}, {
        requestPermission: () => {
          prompts++
          return resolve === undefined
            ? Promise.resolve(grant ? 'granted' : 'denied')
            : new Promise<string>((r) => {
                resolve = r
              })
        },
      }),
    })
    const s = window.composition.runtime.sensor('gyroscope')
    const off = s.z.subscribe(() => {}),
      initial = s.status,
      unprompted = prompts
    const first = await s.requestPermission(),
      denied = s.status
    grant = true
    const second = await s.requestPermission(),
      starting = s.status
    resolve = () => {}
    const pending = s.requestPermission()
    s.dispose()
    resolve!('granted')
    off()
    return {
      initial,
      unprompted,
      first,
      denied,
      second,
      starting,
      late: await pending,
      status: s.status,
    }
  })
  expect(result).toEqual({
    initial: 'permission-required',
    unprompted: 0,
    first: 'denied',
    denied: 'denied',
    second: 'granted',
    starting: 'starting',
    late: 'unavailable',
    status: 'disposed',
  })
})

test('missing API and no data remain unavailable; interval, orientation and reduced motion preserve last values', async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(window, 'DeviceMotionEvent', {
      configurable: true,
      value: undefined,
    })
    const runtime = window.composition.runtime,
      missing = runtime.sensor('acceleration')
    if (missing.snapshot().reason !== 'missing-api')
      throw Error('missing source claimed support')
    missing.dispose()
    Object.defineProperty(window, 'DeviceMotionEvent', {
      configurable: true,
      value: function () {},
    })
    const s = runtime.sensor('linearAcceleration', { interval: 100 })
    const off = s.x.subscribe(() => {})
    Object.assign(window, { vectorTest: { s, off } })
  })
  await expect
    .poll(() => page.evaluate(() => (window as any).vectorTest.s.snapshot().reason), {
      timeout: 3500,
    })
    .toBe('no-data')
  const result = await page.evaluate(() => {
    const { s, off } = (window as any).vectorTest
    const emit = (stamp: number, x: number) => {
      const e = Object.assign(new Event('devicemotion'), {
        acceleration: { x, y: 2, z: 3 },
      })
      Object.defineProperty(e, 'timeStamp', { value: stamp })
      window.dispatchEvent(e)
    }
    emit(1000, 1)
    emit(1010, 50)
    const first = s.snapshot()
    Object.defineProperty(screen.orientation, 'angle', { configurable: true, value: 90 })
    screen.orientation.dispatchEvent(new Event('change'))
    const rotated = s.snapshot()
    window.composition.runtime.configure({ reducedMotion: 'always' })
    emit(1200, 50)
    const paused = s.snapshot()
    window.composition.runtime.configure({ reducedMotion: 'never' })
    emit(1300, 4)
    const resumed = s.snapshot()
    off()
    s.dispose()
    return { first, rotated, paused, resumed }
  })
  expect(result.first).toMatchObject({
    samples: 1,
    values: [1, 2, 3],
    available: true,
    status: 'active',
  })
  expect(result.rotated.values[0]).toBeCloseTo(2)
  expect(result.rotated.values[1]).toBeCloseTo(-1)
  expect(result.rotated.samples).toBe(1)
  expect(result.paused.status).toBe('paused')
  expect(result.paused.samples).toBe(1)
  expect(result.resumed.samples).toBe(2)
  expect(result.resumed.values[1]).toBeCloseTo(-4)
})
