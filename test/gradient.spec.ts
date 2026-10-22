import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configure, gradient } from '../src/index.js'
import {
  gradientPoints,
  setGradientPainter,
  type GradientFrame,
  type GradientPainter,
  type GradientTiming,
} from '../src/gradient.js'
import { createView, driver } from './helpers.js'

const red = 0xffff0000
const blue = 0xff0000ff

interface Played {
  frames: readonly GradientFrame[]
  times: readonly number[]
  timing: GradientTiming
  onEnd: (finished: boolean) => void
  cancelled: boolean
}

let painted: GradientFrame[]
let played: Played[]
let removed: number

beforeEach(() => {
  painted = []
  played = []
  removed = 0
  setGradientPainter((): GradientPainter => ({
    paint: (frame) => painted.push(frame),
    play(frames, times, timing, onEnd) {
      const entry: Played = { frames, times, timing, onEnd, cancelled: false }
      played.push(entry)
      return { cancel: () => (entry.cancelled = true) }
    },
    remove: () => removed++,
  }))
})

afterEach(() => setGradientPainter(undefined))

describe('gradient', () => {
  it('paints the first frame with even stops and default geometry', () => {
    gradient(createView(), { type: 'linear', colors: ['red', 'blue', '#00ff00'] })
    expect(painted).toEqual([
      {
        colors: [red, blue, 0xff00ff00],
        stops: [0, 0.5, 1],
        angle: 180,
        x: 0.5,
        y: 0.5,
        radius: 0.5,
      },
    ])
  })

  it('rejects bad types, color counts, stops and geometry', () => {
    const view = createView()
    expect(() =>
      gradient(view, { type: 'mesh', colors: ['red', 'blue'] } as never),
    ).toThrow(TypeError)
    expect(() => gradient(view, { type: 'linear', colors: ['red'] })).toThrow(
      /two and eight/,
    )
    expect(() =>
      gradient(view, { type: 'linear', colors: ['red', 'blue'], stops: [0.6, 0.2] }),
    ).toThrow(/without going back/)
    expect(() =>
      gradient(view, { type: 'radial', colors: ['red', 'blue'], radius: -1 }),
    ).toThrow(/negative/)
    expect(() =>
      gradient(view, { type: 'conic', colors: ['red', 'blue'], angle: Number.NaN }),
    ).toThrow(/angle/)
  })

  it('plays sampled frames from the values on screen to the new ones', async () => {
    const glow = gradient(createView(), {
      type: 'radial',
      colors: ['red', 'blue'],
      radius: 0.4,
    })
    const animation = glow.animate(
      { radius: 1.2, colors: ['blue', 'red'] },
      { duration: 400, ease: 'linear' },
    )

    const [run] = played
    expect(run!.timing).toEqual({ duration: 400, delay: 0, repeat: 0, reverse: false })
    expect(run!.frames[0]).toMatchObject({ radius: 0.4, colors: [red, blue] })
    expect(run!.frames.at(-1)).toMatchObject({ radius: 1.2, colors: [blue, red] })
    expect(run!.times[0]).toBe(0)
    expect(run!.times.at(-1)).toBe(1)

    run!.onEnd(true)
    expect(await animation).toBe(true)
  })

  it('starts an interruption from the frame on screen and cancels the first animation', async () => {
    const glow = gradient(createView(), {
      type: 'linear',
      colors: ['red', 'blue'],
      angle: 0,
    })
    const first = glow.animate({ angle: 180 }, { duration: 400, ease: 'linear' })
    driver.advance(100)
    const second = glow.animate({ angle: 90 }, { duration: 400, ease: 'linear' })

    expect(played[0]!.cancelled).toBe(true)
    expect(await first).toBe(false)
    expect(played[1]!.frames[0]!.angle).toBeCloseTo(45)
    played[1]!.onEnd(true)
    expect(await second).toBe(true)
  })

  it('keeps the color count when animating and changes it with set()', () => {
    const glow = gradient(createView(), { type: 'linear', colors: ['red', 'blue'] })
    expect(() => glow.animate({ colors: ['red', 'blue', 'green'] })).toThrow(
      /keeps its 2 colors/,
    )
    glow.set({ colors: ['red', 'blue', 'green'] })
    expect(painted.at(-1)!.stops).toEqual([0, 0.5, 1])
  })

  it('stops where it is and paints that frame', async () => {
    const glow = gradient(createView(), {
      type: 'radial',
      colors: ['red', 'blue'],
      radius: 0,
    })
    const animation = glow.animate({ radius: 1 }, { duration: 400, ease: 'linear' })
    driver.advance(200)
    glow.stop()

    expect(played[0]!.cancelled).toBe(true)
    expect(painted.at(-1)!.radius).toBeCloseTo(0.5)
    expect(await animation).toBe(false)
  })

  it('lets geometry overshoot on a spring while colors stay between their ends', () => {
    const glow = gradient(createView(), {
      type: 'radial',
      colors: ['red', 'blue'],
      radius: 0.2,
    })
    glow.animate({ radius: 1, colors: ['blue', 'red'] }, 'bouncy')
    const frames = played[0]!.frames
    expect(Math.max(...frames.map((frame) => frame.radius))).toBeGreaterThan(1)
    for (const frame of frames)
      for (const color of frame.colors) expect(color >>> 24).toBe(0xff)
  })

  it('moves geometry at once and still fades colors with reduced motion', () => {
    configure({ reducedMotion: 'always' })
    const glow = gradient(createView(), {
      type: 'conic',
      colors: ['red', 'blue'],
      angle: 0,
    })
    glow.animate({ angle: 120, colors: ['blue', 'red'] }, { duration: 300 })
    const frames = played[0]!.frames
    expect(new Set(frames.map((frame) => frame.angle))).toEqual(new Set([120]))
    expect(frames[0]!.colors).toEqual([red, blue])
    expect(frames.at(-1)!.colors).toEqual([blue, red])
  })

  it('passes repeats through and lands on the right end of a reversed loop', async () => {
    const glow = gradient(createView(), {
      type: 'linear',
      colors: ['red', 'blue'],
      angle: 0,
    })
    const loop = glow.animate(
      { angle: 90 },
      { duration: 300, repeat: 1, repeatType: 'reverse' },
    )
    expect(played[0]!.timing).toMatchObject({ repeat: 1, reverse: true })
    played[0]!.onEnd(true)
    expect(await loop).toBe(true)
    glow.set({})
    expect(painted.at(-1)!.angle).toBe(0)
  })

  it('stops when the view unloads and removes the painter once', async () => {
    const view = createView()
    const glow = gradient(view, { type: 'linear', colors: ['red', 'blue'] })
    const animation = glow.animate({ angle: 90 })
    view.notify({ eventName: 'unloaded', object: view })
    expect(await animation).toBe(false)

    glow.remove()
    glow.remove()
    expect(removed).toBe(1)
    expect(() => glow.animate({ angle: 0 })).toThrow(/removed/)
  })

  it('finishes at once without a native painter', async () => {
    setGradientPainter(() => undefined)
    const glow = gradient(createView(), { type: 'linear', colors: ['red', 'blue'] })
    expect(await glow.animate({ angle: 90 })).toBe(true)
  })
})

