import { isIOS, type View } from '@nativescript/core'
import { capture, type Flight } from './shared-layout/native.js'
import { createTrack } from './track.js'
import { resolveTransition, type Transition } from './transition.js'
import { type ResolvedLayoutExit } from './core/layout-exit.js'
import type { Animation } from './engine.js'

export interface ExitCapture {
  pixels(): number
  play(exit: ResolvedLayoutExit, transition: Transition): Animation
  dispose(): void
}
let factory: ((view: View, budget: number) => Flight | undefined) | undefined
/** Test adapter; production uses the same bounded native snapshot implementation as shared transitions. */
export function setExitCaptureDriver(value?: typeof factory) {
  factory = value
}
export function requireExitCapture() {
  if (factory) return
  if (
    isIOS
      ? typeof JoltSharedLayoutFlight === 'undefined'
      : typeof org === 'undefined' ||
        typeof org.rafaelaugusto?.jolt?.SharedLayoutFlight !== 'function'
  )
    throw new Error('Layout exits need rebuilt Jolt native classes.')
}
const leaving = new WeakMap<View, ExitCapture>()
export function captureExit(view: View, budget: number): ExitCapture | undefined {
  leaving.get(view)?.dispose()
  const flight = factory
    ? factory(view, budget)
    : capture(
        view,
        true,
        typeof view.borderRadius === 'number' ? view.borderRadius : 0,
        budget,
      )
  if (!flight) return
  flight.prepareExit?.()
  let ended = false,
    settle: ((finished: boolean) => void) | undefined
  const dispose = () => {
    if (ended) return
    ended = true
    view.off('loaded', dispose)
    flight.dispose()
    settle?.(false)
    if (leaving.get(view) === result) leaving.delete(view)
  }
  const result: ExitCapture = {
    pixels: () => flight.pixels(),
    dispose,
    play(exit, transition) {
      let resolve!: (finished: boolean) => void
      const finished = new Promise<boolean>((done) => (resolve = done))
      settle = resolve
      const handle = { finished, stop: dispose, then: finished.then.bind(finished) }
      if (ended) {
        resolve(false)
        return handle
      }
      const { pose } = JSON.parse(flight.state()) as { pose: number[] }
      const target = [
        pose[0]! + exit.x + (pose[2]! * (1 - exit.scale)) / 2,
        pose[1]! + exit.y + (pose[3]! * (1 - exit.scale)) / 2,
        pose[2]! * exit.scale,
        pose[3]! * exit.scale,
        pose[4]! * exit.scale,
        1 - exit.opacity,
      ]
      const tracks = target.map((value, i) => {
        const property = i === 5 ? 'opacity' : 'x'
        const track = createTrack(
          property,
          [pose[i] ?? 0, value],
          resolveTransition(transition, property, 2),
          0,
        )
        if (!Number.isFinite(track.end) || track.end > 30000)
          throw new RangeError('Layout exits must finish within 30 seconds.')
        const times = track.times.map((t) => track.delay + t * track.duration),
          values = [...track.values]
        if (track.delay) {
          times.unshift(0)
          values.unshift(values[0]!)
        }
        return { times, values }
      })
      flight.play(JSON.stringify({ tracks }), (completed) => {
        settle = undefined
        dispose()
        resolve(completed)
      })
      return handle
    },
  }
  view.on('loaded', dispose)
  leaving.set(view, result)
  return result
}

/** Scoped to this host and layout pass. Capture immediately before Core unloads/tears down a removed view. */
export function watchRemovals(host: View, remove: (view: View) => void) {
  const target = host as View & { _removeView(view: View): void }
  const original = target._removeView,
    descriptor = Object.getOwnPropertyDescriptor(target, '_removeView')
  if (typeof original !== 'function')
    throw new TypeError('Exit animations need a NativeScript layout container.')
  const intercept = function (this: typeof target, view: View) {
    remove(view)
    return original.call(this, view)
  }
  target._removeView = intercept
  return () => {
    if (target._removeView !== intercept) return
    if (descriptor) Object.defineProperty(target, '_removeView', descriptor)
    else delete (target as Partial<typeof target>)._removeView
  }
}
