import { getDriver } from './driver/index.js'

export interface JoltConfig {
  /** Playback speed for every engine animation. `0.2` plays everything five times slower. */
  timeScale?: number
  /**
   * When transforms, paths, decorations and decay jump to their end instead of animating.
   * `user` follows the platform setting. Opacity and colors still animate.
   */
  reducedMotion?: 'user' | 'always' | 'never'
}

const settings: Required<JoltConfig> = { timeScale: 1, reducedMotion: 'user' }
const listeners = new Set<(reduced: boolean) => void>()
let reported = false
let unwatch: (() => void) | undefined
const preferences: readonly JoltConfig['reducedMotion'][] = ['user', 'always', 'never']

/**
 * Global settings, applied to animations that start after the call.
 *
 * ```ts
 * configure({ timeScale: 0.2 }) // tune a spring in slow motion
 * configure({ reducedMotion: 'always' }) // check the reduced layout
 * ```
 */
export function configure(options: JoltConfig): void {
  if (options === null || typeof options !== 'object')
    throw new TypeError('configure() takes an options object.')
  const { timeScale, reducedMotion } = options
  if (timeScale !== undefined && (!Number.isFinite(timeScale) || timeScale <= 0))
    throw new RangeError(`Time scale must be a positive finite number, got ${timeScale}.`)
  if (reducedMotion !== undefined && !preferences.includes(reducedMotion))
    throw new TypeError(
      `Reduced motion must be 'user', 'always' or 'never', got ${String(reducedMotion)}.`,
    )
  if (timeScale !== undefined) settings.timeScale = timeScale
  if (reducedMotion !== undefined) {
    settings.reducedMotion = reducedMotion
    changed()
  }
}

export function timeScale(): number {
  return settings.timeScale
}

/** Whether motion is reduced right now. `user` asks the platform each time. */
export function reducedMotion(): boolean {
  if (settings.reducedMotion === 'user') return getDriver().reducedMotion?.() ?? false
  return settings.reducedMotion === 'always'
}

/**
 * Calls back with the new value whenever `reducedMotion()` changes, from `configure()`
 * or the platform setting. Returns a cleanup function.
 *
 * ```ts
 * const off = onReducedMotion((reduced) => (illustration.visibility = reduced ? 'visible' : 'collapse'))
 * ```
 */
export function onReducedMotion(callback: (reduced: boolean) => void): () => void {
  if (typeof callback !== 'function')
    throw new TypeError('onReducedMotion() takes a callback.')
  const listener = (reduced: boolean) => callback(reduced)
  if (listeners.size === 0) {
    reported = reducedMotion()
    unwatch = getDriver().watchReducedMotion?.(changed)
  }
  listeners.add(listener)
  return () => {
    if (!listeners.delete(listener) || listeners.size > 0) return
    unwatch?.()
    unwatch = undefined
  }
}

function changed() {
  if (listeners.size === 0) return
  const reduced = reducedMotion()
  if (reduced === reported) return
  reported = reduced
  for (const listener of [...listeners]) listener(reduced)
}
