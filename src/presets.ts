import type { AnimateOptions, Keyframes } from './types.js'

export interface Preset {
  keyframes: Keyframes
  transition: AnimateOptions
}

/** Add custom preset names through module augmentation, with `true` as each value. */
export interface Presets {}

const fadeIn = { duration: 300, ease: 'easeOut' } as const
const fadeOut = { duration: 200, ease: 'easeIn' } as const
const enter = { type: 'spring', duration: 500, bounce: 0 } as const

export const presets = {
  fadeIn: { keyframes: { opacity: [0, 1] }, transition: fadeIn },
  fadeInUp: {
    keyframes: { opacity: [0, 1], y: [24, 0] },
    transition: { ...enter, opacity: fadeIn },
  },
  fadeInDown: {
    keyframes: { opacity: [0, 1], y: [-24, 0] },
    transition: { ...enter, opacity: fadeIn },
  },
  fadeInLeft: {
    keyframes: { opacity: [0, 1], x: [-24, 0] },
    transition: { ...enter, opacity: fadeIn },
  },
  fadeInRight: {
    keyframes: { opacity: [0, 1], x: [24, 0] },
    transition: { ...enter, opacity: fadeIn },
  },
  zoomIn: {
    keyframes: { opacity: [0, 1], scale: [0.85, 1] },
    transition: { ...enter, opacity: fadeIn },
  },
  popIn: {
    keyframes: { opacity: [0, 1], scale: [0.5, 1] },
    transition: {
      type: 'spring',
      duration: 550,
      bounce: 0.4,
      opacity: { duration: 150 },
    },
  },
  flipInX: {
    keyframes: { opacity: [0, 1], rotateX: [-90, 0] },
    transition: {
      type: 'spring',
      duration: 600,
      bounce: 0.25,
      opacity: { duration: 200 },
    },
  },
  flipInY: {
    keyframes: { opacity: [0, 1], rotateY: [90, 0] },
    transition: {
      type: 'spring',
      duration: 600,
      bounce: 0.25,
      opacity: { duration: 200 },
    },
  },

  fadeOut: { keyframes: { opacity: 0 }, transition: fadeOut },
  fadeOutUp: { keyframes: { opacity: 0, y: -24 }, transition: fadeOut },
  fadeOutDown: { keyframes: { opacity: 0, y: 24 }, transition: fadeOut },
  fadeOutLeft: { keyframes: { opacity: 0, x: -24 }, transition: fadeOut },
  fadeOutRight: { keyframes: { opacity: 0, x: 24 }, transition: fadeOut },
  zoomOut: { keyframes: { opacity: 0, scale: 0.85 }, transition: fadeOut },
  popOut: {
    keyframes: { opacity: 0, scale: [null, 1.08, 0.4] },
    transition: {
      duration: 250,
      ease: ['easeOut', 'easeIn'],
      times: [0, 0.3, 1],
      opacity: { duration: 250, ease: 'easeIn' },
    },
  },

  pulse: {
    keyframes: { scale: [1, 1.06, 1] },
    transition: { duration: 500, ease: 'easeInOut' },
  },
  bounce: {
    keyframes: { y: [0, -18, 0, -8, 0] },
    transition: {
      duration: 650,
      times: [0, 0.3, 0.6, 0.8, 1],
      ease: ['easeOut', 'easeIn', 'easeOut', 'easeIn'],
    },
  },
  shake: {
    keyframes: { x: [0, -10, 10, -8, 8, -4, 4, 0] },
    transition: { duration: 500, ease: 'easeInOut' },
  },
  wiggle: {
    keyframes: { rotate: [0, -8, 8, -5, 5, 0] },
    transition: { duration: 500, ease: 'easeInOut' },
  },
  heartbeat: {
    keyframes: { scale: [1, 1.15, 1, 1.15, 1, 1] },
    transition: {
      duration: 1000,
      times: [0, 0.14, 0.28, 0.42, 0.7, 1],
      ease: 'easeInOut',
    },
  },
  jelly: {
    keyframes: {
      scaleX: [1, 1.25, 0.75, 1.15, 0.95, 1.05, 1],
      scaleY: [1, 0.75, 1.25, 0.85, 1.05, 0.95, 1],
    },
    transition: {
      duration: 800,
      times: [0, 0.3, 0.4, 0.5, 0.65, 0.75, 1],
      ease: 'easeInOut',
    },
  },
  flash: {
    keyframes: { opacity: [1, 0, 1, 0, 1] },
    transition: { duration: 800, ease: 'easeInOut' },
  },
  tada: {
    keyframes: {
      scale: [1, 0.9, 0.9, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1],
      rotate: [0, -3, -3, 3, -3, 3, -3, 3, -3, 3, 0],
    },
    transition: { duration: 1000, ease: 'easeInOut' },
  },
  spin: {
    keyframes: { rotate: [0, 360] },
    transition: { duration: 1000, ease: 'linear' },
  },
} satisfies Record<string, Preset>

export type PresetName = keyof typeof presets | Extract<keyof Presets, string>

const customPresets = new Map<string, Preset>()

/** Registers a custom preset. Registering it again replaces it for future animations. */
export function definePreset(name: PresetName, preset: Preset): void {
  if (Object.hasOwn(presets, name)) {
    throw new Error(`Preset "${name}" is built in and cannot be replaced.`)
  }
  customPresets.set(name, preset)
}

export function getPreset(name: PresetName): Preset {
  const preset =
    customPresets.get(name) ??
    (Object.hasOwn(presets, name) ? presets[name as keyof typeof presets] : undefined)
  if (!preset) throw new Error(`Unknown preset "${name}".`)
  return preset
}
