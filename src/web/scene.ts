import type { Keyframes, AnimateOptions, SpringName } from './types.js'
import type { WebMotionValue } from './value.js'

interface Timing {
  at?: number
  transition?: AnimateOptions | SpringName
  layer?: string
}
export type WebSeekableStep =
  | (Timing & { target: HTMLElement; keyframes: Keyframes })
  | (Timing & { value: WebMotionValue; keyframes: readonly number[] })
  | { at?: number; steps: readonly WebSeekableStep[] }
export interface WebSceneOptions {
  paused?: boolean
}
export type SceneLeaf = Exclude<
  WebSeekableStep,
  { steps: readonly WebSeekableStep[] }
> & { at: number }
export function sceneSteps(
  steps: readonly WebSeekableStep[],
  options: WebSceneOptions,
): SceneLeaf[] {
  if (
    !options ||
    typeof options !== 'object' ||
    Object.keys(options).some((k) => k !== 'paused') ||
    (options.paused !== undefined && typeof options.paused !== 'boolean')
  )
    throw new TypeError('Invalid seekable scene options.')
  const result: SceneLeaf[] = []
  const visit = (entries: readonly WebSeekableStep[], start: number, depth: number) => {
    if (!Array.isArray(entries) || depth > 16)
      throw new TypeError('Scene descriptors need arrays nested at most 16 levels.')
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        throw new TypeError(
          'Scenes require declarative tracks, not callbacks or handles.',
        )
      const at = entry.at ?? 0
      if (typeof at !== 'number' || !Number.isFinite(at) || at < 0)
        throw new RangeError('Scene offsets must be nonnegative milliseconds.')
      if ('steps' in entry) {
        if (Object.keys(entry).some((k) => !['at', 'steps'].includes(k)))
          throw new TypeError('Invalid nested scene descriptor.')
        visit(entry.steps, start + at, depth + 1)
      } else {
        if (
          Object.keys(entry).some(
            (k) =>
              !['at', 'target', 'value', 'keyframes', 'transition', 'layer'].includes(k),
          ) ||
          'target' in entry === 'value' in entry
        )
          throw new TypeError('A scene track needs one target or numeric motion value.')
        const hasPath = 'target' in entry && entry.keyframes?.path !== undefined
        const frames =
          'value' in entry
            ? [entry.keyframes]
            : Object.entries(entry.keyframes ?? {})
                .filter(([key]) => key !== 'path' && key !== 'orient')
                .map(([, value]) => value)
        if (
          (!frames.length && !hasPath) ||
          frames.some(
            (v) =>
              !Array.isArray(v) ||
              v.length < 2 ||
              v.some((x) => x === null || x === undefined),
          )
        )
          throw new TypeError('Scene tracks need explicit endpoint arrays.')
        if ('value' in entry && entry.layer !== undefined)
          throw new TypeError('Numeric scene values do not have view layers.')
        result.push({ ...entry, at: start + at })
      }
    }
  }
  visit(steps, 0, 0)
  return result
}
