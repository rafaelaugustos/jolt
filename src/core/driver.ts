import type { PlaybackClock, PlaybackCommand } from './playback.js'
import type { Property } from './properties.js'
import type { Track } from './track.js'

export interface LayoutFrame {
  x: number
  y: number
  width: number
  height: number
}

export interface Driver<Target> {
  /** Milliseconds, on the clock the platform's animations run on. */
  now(): number
  /** One platform animation frame; returns an idempotent cancellation function. */
  frame(callback: () => void): () => void
  /** Starts the track at `startedAt + track.delay` and calls `onEnd` once, however it ends. */
  play(
    view: Target,
    track: Track,
    startedAt: number,
    onEnd: (finished?: boolean) => void,
  ): unknown
  stop(view: Target, handle: unknown): void
  /** A platform elapsed-time marker when system animation speed affects time. */
  clock?(duration: number): PlaybackClock
  /** Move only this track to an elapsed time, optionally holding it. */
  control?(
    view: Target,
    handle: unknown,
    elapsed: number,
    paused: boolean,
    command?: PlaybackCommand,
  ): void
  /** Reapply presentation after a model write rebuilds platform drawing state. */
  sync?(view: Target, excluding?: Property): void
  /** Track time, including its delay, when the platform clock differs from `now()`. */
  elapsed?(handle: unknown): number
  /** The value on screen, when the platform knows it better than the track does. */
  presented(view: Target, property: Property): number | undefined
  /** Calls back after `ms` of animation time, respecting platform speed settings. */
  after(ms: number, callback: () => void): () => void
  /** Untransformed layout bounds in the driver's logical coordinate units. */
  layoutFrame?(view: Target): LayoutFrame | undefined
  /** One callback after layout, before drawing; caller requests layout and owns cancellation. */
  afterLayout?(view: Target, callback: () => void): () => void
  /** The platform's accessibility preference for reduced motion. */
  reducedMotion?(): boolean
  /** Calls back when that setting may have changed; returns a cleanup function. */
  watchReducedMotion?(callback: () => void): () => void
}
