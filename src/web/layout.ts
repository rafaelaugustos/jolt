import { layoutExit, exitBudget, type LayoutExit } from '../core/layout-exit.js'
import { captureDOMExit, watchDOMRemovals, type DOMExitCopy } from './layout-exit.js'
import type { Animation, PlaybackAnimation } from '../core/playback.js'
import type { FrameScheduler, FrameTask } from './scheduler.js'
import type { WebBinding } from './value.js'
import type { AnimateOptions, DistributiveOmit, SpringName, Values } from './types.js'
import { borderBox } from './style.js'
import { prepare } from './plan.js'

export type WebLayoutOptions = DistributiveOmit<
  AnimateOptions,
  'relative' | 'layer' | 'stagger' | 'repeat' | 'repeatType' | 'repeatDelay'
> & {
  size?: 'scale' | false
  enter?: boolean
  exit?: LayoutExit
  maxSnapshotPixels?: number
}
interface Snapshot {
  rect: DOMRect
  width: number
  height: number
}
export interface LayoutHost {
  scheduler: FrameScheduler
  reduced(): boolean
  preference(callback: () => void): () => void
  release(target: HTMLElement): void
  geometry(target: HTMLElement): WebBinding
  basis(target: HTMLElement): DOMMatrix
  scale(target: HTMLElement): { x: number; y: number }
  set(target: HTMLElement, values: Values): void
  animate(
    target: HTMLElement,
    values: Values,
    options: AnimateOptions | SpringName,
  ): PlaybackAnimation
  clear(target: HTMLElement): void
  forget(): void
}
export function validateLayout(change: unknown, options?: WebLayoutOptions | SpringName) {
  if (
    change !== undefined &&
    (typeof change !== 'function' || change.constructor.name === 'AsyncFunction')
  )
    throw new TypeError('A layout mutation must be synchronous.')
  const {
    size = 'scale',
    enter = true,
    exit: exitInput,
    maxSnapshotPixels,
    ...motion
  } = typeof options === 'object' ? options : {}
  if ((size !== 'scale' && size !== false) || typeof enter !== 'boolean')
    throw new TypeError('Invalid layout size/enter option.')
  if (
    typeof options === 'object' &&
    ['relative', 'layer', 'stagger', 'repeat', 'repeatType', 'repeatDelay'].some(
      (key) => key in options,
    )
  )
    throw new TypeError(
      'A layout change covers one layout pass; use playback timelines for repetition.',
    )
  const transition = typeof options === 'string' ? options : motion
  prepare({ x: [0, 1] }, transition, new Map(), 1)
  return {
    size,
    enter,
    transition,
    exit: layoutExit(exitInput),
    budget: exitBudget(maxSnapshotPixels),
  }
}
export class LayoutOperation implements Animation {
  readonly finished: Promise<boolean>
  private resolve!: (value: boolean) => void
  private reject!: (error: unknown) => void
  private ended = false
  private before = new Map<HTMLElement, Snapshot>()
  private leases = new Map<HTMLElement, WebBinding>()
  private targets = new Set<HTMLElement>()
  private exits = new Map<
    HTMLElement,
    { copy: DOMExitCopy; animation?: PlaybackAnimation }
  >()
  private stopRemovals?: () => void
  private stopPreference?: () => void
  private reinsert?: MutationObserver
  private pixels = 0
  private readonly hidden = () => {
    if (this.container.ownerDocument.hidden) this.stop()
  }
  private readonly resized = () => this.stop()
  private options: ReturnType<typeof validateLayout>
  private task: FrameTask = { read: () => this.run() }
  constructor(
    private container: HTMLElement,
    change: (() => void) | undefined,
    options: WebLayoutOptions | SpringName | undefined,
    private host: LayoutHost,
    previous?: LayoutOperation,
  ) {
    this.options = validateLayout(change, options)
    this.finished = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
    void this.finished.catch(() => {})
    for (const target of this.children()) {
      const snapshot = this.measure(target)
      if (snapshot) {
        // The previous FLIP may still be scaling a new layout box. Capture that
        // displayed size before retiring its private contribution.
        const scale =
          previous && !previous.ended ? previous.host.scale(target) : { x: 1, y: 1 }
        snapshot.width *= scale.x
        snapshot.height *= scale.y
        this.before.set(target, snapshot)
      }
    }
    previous?.stop()
    try {
      for (const target of this.before.keys())
        this.leases.set(target, host.geometry(target))
      if (this.options.exit && !host.reduced()) {
        this.stopRemovals = watchDOMRemovals(container, (target) =>
          this.captureExit(target),
        )
        const view = container.ownerDocument.defaultView! as Window & typeof globalThis
        this.reinsert = new view.MutationObserver(() => {
          for (const [target, exit] of this.exits)
            if (target.isConnected) this.dropExit(target, exit)
        })
        this.reinsert.observe(container.ownerDocument.documentElement, {
          childList: true,
          subtree: true,
        })
        this.stopPreference = host.preference(() => {
          if (host.reduced()) this.stop()
        })
        container.ownerDocument.addEventListener('visibilitychange', this.hidden)
        view.addEventListener('resize', this.resized)
      }
      const result = change?.() as unknown
      if (result && typeof (result as PromiseLike<unknown>).then === 'function')
        throw new TypeError('A layout mutation must not return a promise.')
      // A frame boundary admits framework microtasks, then measures before presentation.
      host.scheduler.add(this.task)
    } catch (error) {
      this.fail(error)
      throw error
    }
  }
  private captureExit(target: HTMLElement) {
    if (
      !this.before.has(target) ||
      this.exits.has(target) ||
      this.pixels >= this.options.budget
    )
      return
    const copy = captureDOMExit(target, this.options.budget - this.pixels)
    if (copy) {
      this.pixels += copy.pixels
      this.exits.set(target, { copy })
    }
  }
  private dropExit(
    target: HTMLElement,
    exit: { copy: DOMExitCopy; animation?: PlaybackAnimation },
  ) {
    this.exits.delete(target)
    exit.animation?.stop()
    this.host.release(exit.copy.element)
    exit.copy.dispose()
  }
  private children() {
    const view = this.container.ownerDocument.defaultView! as Window & typeof globalThis
    return [...this.container.children].filter(
      (child): child is HTMLElement => child instanceof view.HTMLElement,
    )
  }
  private measure(target: HTMLElement): Snapshot | undefined {
    const rect = target.getBoundingClientRect(),
      box = borderBox(target)
    if (!rect.width || !rect.height || !box.width || !box.height) return
    return { rect, ...box }
  }
  private run() {
    if (this.ended) return
    this.stopRemovals?.()
    this.stopRemovals = undefined
    if (!this.container.isConnected) {
      this.finish(false)
      return
    }
    try {
      const entries = this.children().map((target) => ({
        target,
        after: this.measure(target),
        before: this.before.get(target),
      }))
      const handles: PlaybackAnimation[] = []
      for (const [target, exit] of this.exits) {
        if (target.isConnected || this.host.reduced()) {
          this.dropExit(target, exit)
          continue
        }
        const motion = this.options.exit!
        exit.animation = this.host.animate(
          exit.copy.element,
          {
            x: motion.x,
            y: motion.y,
            scaleX: motion.scale,
            scaleY: motion.scale,
            opacity: motion.opacity,
          },
          this.options.transition,
        )
        handles.push(exit.animation)
      }
      for (const { target, after, before } of entries) {
        if (!after) continue
        if (!this.leases.has(target)) this.leases.set(target, this.host.geometry(target))
        if (!before) {
          if (this.options.enter) {
            this.targets.add(target)
            this.host.set(target, { opacity: 0 })
            handles.push(
              this.host.animate(target, { opacity: 1 }, this.options.transition),
            )
          }
          continue
        }
        const sx = this.options.size ? before.width / after.width : 1
        const sy = this.options.size ? before.height / after.height : 1
        this.targets.add(target)
        this.host.set(target, { x: 0, y: 0, scaleX: sx, scaleY: sy })
        // Measure the scaled pose at its actual CSS origin. This accounts for
        // application rotation/scale and noncentral pivots without guessing matrices.
        const posed = target.getBoundingClientRect()
        const dx = (before.rect.left + before.rect.right - posed.left - posed.right) / 2
        const dy = (before.rect.top + before.rect.bottom - posed.top - posed.bottom) / 2
        const inverse = this.host.basis(target).inverse()
        const x = inverse.a * dx + inverse.c * dy,
          y = inverse.b * dx + inverse.d * dy
        if (![x, y, sx, sy].every(Number.isFinite))
          throw new Error('Layout inversion requires an invertible transform.')
        this.host.set(target, { x, y, scaleX: sx, scaleY: sy })
        handles.push(
          this.host.animate(
            target,
            { x: 0, y: 0, scaleX: 1, scaleY: 1 },
            this.options.transition,
          ),
        )
      }
      void Promise.all(handles.map((handle) => handle.finished)).then(
        (results) => this.finish(results.every(Boolean)),
        (error) => this.fail(error),
      )
    } catch (error) {
      this.fail(error)
    }
  }
  private cleanup() {
    this.stopRemovals?.()
    this.stopRemovals = undefined
    this.stopPreference?.()
    this.stopPreference = undefined
    this.reinsert?.disconnect()
    this.reinsert = undefined
    this.container.ownerDocument.removeEventListener('visibilitychange', this.hidden)
    this.container.ownerDocument.defaultView?.removeEventListener('resize', this.resized)
    for (const [target, exit] of this.exits) this.dropExit(target, exit)
    this.host.scheduler.remove(this.task)
    for (const target of this.targets) this.host.clear(target)
    this.targets.clear()
    for (const lease of this.leases.values()) lease.dispose()
    this.leases.clear()
    this.before.clear()
    this.host.forget()
    this.host = undefined!
    this.container = undefined!
  }
  private finish(result: boolean) {
    if (this.ended) return
    this.ended = true
    this.cleanup()
    this.resolve(result)
  }
  private fail(error: unknown) {
    if (this.ended) return
    this.ended = true
    this.cleanup()
    this.reject(error)
  }
  stop() {
    this.finish(false)
  }
  then<A = boolean, B = never>(
    yes?: ((value: boolean) => A | PromiseLike<A>) | null,
    no?: ((error: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.finished.then(yes, no)
  }
}
