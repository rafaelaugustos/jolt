export interface JoltConfig {
  /** Playback speed for every engine animation. `0.2` plays everything five times slower. */
  timeScale?: number
}

const settings: Required<JoltConfig> = { timeScale: 1 }

/**
 * Global settings, applied to animations that start after the call.
 *
 * ```ts
 * configure({ timeScale: 0.2 }) // tune a spring in slow motion
 * ```
 */
export function configure(options: JoltConfig): void {
  if (options === null || typeof options !== 'object')
    throw new TypeError('configure() takes an options object.')
  const { timeScale } = options
  if (timeScale !== undefined && (!Number.isFinite(timeScale) || timeScale <= 0))
    throw new RangeError(`Time scale must be a positive finite number, got ${timeScale}.`)
  if (timeScale !== undefined) settings.timeScale = timeScale
}

export function timeScale(): number {
  return settings.timeScale
}
