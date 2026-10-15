import type { Track } from '../track.js'

/** Each CAAnimation owns its clock; the view and its children keep their speed. */
export function iosPlayback(track: Track, startedAt: number) {
  let anchor = startedAt
  let offset = 0
  let paused = false
  let controlled = false
  const elapsed = () => offset + (paused ? 0 : CACurrentMediaTime() * 1000 - anchor)
  return {
    elapsed,
    get controlled() {
      return controlled
    },
    get paused() {
      return paused
    },
    control(time: number, hold: boolean) {
      controlled = true
      offset = time
      anchor = CACurrentMediaTime() * 1000
      paused = hold
    },
    configure(animation: CAAnimation, layer: CALayer) {
      const now = CACurrentMediaTime()
      const position = elapsed()
      animation.speed = paused ? 0 : 1
      animation.timeOffset = paused ? Math.max(0, position - track.delay) / 1000 : 0
      animation.beginTime = layer.convertTimeFromLayer(
        paused ? now : now - position / 1000 + track.delay / 1000,
        null,
      )
      animation.fillMode = paused ? 'both' : kCAFillModeBackwards
      animation.removedOnCompletion = !paused && track.repeat !== Infinity
    },
  }
}
