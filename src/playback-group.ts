import { arrivalOf, setArrival, type ViewAnimation } from './engine.js'
import { getDriver } from './driver/index.js'
import { createClock, type PlaybackClock } from './playback.js'
import { validateProgress, type PlaybackAnimation } from './playback.js'

/** Staggered views share a finite time range. Shorter children remain seekable
 * until the whole group settles, unless another animation has taken ownership. */
export function playbackGroup(children: readonly ViewAnimation[]): PlaybackAnimation {
  let paused = false
  let settled = false
  let finalProgress: number | undefined
  let clock: PlaybackClock | undefined
  let pendingProgress: number | undefined
  const duration = () => Math.max(0, ...children.map((child) => child.duration))
  const ensureClock = () => {
    if (clock || settled || children.some((child) => !child.ready)) return
    const driver = getDriver()
    clock = driver.clock?.(duration()) ?? createClock(() => driver.now())
    clock.seek(Math.max(0, ...children.map((child) => child.currentTime)))
    if (paused) clock.pause()
  }
  const finishIfIdle = () => {
    if (settled || paused || children.some((child) => !child.idle || child.paused)) return
    settled = true
    clock?.cancel()
    for (const child of children) child.releaseGroup()
  }
  const seek = (value: number) => {
    const total = duration()
    validateProgress(value, total)
    if (settled) return
    if (children.some((child) => !child.ready)) {
      pendingProgress = value
      return
    }
    pendingProgress = undefined
    ensureClock()
    clock?.seek(total * value)
    for (const child of children) child.seekTime(total * value)
    finishIfIdle()
  }
  for (const child of children) {
    child.onIdle(finishIfIdle)
    child.onReady(() => {
      ensureClock()
      if (pendingProgress !== undefined && children.every((child) => child.ready))
        seek(pendingProgress)
      finishIfIdle()
    })
  }
  const finished = Promise.all(children.map((child) => child.finished)).then(
    (results) => {
      finalProgress ??= results.every(Boolean)
        ? 1
        : duration()
          ? Math.min(1, (clock?.time() ?? 0) / duration())
          : 0
      settled = true
      clock?.cancel()
      return results.every(Boolean)
    },
  )
  const animation: PlaybackAnimation = {
    finished,
    get duration() {
      return duration()
    },
    get paused() {
      return paused
    },
    get progress() {
      if (!Number.isFinite(duration()))
        throw new RangeError('Progress requires a finite animation.')
      if (pendingProgress !== undefined) return pendingProgress
      return (
        finalProgress ??
        (settled ? 1 : duration() ? Math.min(1, (clock?.time() ?? 0) / duration()) : 0)
      )
    },
    set progress(value) {
      seek(value)
    },
    pause() {
      if (!settled && !paused) {
        paused = true
        clock?.pause()
        children.forEach((child) => child.pause())
      }
    },
    play() {
      if (!settled && paused) {
        paused = false
        clock?.play()
        children.forEach((child) => child.play())
        finishIfIdle()
      }
    },
    stop() {
      finalProgress = duration() ? Math.min(1, (clock?.time() ?? 0) / duration()) : 0
      settled = true
      clock?.cancel()
      children.forEach((child) => child.stop())
    },
    then: (onfulfilled, onrejected) => finished.then(onfulfilled, onrejected),
  }
  setArrival(animation, Promise.all(children.map(arrivalOf)))
  ensureClock()
  finishIfIdle()
  return animation
}
