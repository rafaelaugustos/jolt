import {
  decorativeLayer,
  effectOptions,
  effectOwnership,
  effectTarget,
  positioned,
  type EffectHost,
} from './effect.js'
import { parseColor } from './style.js'
import { colorCSS } from './properties.js'
import { bounded, SurfaceLoop } from './surface-effect.js'

export interface WebParticleOptions {
  colors?: readonly string[]
  shape?: 'circle' | 'rectangle' | 'ring'
  source?: 'center' | 'top' | 'bottom'
  rate?: number
  lifetime?: number
  size?: number
  velocity?: number
  velocityRange?: number
  angle?: number
  spread?: number
  gravity?: number
  spin?: number
  spinRange?: number
  fadeOut?: boolean
  duration?: number
}
export interface WebConfettiOptions {
  count?: number
  colors?: readonly string[]
}
export interface WebParticles {
  (): void
  readonly disposed: boolean
  readonly paused: boolean
  readonly suspended: boolean
  readonly finished: Promise<boolean>
  pause(): void
  play(): void
  suspend(): void
  resume(): void
  stop(): void
  cancel(): void
  dispose(): void
  snapshot(): { backend: 'canvas-2d' | 'none'; particles: number; frames: number }
}
type Settings = Required<Omit<WebParticleOptions, 'duration'>> & { duration?: number }
type Particle = {
  born: number
  x: number
  y: number
  vx: number
  vy: number
  spin: number
  color: string
}
const keys = [
  'colors',
  'shape',
  'source',
  'rate',
  'lifetime',
  'size',
  'velocity',
  'velocityRange',
  'angle',
  'spread',
  'gravity',
  'spin',
  'spinRange',
  'fadeOut',
  'duration',
]
const palette = ['#facc15', '#ef4444', '#3b82f6', '#22c55e', '#a855f7']
function settings(input: WebParticleOptions, host: EffectHost, burst: boolean): Settings {
  effectOptions(input, keys)
  const colors = input.colors ?? ['#ffffff']
  if (!Array.isArray(colors) || !colors.length || colors.length > 32)
    throw new TypeError('Particles need 1 to 32 CSS colors.')
  const parsed = Array.from(colors, (color) => {
    if (typeof color !== 'string') throw new TypeError('Invalid particle color.')
    return colorCSS(parseColor(host.document, color))
  })
  const shape = input.shape ?? 'circle',
    source = input.source ?? 'center'
  if (
    !['circle', 'rectangle', 'ring'].includes(shape) ||
    !['center', 'top', 'bottom'].includes(source)
  )
    throw new TypeError('Invalid particle shape or source.')
  const lifetime = bounded(input.lifetime ?? 3000, 'lifetime', 1, 60000)
  const rate = bounded(input.rate ?? 20, 'rate', 0, burst ? 50000 : 10000)
  if (!burst && (rate * lifetime) / 1000 > 10000)
    throw new RangeError('At most 10000 live particles.')
  const fadeOut = input.fadeOut ?? true
  if (typeof fadeOut !== 'boolean') throw new TypeError('fadeOut must be boolean.')
  return {
    colors: parsed,
    shape,
    source,
    lifetime,
    rate,
    fadeOut,
    duration:
      input.duration === undefined
        ? undefined
        : bounded(input.duration, 'duration', 1, 2147483647 - lifetime - 50),
    size: bounded(input.size ?? 6, 'size', 1, 128),
    velocity: bounded(input.velocity ?? 60, 'velocity', 0, 10000),
    velocityRange: bounded(input.velocityRange ?? 0, 'velocityRange', 0, 10000),
    angle: bounded(input.angle ?? -90, 'angle', -360, 360),
    spread: bounded(input.spread ?? 30, 'spread', 0, 360),
    gravity: bounded(input.gravity ?? 0, 'gravity', -10000, 10000),
    spin: bounded(input.spin ?? 0, 'spin', -3600, 3600),
    spinRange: bounded(input.spinRange ?? 0, 'spinRange', 0, 3600),
  }
}
export function createParticles(
  target: HTMLElement,
  input: WebParticleOptions,
  host: EffectHost,
): WebParticles {
  effectTarget(target, host)
  return start(target, settings(input, host, false), host, false)
}
export function createConfetti(
  target: HTMLElement,
  input: WebConfettiOptions,
  host: EffectHost,
): WebParticles {
  effectTarget(target, host)
  effectOptions(input, ['count', 'colors'])
  const count = bounded(input.count ?? 80, 'count', 0, 10000)
  if (!Number.isInteger(count)) throw new RangeError('Confetti count must be an integer.')
  return start(
    target,
    settings(
      {
        colors: input.colors ?? palette,
        shape: 'rectangle',
        rate: count * 5,
        duration: 200,
        lifetime: 2200,
        size: 8,
        velocity: 260,
        velocityRange: 100,
        angle: -90,
        spread: 100,
        gravity: 420,
        spinRange: 360,
      },
      host,
      true,
    ),
    host,
    true,
  )
}
function start(
  target: HTMLElement,
  options: Settings,
  host: EffectHost,
  burst: boolean,
): WebParticles {
  const view = effectTarget(target, host)
  const layer = decorativeLayer(target, burst ? 'confetti' : 'particles')
  const canvas = host.document.createElement('canvas')
  canvas.style.cssText = 'display:block;width:100%;height:100%;'
  layer.append(canvas)
  const context = canvas.getContext('2d')
  let loop: SurfaceLoop | undefined,
    ended = false,
    frames = 0
  let population: Particle[] = [],
    next = 0
  let resolve!: (completed: boolean) => void
  const finished = new Promise<boolean>((yes) => {
    resolve = yes
  })
  const off: (() => void)[] = []
  const cleanup = (completed = false) => {
    if (ended) return
    ended = true
    loop?.dispose()
    layer.remove()
    population = []
    for (const release of off.splice(0).reverse()) release()
    resolve(completed)
  }
  const handle = Object.defineProperties(
    Object.assign(() => cleanup(), {
      finished,
      stop: () => cleanup(),
      dispose: () => cleanup(),
      cancel: () => cleanup(),
      pause: () => loop?.pause(),
      play: () => loop?.play(),
      suspend: () => loop?.suspend(),
      resume: () => loop?.resume(),
      snapshot: () => ({
        backend: context ? ('canvas-2d' as const) : ('none' as const),
        particles: population.length,
        frames,
      }),
    }),
    {
      disposed: { get: () => ended },
      paused: { get: () => loop?.paused ?? false },
      suspended: { get: () => loop?.suspended ?? false },
    },
  ) as WebParticles
  try {
    off.push(
      effectOwnership(target, burst ? 'confetti' : 'particles', host, () => cleanup()),
    )
    if (!context || !options.rate || (burst && host.reduced())) {
      cleanup()
      return handle
    }
    const origin = target.getBoundingClientRect()
    if (burst) {
      layer.style.cssText += 'position:fixed;inset:0;border-radius:0;z-index:2147483647;'
      host.document.body.append(layer)
    } else {
      off.push(positioned(target))
      target.append(layer)
    }
    const timeScale = host.settings().timeScale
    const paint = (elapsed: number, reduced: boolean) => {
      const time = elapsed * timeScale
      const width = burst ? view.innerWidth : target.clientWidth
      const height = burst ? view.innerHeight : target.clientHeight
      const ratio = Math.min(
        view.devicePixelRatio || 1,
        2,
        Math.sqrt(4194304 / Math.max(1, width * height)),
      )
      const w = Math.max(1, Math.round(width * ratio)),
        h = Math.max(1, Math.round(height * ratio))
      if (canvas.width !== w) canvas.width = w
      if (canvas.height !== h) canvas.height = h
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      if (reduced) {
        population = []
        next = (time * options.rate) / 1000
        if (burst) cleanup()
        return
      }
      if (options.duration !== undefined && time >= options.duration + options.lifetime) {
        cleanup(true)
        return
      }
      population = population.filter((p) => time - p.born < options.lifetime)
      const last = Math.floor(
        (Math.min(time, options.duration ?? Infinity) * options.rate) / 1000,
      )
      next = Math.max(
        Math.ceil(next),
        Math.floor(((time - options.lifetime) * options.rate) / 1000),
        0,
      )
      // Skip expired births after a busy frame; never allocate an unbounded backlog.
      for (; next < last && population.length < 10000; next++) {
        const angle =
          ((options.angle + (Math.random() - 0.5) * options.spread) * Math.PI) / 180
        const speed = Math.max(
          0,
          options.velocity + (Math.random() - 0.5) * options.velocityRange,
        )
        population.push({
          born: ((next + 1) * 1000) / options.rate,
          x: burst
            ? origin.left + origin.width / 2
            : options.source === 'center'
              ? width / 2
              : Math.random() * width,
          y: burst
            ? origin.top + origin.height / 2
            : options.source === 'center'
              ? height / 2
              : options.source === 'bottom'
                ? height
                : 0,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          spin:
            ((options.spin + (Math.random() - 0.5) * options.spinRange) * Math.PI) / 180,
          color: options.colors[Math.floor(Math.random() * options.colors.length)]!,
        })
      }
      for (const p of population) {
        const age = Math.max(0, time - p.born) / 1000
        context.save()
        context.translate(
          p.x + p.vx * age,
          p.y + p.vy * age + (options.gravity * age * age) / 2,
        )
        context.rotate(p.spin * age)
        context.globalAlpha = options.fadeOut
          ? Math.max(0, 1 - (age * 1000) / options.lifetime)
          : 1
        context.fillStyle = context.strokeStyle = p.color
        const size = options.size
        if (options.shape === 'rectangle')
          context.fillRect(-size / 2, -size / 4, size, size / 2)
        else {
          context.beginPath()
          context.arc(0, 0, size / 2, 0, Math.PI * 2)
          if (options.shape === 'ring') {
            context.lineWidth = Math.max(1, size / 8)
            context.stroke()
          } else context.fill()
        }
        context.restore()
      }
      frames++
    }
    loop = new SurfaceLoop(target, host, paint, cleanup, () => layer.isConnected)
    loop.refresh()
    return handle
  } catch (error) {
    cleanup()
    throw error
  }
}
