import { describe, expect, it } from 'vitest'
import { createPreset } from '../src/core/preset-recipe.js'
import { presets } from '../src/core/presets.js'
import { animate, definePreset } from '../src/index.js'
import { createView, driver } from './helpers.js'

declare module '@rafaelaugusto/jolt' {
  interface Presets {
    parameterizedEntrance: true
  }
}

describe('portable parameter recipes', () => {
  it('preserves defaults without sharing mutable frames or transitions', () => {
    const recipe = createPreset('fadeInUp')
    expect(recipe).toEqual(presets.fadeInUp)
    ;(recipe.keyframes.y as number[])[0] = 88
    recipe.transition.opacity!.duration = 1
    expect(presets.fadeInUp.keyframes.y).toEqual([24, 0])
    expect(presets.fadeInUp.transition.opacity.duration).toBe(300)
  })
  it('uses explicit directional endpoints and zero distance/scale/duration', () => {
    expect(
      createPreset('fadeInUp', { distance: 48, direction: 'left' }).keyframes,
    ).toEqual({ opacity: [0, 1], x: [-48, 0] })
    expect(
      createPreset('fadeOutDown', { distance: 32, direction: 'up' }).keyframes,
    ).toEqual({ opacity: 0, y: -32 })
    expect(createPreset('popIn', { scale: 0, duration: 0 }).transition).toEqual({
      type: 'tween',
      duration: 0,
      ease: 'easeOut',
    })
    expect(createPreset('fadeInRight', { distance: 0 }).keyframes.x).toEqual([0, 0])
  })
  it('parameterizes the flip entrances and keeps their rotation channel', () => {
    expect(createPreset('flipInX')).toEqual(presets.flipInX)
    const recipe = createPreset('flipInY', { direction: 'up', distance: 30, scale: 0.8 })
    expect(recipe.keyframes).toEqual({
      opacity: [0, 1],
      rotateY: [90, 0],
      y: [30, 0],
      scale: [0.8, 1],
    })
    ;(recipe.keyframes.rotateY as number[])[0] = 10
    expect(presets.flipInY.keyframes.rotateY).toEqual([90, 0])
    expect(createPreset('flipInX', { duration: 240 }).transition).toEqual({
      type: 'tween',
      duration: 240,
      ease: 'easeOut',
    })
  })
  it('rejects invalid requests before touching the registry or shared definitions', () => {
    for (const options of [
      { distance: NaN },
      { scale: -1 },
      { duration: Infinity },
      { duration: 60_001 },
      { direction: 'diagonal' },
      { unknown: 1 },
    ])
      expect(() => createPreset('fadeIn', options as any)).toThrow()
    expect(() => createPreset('popOut' as any)).toThrow()
    expect(presets.fadeIn.transition.duration).toBe(300)
  })
  it('plays through the existing native registry and driver', () => {
    definePreset(
      'parameterizedEntrance',
      createPreset('fadeInUp', { distance: 72, duration: 220 }),
    )
    const view = createView()
    animate(view, 'parameterizedEntrance')
    expect(driver.last('y', view).track.values[0]).toBe(72)
    expect(driver.last('y', view).track.to).toBe(0)
    expect(driver.last('y', view).track.duration).toBe(220)
    expect(driver.last('opacity', view).track.duration).toBe(220)
  })
})
