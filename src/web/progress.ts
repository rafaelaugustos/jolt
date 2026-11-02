import { playbackSource, type Animation, type PlaybackState } from '../core/playback.js'
import { NumericValue } from './value.js'
import type { FrameScheduler, FrameTask } from './scheduler.js'

/** A demand-driven observer of an existing clock, never an independent animation. */
export class ProgressNode extends NumericValue {
  private source: ReturnType<typeof playbackSource>
  private off: () => void
  private task: FrameTask = {
    update: () => {
      this.refresh()
      return this.demanded && this.moving
    },
  }
  constructor(
    animation: Animation,
    scheduler: FrameScheduler,
    report: (error: unknown) => void,
    forget: () => void,
  ) {
    const source = playbackSource(animation),
      state = source.read()
    if (!Number.isFinite(state.duration))
      throw new RangeError('Progress requires a known finite animation duration.')
    super(scheduler, position(state), report, forget)
    this.source = source
    this.off = source.subscribe(() => {
      this.refresh()
      this.demandChanged()
    })
    if (state.settled) this.off()
  }
  override get() {
    return this.ended ? this.position : position(this.source.read())
  }
  override getVelocity() {
    const s = this.source.read()
    return !this.ended && this.moving && s.duration > 0 ? 1000 / s.duration : 0
  }
  override get moving() {
    if (this.ended) return false
    const s = this.source.read()
    return s.ready && !s.settled && !s.paused && s.duration > 0
  }
  private refresh() {
    if (this.ended) return
    this.publish(this.get(), this.getVelocity())
    if (this.source.read().settled) this.off()
  }
  protected override demandChanged() {
    if (!this.ended && this.demanded && this.moving) this.scheduler.add(this.task)
    else this.scheduler.remove(this.task)
  }
  override dispose() {
    if (this.ended) return
    this.position = this.get()
    this.off()
    this.scheduler.remove(this.task)
    super.dispose()
  }
}
function position(state: PlaybackState) {
  return (
    state.position ??
    (state.completed
      ? 1
      : state.duration > 0
        ? Math.max(0, Math.min(1, state.time / state.duration))
        : 0)
  )
}
