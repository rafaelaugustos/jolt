import type { GridLayout, View } from '@nativescript/core'
import { motionScope, particles, reducedMotion, set } from '@rafaelaugusto/jolt'
import { shape, type Shape } from '@rafaelaugusto/jolt/shapes'

const SEAL = 'M128 10 L230 69 L230 187 L128 246 L26 187 L26 69 Z'

/** A single, pausable entrance. Native launch artwork uses the same resting pose. */
export function playLaunch(root: GridLayout, reveal: () => Promise<void>) {
  const motion = motionScope()
  const drawings: Shape[] = []
  const view = (id: string) => root.getViewById<View>(id)
  const mark = view('launch-mark')
  const halo = view('launch-halo')
  const seal = view('launch-seal')
  const flash = view('launch-flash')
  const title = view('launch-title')
  const caption = view('launch-caption')

  const finished = (async () => {
    if (reducedMotion()) {
      set([title, caption], { opacity: 1 })
      if (!await motion.animate(root, { opacity: [1, 1] }, { duration: 100 }).finished) return false
    } else {
      // Transform containers, keeping the native drawing surfaces at fixed bounds.
      motion.gradient(view('launch-halo-paint'), {
        type: 'radial', radius: 0.5,
        colors: ['rgba(131,238,61,0.28)', 'rgba(91,179,32,0.09)', 'rgba(10,9,14,0)'],
        stops: [0, 0.4, 1],
      })
      motion.gradient(view('launch-flash-paint'), {
        type: 'radial', radius: 0.5,
        colors: ['rgba(207,255,154,0)', 'rgba(172,255,92,0.20)', 'rgba(10,9,14,0)'],
        stops: [0, 0.65, 1],
      })
      const outline = shape(view('launch-seal-paint'), {
        viewBox: [0, 0, 256, 256], d: SEAL,
        stroke: '#8ebc63', strokeWidth: 0.8, strokeEnd: 0,
        lineJoin: 'round',
      })
      drawings.push(outline)
      motion.use(() => particles(view('launch-motes'), {
        colors: ['#d9ffb1', '#b5f564', '#628941'], source: 'center',
        rate: 14, duration: 800, lifetime: 1100, size: 2,
        velocity: 58, velocityRange: 18, spread: 360, gravity: -7,
      }))

      const entrance = motion.timeline([
        [mark, { scale: [1, 1.08, 1.03, 1], y: [0, -10, -4, 0], rotate: [0, -5, 2, 0] },
          { at: 0, duration: 1550, times: [0, 0.35, 0.7, 1], ease: 'easeInOut' }],
        [halo, { opacity: [0, 0.9, 0.5], scale: [0.7, 1.15, 1] },
          { at: 0, duration: 1550, ease: 'easeInOut' }],
        [seal, { opacity: [0, 0.6, 0.6, 0], rotate: [-16, 0, 18], scale: [0.92, 1, 1.1] },
          { at: 0, duration: 1500, ease: 'easeInOut' }],
        { at: 80, run: () => outline.animate({ strokeEnd: 1 }, { duration: 900, ease: 'easeInOut' }) },
        [title, { opacity: [0, 1], y: [14, 0] }, { at: 300, duration: 540, ease: 'easeOut' }],
        [caption, { opacity: [0, 1], y: [8, 0] }, { at: 520, duration: 440, ease: 'easeOut' }],
        [flash, { opacity: [0, 1, 0], scale: [0.55, 1.2, 1.8] },
          { at: 820, duration: 650, ease: 'easeOut' }],
      ])
      if (!await entrance.finished) return false
    }

    if (motion.disposed) return false
    await reveal()
    if (motion.disposed) return false
    return motion.animate(root, { opacity: 0 }, {
      duration: reducedMotion() ? 150 : 320, ease: 'easeInOut',
    }).finished
  })()

  return {
    finished,
    dispose() {
      motion.dispose()
      drawings.forEach(drawing => drawing.dispose())
    },
  }
}
