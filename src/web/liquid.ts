import { liquidGrid } from '../core/liquid-grid.js'
import { effectOptions, effectOwnership, type EffectHost } from './effect.js'
import { bounded, SurfaceLoop } from './surface-effect.js'
import {
  DisplacementMap,
  ImageSurface,
  imageFallback,
  imageTarget,
} from './image-surface.js'

export interface WebLiquidOptions {
  intensity?: number
  duration?: number
}
export interface WebLiquid {
  readonly disposed: boolean
  readonly paused: boolean
  readonly suspended: boolean
  readonly diagnostics: {
    backend: 'svg-filter' | 'none'
    reason?: string
    frames: number
  }
  pause(): void
  play(): void
  suspend(): void
  resume(): void
  stop(): void
  cancel(): void
  dispose(): void
}
export function createLiquid(
  target: HTMLImageElement,
  options: WebLiquidOptions,
  host: EffectHost,
): WebLiquid {
  imageTarget(target, host)
  effectOptions(options, ['intensity', 'duration'])
  const intensity = bounded(options.intensity ?? 0.7, 'intensity', 0, 1)
  const duration = Math.max(
    Number.MIN_VALUE,
    bounded(options.duration ?? 8000, 'duration', Number.MIN_VALUE, Number.MAX_VALUE) /
      host.settings().timeScale,
  )
  let reason = imageFallback(target, host)
  let surface: ImageSurface | undefined,
    loop: SurfaceLoop | undefined,
    ended = false
  const stop = () => {
    if (ended) return
    ended = true
    loop?.dispose()
    surface?.dispose()
  }
  const handle: WebLiquid = {
    get disposed() {
      return ended
    },
    get paused() {
      return loop?.paused ?? false
    },
    get suspended() {
      return loop?.paused ?? false
    },
    get diagnostics() {
      return {
        backend: surface ? ('svg-filter' as const) : ('none' as const),
        reason,
        frames: surface?.frames ?? 0,
      }
    },
    pause: () => loop?.pause(),
    play: () => loop?.play(),
    suspend: () => loop?.pause(),
    resume: () => loop?.play(),
    stop,
    cancel: stop,
    dispose: stop,
  }
  if (reason || !intensity) {
    effectOwnership(target, 'filter', host, stop)()
    stop()
    return handle
  }
  try {
    surface = new ImageSurface(target, host, stop)
    const map = new DisplacementMap(surface)
    loop = new SurfaceLoop(
      target,
      host,
      (time, reduced) => {
        const grid = liquidGrid(
          map.size - 1,
          map.size - 1,
          (time % duration) / duration,
          intensity,
        )
        map.paint(
          (x, y, index) => [x - grid[index * 2]!, y - grid[index * 2 + 1]!],
          !reduced,
        )
      },
      stop,
      () => surface!.valid() && !imageFallback(target, host),
    )
    loop.refresh()
    return handle
  } catch (error) {
    stop()
    throw error
  }
}
