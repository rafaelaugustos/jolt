import type { View } from '@nativescript/core'
import { motionScope, reducedMotion, set, type MotionScope } from '@rafaelaugusto/jolt'
import { shape, type Shape } from '@rafaelaugusto/jolt/shapes'

export interface EntranceTargets { title: View; caption: View; rule: View; skip: View }

export function opening(targets: EntranceTargets) {
  const scope = motionScope()
  const drawings: Shape[] = []
  if (reducedMotion()) {
    set([targets.title, targets.caption, targets.skip], { opacity: 1 })
    return { scope, finished: scope.animate(targets.title, { opacity: [1, 1] }, { duration: 180 }).finished, dispose: () => scope.dispose() }
  }
  const line = shape(targets.rule, { viewBox: [0, 0, 190, 30], d: 'M0 15 L47 15 L56 12 L62 15 L76 15 L82 21 L89 2 L97 28 L105 15 L123 15 Q134 5 144 15 L190 15', fill: 'transparent', stroke: '#FF4067', strokeWidth: 1.1, strokeEnd: 0, lineCap: 'round' })
  drawings.push(line)
  const sequence = scope.timeline([
    [targets.title, { opacity: [0, 1], y: [14, 0] }, { at: 420, duration: 800, ease: 'easeOut' }],
    { at: 700, run: () => line.animate({ strokeEnd: 1 }, { duration: 1000, ease: 'easeInOut' }) },
    [targets.caption, { opacity: [0, 1], y: [8, 0] }, { at: 1000, duration: 600, ease: 'easeOut' }],
    [targets.skip, { opacity: [0, .7] }, { at: 1200, duration: 500 }],
    [targets.title, { opacity: [1, 1] }, { at: 2100, duration: 350 }],
  ])
  return { scope, finished: sequence.finished, dispose() { scope.dispose(); drawings.forEach(drawing => drawing.dispose()) } }
}

export function revealInterface(scope: MotionScope, header: View, card: View, footer: View, hint: View) {
  return scope.timeline([
    [header, { opacity: [0, 1], y: reducedMotion() ? 0 : [-9, 0] }, { at: 0, duration: 500, ease: 'easeOut' }],
    [card, { opacity: [0, 1], y: reducedMotion() ? 0 : [38, 0] }, { at: 100, type: 'spring', duration: 850, bounce: .12 }],
    [footer, { opacity: [0, 1], y: reducedMotion() ? 0 : [12, 0] }, { at: 230, duration: 600, ease: 'easeOut' }],
    [hint, { opacity: [0, .7] }, { at: 600, duration: 600 }],
  ])
}