describe('gradient geometry', () => {
  const frame = (angle: number, radius = 0.5): GradientFrame => ({
    colors: [red, blue],
    stops: [0, 1],
    angle,
    x: 0.5,
    y: 0.5,
    radius,
  })

  it('runs linear gradients like CSS, reaching the corners', () => {
    const down = gradientPoints('linear', frame(180), 100, 100)
    expect(down.start.x).toBeCloseTo(0.5)
    expect(down.start.y).toBeCloseTo(0)
    expect(down.end.x).toBeCloseTo(0.5)
    expect(down.end.y).toBeCloseTo(1)
    const right = gradientPoints('linear', frame(90), 100, 100)
    expect(right.start.x).toBeCloseTo(0)
    expect(right.end.x).toBeCloseTo(1)
    const diagonal = gradientPoints('linear', frame(45), 200, 100)
    expect(diagonal.start.x).toBeCloseTo(-0.1)
    expect(diagonal.start.y).toBeCloseTo(0.8)
    expect(diagonal.end.x).toBeCloseTo(1.1)
    expect(diagonal.end.y).toBeCloseTo(0.2)
  })

  it('keeps linear bands square to the angle on a box that is not square', () => {
    // Core Animation's axial gradient: progress is the projection onto the line in unit space.
    for (const [angle, width, height] of [
      [135, 330, 120],
      [45, 200, 100],
      [200, 120, 300],
    ] as const) {
      const { start, end } = gradientPoints('linear', frame(angle), width, height)
      const line = { x: end.x - start.x, y: end.y - start.y }
      const at = (x: number, y: number) =>
        ((x / width - start.x) * line.x + (y / height - start.y) * line.y) /
        (line.x ** 2 + line.y ** 2)
      const corners = [at(0, 0), at(width, 0), at(0, height), at(width, height)]
      expect(Math.min(...corners)).toBeCloseTo(0)
      expect(Math.max(...corners)).toBeCloseTo(1)
      const radians = (angle * Math.PI) / 180
      const along = { x: Math.cos(radians), y: Math.sin(radians) }
      const center = at(width / 2, height / 2)
      expect(at(width / 2 + 40 * along.x, height / 2 + 40 * along.y)).toBeCloseTo(center)
    }
  })

  it('measures a radial radius on the shorter side and points a conic start up at 0°', () => {
    const radial = gradientPoints('radial', frame(0, 0.5), 200, 100)
    expect(radial.end).toEqual({ x: 0.75, y: 1 })
    const conic = gradientPoints('conic', frame(0), 100, 100)
    expect(conic.end.x).toBeCloseTo(0.5)
    expect(conic.end.y).toBeCloseTo(0)
  })
})
