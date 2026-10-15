import { Color, Label } from '@nativescript/core'
import { describe, expect, it } from 'vitest'
import { animate, sequence, stop } from '../src/index.js'
import { colorMixer, parseColor } from '../src/color.js'
import { createTrack } from '../src/track.js'
import { resolveTransition } from '../src/transition.js'
import { createView, driver, flush } from './helpers.js'

const red = 0xffff0000
const blue = 0xff0000ff
const white = 0xffffffff
const track = (options = {}) =>
  createTrack(
    'backgroundColor',
    [red, blue],
    resolveTransition(
      { duration: 1000, ease: 'linear', ...options },
      'backgroundColor',
      2,
    ),
    0,
  )

describe('perceptual color interpolation', () => {
  it('uses OKLab rather than an RGB midpoint', () => {
    expect(colorMixer(red, blue)(0.5)).toBe(0xff8c53a2)
    expect(colorMixer(0xff000000, white)(0.5)).toBe(0xff636363)
  })
  it('premultiplies alpha and keeps exact endpoints', () => {
    const mix = colorMixer(0x00ff0000, blue)
    expect(mix(0)).toBe(0x00ff0000)
    expect(mix(0.5)).toBe(0x800000ff)
    expect(mix(1)).toBe(blue)
    expect(colorMixer(0x00ff0000, 0x0000ff00)(0.5)).toBe(0)
  })
  it('accepts NativeScript names, hex values and Color objects', () => {
    expect(parseColor('red')).toBe(red)
    expect(parseColor('#123')).toBe(0xff112233)
    expect(parseColor(new Color('#800000ff'))).toBe(0x800000ff)
    for (const bad of [12, {}, undefined, 'not-a-color'])
      expect(() => parseColor(bad)).toThrow()
  })
  it.each([
    { repeat: 1 },
    { repeat: Infinity },
    { repeat: 1, repeatType: 'reverse' as const },
  ])(
    'keeps the native last keyframe at the end of the first iteration: %j',
    (options) => {
      const result = track(options)
      expect(result.values[0]).toBe(red)
      expect(result.values.at(-1)).toBe(blue)
      expect(result.valueAt(500)).toBe(0xff8c53a2)
    },
  )
  it('keeps explicit color stops and their timing', () => {
    const result = createTrack(
      'color',
      [red, white, blue],
      resolveTransition(
        { duration: 1000, ease: 'linear', times: [0, 0.2, 1] },
        'color',
        3,
      ),
      0,
    )
    expect(result.valueAt(200)).toBe(white)
    expect(result.times).toContain(0.2)
    expect(result.valueAt(600)).toBe(colorMixer(white, blue)(0.5))
  })
})

describe('color ownership in animate', () => {
  it('combines transforms and colors, defaulting colors to a tween', async () => {
    const view = createView()
    view.backgroundColor = new Color('red')
    const animation = animate(view, { backgroundColor: 'blue', x: 100 })
    expect(driver.last('backgroundColor').track.duration).toBe(300)
    expect(driver.last('backgroundColor').track.values[0]).toBe(red)
    expect(view.backgroundColor.argb).toBe(blue)
    driver.advance(10000)
    expect(await animation).toBe(true)
  })
  it('freezes a selected color and lets the other properties finish', async () => {
    const view = createView()
    const animation = animate(
      view,
      { backgroundColor: ['red', 'blue'], x: [0, 100] },
      { duration: 1000, ease: 'linear' },
    )
    driver.advance(500)
    stop(view, ['backgroundColor'])
    expect(view.backgroundColor?.argb).toBe(0xff8c53a2)
    expect(driver.last('x').stopped).toBe(false)
    driver.advance(500)
    expect(await animation).toBe(false)
    expect(view.translateX).toBe(100)
  })
  it('takes over from the visible color', async () => {
    const view = createView()
    const first = animate(
      view,
      { borderColor: ['red', 'blue'] },
      { duration: 1000, ease: 'linear' },
    )
    driver.advance(500)
    const next = animate(view, { borderColor: 'white' })
    expect(driver.last('borderColor').track.values[0]).toBe(0xff8c53a2)
    expect(await first).toBe(false)
    next.stop()
  })
  it('validates colors and targets before interrupting an animation', async () => {
    const view = createView()
    const animation = animate(view, { x: 100 }, { duration: 1000 })
    expect(() => animate(view, { x: 0, backgroundColor: 'bad' })).toThrow()
    expect(() => animate([view, createView()], { color: 'red' })).toThrow(/Text color/)
    expect(() =>
      animate(view, { backgroundColor: 'red' }, { duration: Infinity }),
    ).toThrow()
    expect(driver.last('x').stopped).toBe(false)
    animation.stop()
    expect(await animation).toBe(false)
  })
  it('rejects independently colored border edges before changing the view', () => {
    const view = createView()
    view.borderTopColor = new Color('red')
    view.borderBottomColor = new Color('blue')
    expect(() => animate(view, { borderColor: 'white' })).toThrow(/every edge/)
    expect(view.borderTopColor.argb).toBe(red)
    expect(driver.played).toHaveLength(0)
  })
  it('sets explicit starting colors before load, including with relative transforms', async () => {
    const view = createView().unload()
    const animation = animate(
      view,
      { backgroundColor: ['red', 'blue'], x: [0, 20] },
      { relative: true },
    )
    expect(view.backgroundColor?.argb).toBe(red)
    view.load()
    expect(driver.last('backgroundColor').track.values[0]).toBe(red)
    animation.stop()
    expect(await animation).toBe(false)
  })
  it('keeps sequence colors absolute while translations are relative', async () => {
    const view = new Label()
    const animation = sequence([
      [view, { color: ['red', 'blue'] }, { duration: 100, relative: true }],
    ])
    await flush()
    expect(driver.last('color').track.values[0]).toBe(red)
    driver.advance(100)
    expect(await animation).toBe(true)
  })
})
