import { timeScale, reducedMotion } from './config.js'
import { getDriver } from './driver/index.js'
import { motionScope } from './motion-scope.js'
import type { PlayableAnimation } from './sequence.js'
import {
  createTimelineCues,
  type TimelineCue,
  type TimelineCueOptions,
} from './core/timeline-cues.js'
export type {
  TimelineCue,
  TimelineCueOptions,
  CuedTimeline,
} from './core/timeline-cues.js'

/** Own a timeline and its named effects, scheduled from the same playback clock. */
export function withTimelineCues(
  animation: PlayableAnimation,
  cues: readonly TimelineCue[],
  options: TimelineCueOptions = {},
) {
  const driver = getDriver()
  return createTimelineCues(animation, cues, options, {
    timeScale: timeScale(),
    reduced: reducedMotion,
    after: (ms, callback) => driver.after(ms, callback),
    scope: motionScope,
  })
}
