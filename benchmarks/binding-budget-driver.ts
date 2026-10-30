import { getDriver, setDriver, type Driver } from '../dist/driver/index.js'

/** Opt-in bookkeeping, measured separately from unwrapped preparation samples. */
export function instrumentBudgetDriver() {
  const base = getDriver()
  const active = new Set<unknown>()
  const frames = new Set<object>()
  const timers = new Set<object>()
  const plays: {
    atMs: number
    costMs: number
    property: string
    values: number
    times: number
    durationMs: number
    repeat: number | 'infinite'
  }[] = []
  const timerWork: { atMs: number; requestedMs: number; costMs: number }[] = []
  const endWork: { atMs: number; property: string; costMs: number }[] = []
  let frameCallbacks = 0,
    frameRequests = 0,
    overflow = 0
  const wrapper: Driver = {
    ...base,
    play(view, track, startedAt, onEnd) {
      const start = base.now()
      let handle: unknown,
        ended = false
      handle = base.play(view, track, startedAt, (finished) => {
        ended = true
        active.delete(handle)
        const start = base.now()
        onEnd(finished)
        if (endWork.length < 20000)
          endWork.push({
            atMs: start,
            property: track.property,
            costMs: base.now() - start,
          })
        else overflow++
      })
      if (!ended) active.add(handle)
      if (plays.length < 20000)
        plays.push({
          atMs: start,
          costMs: base.now() - start,
          property: track.property,
          values: track.values.length,
          times: track.times.length,
          durationMs: track.duration,
          repeat: Number.isFinite(track.repeat) ? track.repeat : 'infinite',
        })
      else overflow++
      return handle
    },
    stop(view, handle) {
      active.delete(handle)
      base.stop(view, handle)
    },
    frame(callback) {
      const key = {}
      frames.add(key)
      frameRequests++
      const cancel = base.frame(() => {
        frames.delete(key)
        frameCallbacks++
        callback()
      })
      return () => {
        frames.delete(key)
        cancel()
      }
    },
    after(ms, callback) {
      const key = {}
      timers.add(key)
      const cancel = base.after(ms, () => {
        timers.delete(key)
        const start = base.now()
        callback()
        if (timerWork.length < 20000)
          timerWork.push({ atMs: start, requestedMs: ms, costMs: base.now() - start })
        else overflow++
      })
      return () => {
        timers.delete(key)
        cancel()
      }
    },
  }
  setDriver(wrapper)
  return {
    snapshot: () => ({
      atMs: base.now(),
      activeTracks: active.size,
      pendingFrames: frames.size,
      pendingTimers: timers.size,
      frameRequests,
      frameCallbacks,
      plays: plays.length,
      timerCallbacks: timerWork.length,
      endCallbacks: endWork.length,
      overflow,
    }),
    evidence: () => ({ plays, timerWork, endWork }),
    restore() {
      if (getDriver() === wrapper) setDriver(base)
    },
  }
}
