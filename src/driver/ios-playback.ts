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
    configure(animation: CAKeyframeAnimation, layer: CALayer) {
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
      // With speed 0, CA folds an exact duration boundary back to the first
      // frame. Hold the actual endpoint with a constant copy, also when a
      // shorter property waits at its end while another one is being scrubbed.
      if (paused && Number.isFinite(track.end) && position >= track.end) {
        const values = animation.values!
        const index = track.reverse && track.repeat % 2 === 1 ? 0 : values.count - 1
        const value = values.objectAtIndex(index)
        animation.values = NSArray.arrayWithArray([value, value])
        animation.keyTimes = NSArray.arrayWithArray([0, 1])
        animation.duration = 1
        animation.repeatCount = 0
        animation.autoreverses = false
        animation.timeOffset = 0
      }
    },
  }
}
