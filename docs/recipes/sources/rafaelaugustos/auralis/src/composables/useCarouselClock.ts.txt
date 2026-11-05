import { onUnmounted, ref } from 'nativescript-vue'
import { isA11yEnabled } from '@nativescript/core/accessibility'
import { motionScope, motionValue, reducedMotion, set, type Animation } from '@rafaelaugusto/jolt'

export const CAROUSEL_DURATION = 4000

/** The indicator and advance share one Jolt clock: no interval or per-frame JS. */
export function useCarouselClock(advance: () => Promise<void>) {
  const progress = motionValue(0)
  const playing = ref(!reducedMotion() && !isA11yEnabled())
  const motion = motionScope()
  let timer: Animation | undefined
  let ready = false
  let generation = 0
  if (!playing.value) motion.suspend()

  function hold() {
    ready = false
    generation++
    timer?.stop()
    timer = undefined
    set(progress, 0)
  }

  function start() {
    hold()
    ready = true
    if (!playing.value || motion.disposed) return
    const current = generation
    timer = motion.animate(progress, 1, { duration: CAROUSEL_DURATION, ease: 'linear' })
    void timer.finished.then(completed => {
      if (current !== generation || !completed || motion.disposed) return
      timer = undefined
      if (ready && playing.value) void advance()
    })
  }

  function toggle() {
    playing.value = !playing.value
    if (playing.value) {
      motion.resume()
      if (ready && !timer) start()
    } else motion.suspend()
  }

  onUnmounted(() => { generation++; motion.dispose() })
  return { progress, playing, start, hold, toggle }
}
