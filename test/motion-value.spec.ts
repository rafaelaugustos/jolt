import { describe, expect, it } from 'vitest'
import {
  animate,
  bind,
  configure,
  motionScope,
  motionValue,
  set,
  stop,
} from '../src/index.js'
import { createView, driver, state } from './helpers.js'

const linear = { duration: 400, ease: 'linear' } as const

describe('motion values', () => {
  it('give bound views their current value at once', () => {
    const progress = motionValue(0)
    const sheet = createView()
    bind(sheet, { y: progress.to([0, 1], [600, 0]) })

    expect(sheet.translateY).toBe(600)
    expect(driver.played).toHaveLength(0)
  })

  it('drive every bound property on one native clock', async () => {
    const progress = motionValue(0)
    const sheet = createView()
    const backdrop = createView()
    bind(sheet, {
      y: progress.to([0, 1], [600, 0]),
      scale: progress.to([0, 1], [0.9, 1]),
    })
    bind(backdrop, { opacity: progress.to([0, 1], [0, 0.4]) })

    const animation = animate(progress, 1, linear)
    const y = driver.last('y', sheet).track
    const opacity = driver.last('opacity', backdrop).track
    expect(driver.played.map((played) => played.track.property).sort()).toEqual([
      'opacity',
      'scaleX',
      'scaleY',
      'y',
    ])
    expect(new Set(driver.played.map((played) => played.startedAt)).size).toBe(1)
    expect(y.values[0]).toBe(600)
    expect(y.to).toBe(0)
    expect(opacity.to).toBeCloseTo(0.4)
    expect(y.times).toEqual(opacity.times)
    expect(sheet.translateY).toBe(0)

    driver.advance(100)
    expect(progress.get()).toBeCloseTo(0.25)
    expect(progress.to([0, 1], [600, 0]).get()).toBeCloseTo(450)

    driver.advance(300)
    expect(await animation).toBe(true)
    expect(progress.get()).toBe(1)
  })

  it('start an interruption from the value on screen, with its velocity', async () => {
    const progress = motionValue(0)
    const sheet = createView()
    bind(sheet, { y: progress.to([0, 1], [600, 0]) })

    const open = animate(progress, 1, linear)
    driver.advance(100)
    animate(progress, 0, 'snappy')

    expect(await open).toBe(false)
    const back = driver.last('y', sheet).track
    expect(back.values[0]).toBeCloseTo(450)
    expect(back.velocityAt(0)).toBeLessThan(0)
    expect(back.to).toBe(600)
  })

  it('clamp outputs by default and extend them with clamp: false', () => {
    const progress = motionValue(0)
    const clamped = createView()
    const free = createView()
    bind(clamped, { y: progress.to([0, 1], [100, 0]) })
    bind(free, { y: progress.to([0, 1], [100, 0], { clamp: false }) })

    animate(progress, 1, 'bouncy')
    expect(Math.min(...driver.last('y', clamped).track.values)).toBe(0)
    expect(Math.min(...driver.last('y', free).track.values)).toBeLessThan(0)
  })

  it('map to colors in OKLab', () => {
    const progress = motionValue(0)
    const card = createView()
    const tint = progress.to([0, 1], ['#000000', '#ffffff'])
    bind(card, { backgroundColor: tint })
    expect(card.backgroundColor?.argb).toBe(0xff000000)

    animate(progress, 1, linear)
    const track = driver.last('backgroundColor', card).track
    expect(track.to >>> 0).toBe(0xffffffff)
    expect(tint.get().argb).toBe(0xff000000)
  })

  it('set every bound view at once and stop the animation in progress', async () => {
    const progress = motionValue(0)
    const sheet = createView()
    bind(sheet, { y: progress.to([0, 1], [600, 0]) })
    const open = animate(progress, 1, linear)

    set(progress, 0.5)
    expect(await open).toBe(false)
    expect(progress.get()).toBe(0.5)
    expect(sheet.translateY).toBe(300)
  })

  it('stop the value and its views where they are', async () => {
    const progress = motionValue(0)
    const sheet = createView()
    bind(sheet, { y: progress.to([0, 1], [600, 0]) })
    const open = animate(progress, 1, linear)

    driver.advance(200)
    stop(progress)
    expect(await open).toBe(false)
    expect(progress.get()).toBeCloseTo(0.5)
    expect(sheet.translateY).toBeCloseTo(300)
  })

  it('hand a property to a regular animation and keep driving the others', () => {
    const progress = motionValue(0)
    const sheet = createView()
    const backdrop = createView()
    bind(sheet, { y: progress.to([0, 1], [600, 0]) })
    bind(backdrop, { opacity: progress })

    animate(sheet, { y: 100 }, { duration: 200 })
    const played = driver.played.length
    animate(progress, 1, linear)

    expect(driver.played.slice(played).map((p) => p.view)).toEqual([backdrop])
  })

  it('stop following after cleanup and keep the view where it is', () => {
    const progress = motionValue(0)
    const sheet = createView()
    const release = bind(sheet, { y: progress.to([0, 1], [600, 0]) })
    animate(progress, 1, linear)
    driver.advance(200)

    release()
    expect(sheet.translateY).toBeCloseTo(300)
    expect(driver.last('y', sheet).stopped).toBe(true)
    const played = driver.played.length
    set(progress, 0)
    expect(driver.played).toHaveLength(played)
    expect(sheet.translateY).toBeCloseTo(300)
  })

  it('pick the value up when a view loads, joining an animation in progress', () => {
    const progress = motionValue(0)
    const sheet = createView().unload()
    bind(sheet, { y: progress.to([0, 1], [600, 0]) })
    animate(progress, 1, linear)
    expect(driver.played).toHaveLength(0)

    driver.advance(100)
    sheet.load()
    const joined = driver.last('y', sheet)
    expect(joined.offset).toBeCloseTo(100)
    expect(joined.track.values[0]).toBe(600)

    driver.advance(400)
    sheet.unload()
    sheet.load()
    expect(sheet.translateY).toBe(0)
  })

  it('jump transforms and still fade opacity with reduced motion', () => {
    configure({ reducedMotion: 'always' })
    const progress = motionValue(0)
    const sheet = createView()
    bind(sheet, { y: progress.to([0, 1], [600, 0]), opacity: progress })

    animate(progress, 1, linear)
    expect(driver.played.map((played) => played.track.property)).toEqual(['opacity'])
    expect(sheet.translateY).toBe(0)
  })

  it('repeat on the value and scale its time once', async () => {
    configure({ timeScale: 0.5 })
    const progress = motionValue(0)
    const dot = createView()
    bind(dot, { scale: progress.to([0, 1], [1, 1.2]) })

    const pulse = animate(progress, [0, 1], {
      ...linear,
      repeat: Infinity,
      repeatType: 'reverse',
    })
    const track = driver.last('scaleX', dot).track
    expect(track.duration).toBe(800)
    expect(track.repeat).toBe(Infinity)
    expect(track.reverse).toBe(true)

    const done = state(pulse.finished)
    driver.advance(10000)
    expect(done()).toBeUndefined()
    pulse.stop()
    expect(await pulse).toBe(false)
  })

  it('belong to a scope through use()', () => {
    const scope = motionScope()
    const progress = motionValue(0)
    const sheet = createView()
    scope.use(() => bind(sheet, { y: progress }))
    scope.dispose()
    set(progress, 50)
    expect(sheet.translateY).toBe(0)
  })

  it('reject bad ranges, mismatched kinds and unknown properties', () => {
    const progress = motionValue(0)
    const view = createView()
    expect(() => motionValue(Number.NaN)).toThrow(RangeError)
    expect(() => progress.to([0, 1], [0])).toThrow(/one output per input/)
    expect(() => progress.to([0, 1, 0], [0, 1, 0])).toThrow(/cannot change direction/)
    expect(() =>
      (progress.to([0, 1], ['red', 'blue']) as never as typeof progress).to(
        [0, 1],
        [0, 1],
      ),
    ).toThrow(/mapped again/)
    expect(() =>
      bind(view, { x: progress.to([0, 1], ['red', 'blue']) } as never),
    ).toThrow(/takes numbers/)
    expect(() => bind(view, { backgroundColor: progress } as never)).toThrow(/is a color/)
    expect(() => bind(view, { width: progress } as never)).toThrow(/Can't bind "width"/)
    expect(() => bind(view, { x: 3 } as never)).toThrow(/needs a motion value/)
    expect(() => animate(progress, [Number.NaN])).toThrow(RangeError)
  })
})

describe('motion values in Vue', () => {
  it('stop with the component and rebind recreated elements', async () => {
    const { useBinding, useMotionValue } = await import('../src/vue/index.js')
    const { unmountHooks } = await import('./shims/vue.js')
    const progress = useMotionValue(0)
    const ref = useBinding({ x: progress.to([0, 1], [0, 100]) })

    const first = createView()
    ref({ nativeView: first })
    set(progress, 1)
    expect(first.translateX).toBe(100)

    const second = createView()
    ref(null)
    ref({ nativeView: second })
    expect(second.translateX).toBe(100)

    const pulse = animate(progress, 0, linear)
    unmountHooks.splice(0).forEach((hook) => hook())
    expect(await pulse).toBe(false)
    const left = second.translateX
    set(progress, 0.5)
    expect(second.translateX).toBe(left)
  })
})
