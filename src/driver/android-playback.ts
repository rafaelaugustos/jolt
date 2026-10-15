import type { Track } from '../track.js'
import type { PlaybackClock, PlaybackCommand } from '../playback.js'

export interface AndroidPlayback {
  cancel(): void
  elapsed(): number
  control(elapsed: number, paused: boolean, command?: PlaybackCommand): void
}

/** Reuse native keyframes when seeking, including rewinding into a start delay. */
export function androidPlayback(
  animator: android.animation.ValueAnimator,
  track: Track,
  onEnd: () => void,
  onStart?: () => void,
  onRelease?: () => void,
): AndroidPlayback {
  let suppressed = false
  let stopped = false
  let started = false
  let acquired = false
  let origin = 0
  let delay = track.delay
  let held: number | undefined
  animator.addListener(
    new android.animation.Animator.AnimatorListener({
      onAnimationStart() {
        if (!suppressed && !stopped) {
          started = true
          if (!acquired) {
            acquired = true
            onStart?.()
          }
        }
      },
      onAnimationRepeat() {},
      onAnimationCancel() {
        if (!suppressed && !stopped) onRelease?.()
      },
      onAnimationEnd() {
        if (suppressed || stopped || held !== undefined) return
        stopped = true
        onRelease?.()
        onEnd()
      },
    }),
  )
  const elapsed = () =>
    held ?? (started ? origin + delay + animator.getCurrentPlayTime() : origin)
  const control = (
    position: number,
    paused: boolean,
    command: PlaybackCommand = 'seek',
  ) => {
    if (stopped) return
    if (command === 'pause') {
      held = position
      animator.pause()
      return
    }
    if (command === 'play') {
      held = undefined
      animator.resume()
      return
    }
    suppressed = true
    animator.cancel()
    started = false
    origin = Math.min(position, track.delay)
    delay = Math.max(0, track.delay - position)
    animator.setStartDelay(delay)
    held = paused ? position : undefined
    suppressed = false
    animator.start()
    if (paused) animator.pause()
    if (position >= track.delay)
      animator.setCurrentPlayTime(Math.max(0, position - track.delay))
  }
  animator.start()
  return {
    elapsed,
    control,
    cancel() {
      if (stopped) return
      stopped = true
      onRelease?.()
      animator.cancel()
    },
  }
}

/** Share one native clock among active animations. Pause it when every owner
 * is paused, and dispose it when the last owner settles. No frame callbacks. */
export function androidClockFactory() {
  let animator: android.animation.ValueAnimator | undefined
  let owners = 0,
    running = 0,
    accumulated = 0
  const now = () => accumulated + (animator?.getCurrentPlayTime() ?? 0)
  const start = () => {
    if (animator) return
    const values = Array.create('float', 2)
    values[0] = 0
    values[1] = 1
    animator = android.animation.ValueAnimator.ofFloat(values)
    animator.setDuration(60_000)
    animator.setRepeatCount(android.animation.ValueAnimator.INFINITE)
    animator.start()
  }
  const stop = () => {
    accumulated = now()
    animator?.cancel()
    animator = undefined
  }
  return (_duration: number): PlaybackClock => {
    start()
    owners++
    running++
    let offset = 0,
      anchor = now(),
      paused = false,
      stopped = false
    const time = () => offset + (paused || stopped ? 0 : now() - anchor)
    const pause = () => {
      if (paused || stopped) return
      offset = time()
      paused = true
      // getCurrentPlayTime keeps counting while a ValueAnimator is paused and
      // corrects itself only on its next frame. Start a fresh marker on resume
      // so command-time reads cannot jump forward and then backward.
      if (--running === 0) stop()
    }
    return {
      time,
      pause,
      play() {
        if (!paused || stopped) return
        if (running++ === 0) start()
        anchor = now()
        paused = false
      },
      seek(ms) {
        offset = ms
        anchor = now()
      },
      cancel() {
        if (stopped) return
        pause()
        stopped = true
        if (--owners === 0) {
          stop()
          accumulated = 0
        }
      },
    }
  }
}
