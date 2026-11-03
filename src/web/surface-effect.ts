import { createClock } from '../core/playback.js'
import { effectTarget, type EffectHost } from './effect.js'
import type { FrameTask } from './scheduler.js'

export function bounded(value: number, name: string, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new RangeError(`${name} must be within ${min}..${max}.`)
  return value
}

/** Continuous work uses the context's one clock, including hidden-time exclusion. */
export class SurfaceLoop {
  private clock
  private off: (() => void)[] = []
  private ended = false
  private held = false
  private task: FrameTask = {
    update: () => !this.ended && !this.held,
    write: () => this.draw(),
  }
  constructor(
    readonly target: HTMLElement,
    readonly host: EffectHost,
    private paint: (elapsed: number, reduced: boolean) => void,
    private cleanup: () => void,
    private valid: () => boolean = () => true,
  ) {
    const view = effectTarget(target, host)
    this.clock = createClock(() => host.scheduler.now())
    try {
      this.off.push(host.register(target, this, () => this.refresh()))
      this.off.push(
        host.onReduced(() => this.refresh()),
        host.visibility(() => this.refresh()),
      )
      const resize = new view.ResizeObserver(() => this.refresh())
      resize.observe(target)
      this.off.push(() => resize.disconnect())
    } catch (error) {
      this.dispose()
      throw error
    }
  }
  get disposed() {
    return this.ended
  }
  get paused() {
    return this.held
  }
  get suspended() {
    return this.held
  }
  time() {
    return this.clock.time()
  }
  refresh() {
    if (this.ended) return
    if (
      !this.target.isConnected ||
      this.target.ownerDocument !== this.host.document ||
      !this.valid()
    ) {
      this.dispose()
      return
    }
    this.host.scheduler.remove(this.task)
    const css = this.host.document.defaultView!.getComputedStyle(this.target)
    const idle =
      this.held ||
      this.host.document.hidden ||
      this.host.reduced() ||
      !this.target.getClientRects().length ||
      css.visibility !== 'visible'
    if (idle) this.clock.pause()
    else {
      this.clock.play()
      this.host.scheduler.add(this.task)
    }
    this.draw()
  }
  private draw() {
    if (this.ended) return
    if (
      !this.target.isConnected ||
      this.target.ownerDocument !== this.host.document ||
      !this.valid()
    ) {
      this.dispose()
      return
    }
    try {
      this.paint(this.time(), this.host.reduced())
    } catch (error) {
      this.dispose()
      throw error
    }
  }
  pause() {
    if (!this.ended) {
      this.held = true
      this.refresh()
    }
  }
  play() {
    if (!this.ended) {
      this.held = false
      this.refresh()
    }
  }
  suspend() {
    this.pause()
  }
  resume() {
    this.play()
  }
  cancel() {
    this.dispose()
  }
  stop() {
    this.dispose()
  }
  dispose() {
    if (this.ended) return
    this.ended = true
    this.clock.cancel()
    this.host.scheduler.remove(this.task)
    for (const off of this.off.splice(0).reverse()) off()
    this.cleanup()
    this.paint = () => {}
    this.cleanup = () => {}
    this.valid = () => false
  }
}
