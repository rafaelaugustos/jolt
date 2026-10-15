import { Application, type View } from '@nativescript/core'
import { animate, type Animation } from '@rafaelaugusto/jolt'
import { busyWork, WORK_MS } from './busy-work'

export type BusyMode = 'idle' | 'main' | 'worker'
export const TRIAL_MS = 1800
const WORK_DELAY = 400
const now = () => android.os.SystemClock.uptimeMillis()
type NativeView = android.view.View
type WorkResult = ReturnType<typeof busyWork> & { threadId: number }

/** Diagnostic only. Neither the probes nor the worker drive animation frames. */
export class BusyTrial {
  private abort: (() => void) | undefined
  private disposed = false

  constructor(private readonly views: { jolt: View; layered: View; reveal: View }) {
    for (const view of Object.values(views)) view.on('unloaded', this.stop)
    Application.on(Application.suspendEvent, this.stop)
  }

  stop = () => this.abort?.()

  dispose() {
    this.stop()
    this.disposed = true
    for (const view of Object.values(this.views)) view.off('unloaded', this.stop)
    Application.off(Application.suspendEvent, this.stop)
  }

  async run(mode: BusyMode, playing?: () => void) {
    if (this.disposed || this.abort)
      throw new Error('Trial unavailable or already running.')
    const native = Object.fromEntries(
      Object.entries(this.views).map(([key, view]) => {
        if (!view.isLoaded || !view.nativeViewProtected?.isAttachedToWindow())
          throw new Error('Load the demo views before running.')
        return [key, view.nativeViewProtected as NativeView]
      }),
    ) as Record<keyof typeof this.views, NativeView>
    if (!native.jolt.isHardwareAccelerated())
      throw new Error('Enable hardware acceleration.')
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          timers.delete(timer)
          resolve()
        }, ms)
        timers.add(timer)
      })
    let reject!: (error: Error) => void
    const cancelled = new Promise<never>((_, failure) => {
      reject = failure
    })
    this.abort = () => reject(new Error('Trial cancelled.'))
    const race = <T>(promise: Promise<T>) => Promise.race([promise, cancelled])
    let worker: Worker | undefined
    let animation: Animation | undefined
    let property: android.view.ViewPropertyAnimator | undefined
    let reveal: android.animation.Animator | undefined
    let workerMessage: ((message: { type: string } & WorkResult) => void) | undefined
    const mainThreadId = android.os.Process.myTid()
    const read = () => ({
      jolt: native.jolt.getRotation(),
      withLayer: native.layered.getRotation(),
      layer: native.layered.getLayerType(),
    })
    try {
      if (mode === 'worker') {
        const ready = new Promise<void>((resolve, failure) => {
          worker = new Worker('./workers/busy.worker')
          worker.onmessage = (event) => {
            const message = event.data as { type: string } & WorkResult
            if (message.type === 'ready') resolve()
            else workerMessage?.(message)
          }
          worker.onerror = (event) => {
            failure(new Error(event.message))
            reject(new Error(event.message))
            return true
          }
        })
        // Exclude worker startup from the playback measurement.
        await race(
          Promise.race([
            ready,
            wait(5000).then(() => {
              throw new Error('Worker did not start.')
            }),
          ]),
        )
      }
      this.views.jolt.rotate = 0
      this.views.layered.rotate = 0
      native.layered.setRotation(0)
      const originalLayer = native.layered.getLayerType()
      const startedAt = now()
      const complete = (
        animator: android.animation.Animator | android.view.ViewPropertyAnimator,
      ) =>
        new Promise<boolean>((resolve) => {
          let interrupted = false
          const listener = new android.animation.Animator.AnimatorListener({
            onAnimationStart() {},
            onAnimationRepeat() {},
            onAnimationCancel() {
              interrupted = true
            },
            onAnimationEnd() {
              resolve(!interrupted)
            },
          })
          if (animator instanceof android.view.ViewPropertyAnimator)
            animator.setListener(listener)
          else animator.addListener(listener)
        })
      property = native.layered
        .animate()
        .rotation(360)
        .setDuration(TRIAL_MS)
        .setStartDelay(0)
        .setInterpolator(new android.view.animation.LinearInterpolator())
        .withLayer()
      const propertyDone = complete(property)
      const width = native.reveal.getWidth(),
        height = native.reveal.getHeight()
      if (!width || !height) throw new Error('Wait for measured bounds.')
      reveal = android.view.ViewAnimationUtils.createCircularReveal(
        native.reveal,
        Math.round(width / 2),
        Math.round(height / 2),
        0,
        Math.hypot(width, height) / 2,
      )
      reveal.setDuration(TRIAL_MS)
      reveal.setInterpolator(new android.view.animation.LinearInterpolator())
      const revealDone = complete(reveal)
      animation = animate(this.views.jolt, 'spin', { duration: TRIAL_MS, ease: 'linear' })
      property.start()
      reveal.start()
      playing?.()
      await race(wait(WORK_DELAY))
      const beforeWork = read()
      const workStartedAt = now()
      let work: WorkResult
      if (mode === 'main') work = { ...busyWork(), threadId: mainThreadId }
      else if (mode === 'worker') {
        const done = new Promise<WorkResult>((resolve) => {
          workerMessage = (message) => {
            if (message.type === 'done') resolve(message)
          }
        })
        worker!.postMessage('work')
        work = await race(
          Promise.race([
            done,
            wait(5000).then(() => {
              throw new Error('Worker did not finish.')
            }),
          ]),
        )
      } else {
        await race(wait(WORK_MS))
        work = { elapsedMs: now() - workStartedAt, checksum: 0, threadId: mainThreadId }
      }
      const workReturnedAt = now()
      const afterWork = read()
      const results = await race(
        Promise.all([animation.finished, propertyDone, revealDone]),
      )
      if (!results.every(Boolean)) throw new Error('Animation interrupted.')
      if (native.layered.getLayerType() !== originalLayer)
        throw new Error('withLayer did not restore the original layer.')
      return {
        mode,
        startedAt,
        completedAt: now(),
        mainThreadId,
        workStartedAt,
        workReturnedAt,
        work,
        beforeWork,
        afterWork,
        layerAfter: native.layered.getLayerType(),
      }
    } finally {
      this.abort = undefined
      for (const timer of timers) clearTimeout(timer)
      worker?.terminate()
      animation?.stop()
      property?.cancel()
      property?.setListener(null)
      reveal?.cancel()
      reveal?.removeAllListeners()
    }
  }
}
