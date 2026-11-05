import type { AnimateOptions, Keyframes } from '@rafaelaugusto/jolt'

export interface CardLayout {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
}

export const sceneTiming = {
  enterAt: 300,
  enterStagger: 42,
  enterDuration: 820,
  exitStagger: 26,
  exitDuration: 440,
  horizonAt: 180,
  horizonDuration: 620,
} as const

export interface CardFlight {
  keyframes: Keyframes
  options: AnimateOptions
}

/** All cards pass through the same pool of light, regardless of swipe direction. */
function poolOffset(card: CardLayout, horizon: number) {
  return {
    x: 201 - (card.x + card.width / 2),
    // Hide the whole shrunken card behind the deepest part of the curved edge.
    y: horizon + 62 - (card.y + card.height / 2),
  }
}

export function exitFlight(card: CardLayout, horizon: number, index: number, count: number): CardFlight {
  const pool = poolOffset(card, horizon)
  const spin = (index % 2 === 0 ? 1 : -1) * (24 + index * 3)
  return {
    keyframes: {
      x: [0, -pool.x * 0.08, pool.x * 0.3, pool.x],
      y: [0, -14, pool.y * 0.25, pool.y],
      scale: [1, 1.045, 0.72, 0.06],
      rotate: [card.rotation, card.rotation - spin * 0.1, card.rotation + spin * 0.4, card.rotation + spin],
      opacity: [card.opacity, card.opacity, card.opacity * 0.85, 0],
    },
    options: {
      duration: sceneTiming.exitDuration,
      delay: (count - 1 - index) * sceneTiming.exitStagger,
      times: [0, 0.2, 0.6, 1],
      ease: ['easeOut', 'easeIn', 'easeIn'],
      opacity: { times: [0, 0.5, 0.82, 1] },
    },
  }
}

export function entryFlight(card: CardLayout, horizon: number, index: number): CardFlight {
  const pool = poolOffset(card, horizon)
  const twist = (index % 2 === 0 ? -1 : 1) * (30 + index * 2)
  const overshoot = 23 + index % 3 * 6
  return {
    keyframes: {
      x: [pool.x, -pool.x * 0.07, pool.x * 0.02, 0],
      y: [pool.y, -overshoot, 7, 0],
      scale: [0.08, 1.055, 0.985, 1],
      rotate: [card.rotation + twist, card.rotation - twist * 0.17, card.rotation + twist * 0.04, card.rotation],
      opacity: [0, card.opacity, card.opacity, card.opacity],
    },
    options: {
      duration: sceneTiming.enterDuration,
      delay: sceneTiming.enterAt + index * sceneTiming.enterStagger,
      times: [0, 0.55, 0.79, 1],
      ease: ['easeOut', 'easeInOut', 'easeOut'],
      opacity: { times: [0, 0.22, 0.79, 1] },
    },
  }
}
