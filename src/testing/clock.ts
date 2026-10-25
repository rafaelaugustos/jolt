import type { View } from '@nativescript/core'
import type { Driver } from '../driver/index.js'
import type { Property } from '../properties.js'
import type { Track } from '../track.js'

interface Playback {
  view: View
  track: Track
  started: number
  offset: number
  held: boolean
  handle?: unknown
  end: (finished?: boolean) => void
  done: boolean
}

/** Isolated test clock. Optional native tracks are held and sought at the exact logical time. */
export class ReplayClock implements Driver {
  private time = 0
  private tracks = new Set<Playback>()
  private timers = new Set<{ at: number; callback(): void }>()
  private frames = new Set<() => void>()
  constructor(
    private native?: Driver,
    private reduced = false,
  ) {
    if (native && !native.control)
      throw new Error('Native replay requires a seekable driver.')
  }
  now = () => this.time
  get resources() {
    return this.tracks.size + this.timers.size + this.frames.size
  }
  frame(callback: () => void) {
    this.frames.add(callback)
    return () => {
      this.frames.delete(callback)
    }
  }
  after(ms: number, callback: () => void) {
    const timer = { at: this.time + ms, callback }
    this.timers.add(timer)
    return () => {
      this.timers.delete(timer)
    }
  }
  play(
    view: View,
    track: Track,
    started: number,
    end: (finished?: boolean) => void,
  ): Playback {
    const playback: Playback = {
      view,
      track,
      started,
      offset: 0,
      held: false,
      end,
      done: false,
    }
    if (this.native) {
      playback.handle = this.native.play(view, track, this.native.now(), () => {})
      this.native.control!(view, playback.handle, 0, true, 'pause')
    }
    this.tracks.add(playback)
    return playback
  }
  elapsed(handle: unknown) {
    const p = handle as Playback
    return p.offset + (p.held ? 0 : this.time - p.started)
  }
  control(_view: View, handle: unknown, elapsed: number, paused: boolean) {
    const p = handle as Playback
    p.offset = elapsed
    p.started = this.time
    p.held = paused
    this.native?.control!(p.view, p.handle, elapsed, true, 'seek')
  }
  stop(_view: View, handle: unknown) {
    this.finish(handle as Playback, false)
  }
  private finish(p: Playback, completed: boolean) {
    if (p.done) return
    p.done = true
    this.tracks.delete(p)
    if (this.native) this.native.stop(p.view, p.handle)
    p.end(completed)
  }
  presented(view: View, property: Property) {
    return this.native?.presented(view, property)
  }
  sync(view: View, excluding?: Property) {
    this.native?.sync?.(view, excluding)
  }
  reducedMotion() {
    return this.reduced
  }
  advanceTo(at: number) {
    if (!Number.isFinite(at) || at < this.time)
      throw new RangeError('Replay time must be finite and monotonic.')
    this.time = at
    // No interpolation of missing frames: callbacks see the original elapsed gap.
    for (const p of [...this.tracks]) {
      this.native?.control!(p.view, p.handle, this.elapsed(p), true, 'seek')
      if (!p.held && this.elapsed(p) >= p.track.end) this.finish(p, true)
    }
    for (const timer of [...this.timers]) {
      if (timer.at <= at && this.timers.delete(timer)) timer.callback()
    }
    const frames = [...this.frames]
    this.frames.clear()
    for (const callback of frames) callback()
  }
  dispose() {
    let error: unknown
    for (const p of [...this.tracks]) {
      try {
        this.finish(p, false)
      } catch (failure) {
        error ??= failure
      }
    }
    this.timers.clear()
    this.frames.clear()
    if (error) throw error
  }
}
