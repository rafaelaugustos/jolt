import type { Property } from '../src/properties.js'
import type { Transition } from '../src/transition.js'

export const samplingCases: {
  name: string
  property: Property
  frames: number[]
  transition: Transition
  velocity?: number
}[] = [
  {
    name: 'gentle 300 DIP',
    property: 'x',
    frames: [0, 300],
    transition: { type: 'spring', duration: 600, bounce: 0 },
  },
  {
    name: 'bouncy 300 DIP',
    property: 'x',
    frames: [0, 300],
    transition: { type: 'spring', duration: 550, bounce: 0.4 },
  },
  {
    name: 'fast 300 DIP',
    property: 'x',
    frames: [0, 300],
    transition: { type: 'spring', duration: 200, bounce: 0.4 },
  },
  {
    name: 'interrupted 3000 DIP/s',
    property: 'x',
    frames: [0, 300],
    velocity: 3000,
    transition: { type: 'spring', duration: 400, bounce: 0.3 },
  },
  {
    name: 'underdamped long tail',
    property: 'x',
    frames: [0, 300],
    transition: { type: 'spring', stiffness: 100, damping: 3, mass: 1 },
  },
  {
    name: 'overdamped',
    property: 'x',
    frames: [0, 300],
    transition: { type: 'spring', duration: 500, bounce: -0.5 },
  },
  {
    name: 'slow ease 4 seconds',
    property: 'x',
    frames: [0, 300],
    transition: { duration: 4000, ease: 'easeInOut' },
  },
  {
    name: 'sharp circle',
    property: 'x',
    frames: [0, 300],
    transition: { duration: 180, ease: 'circIn' },
  },
  {
    name: 'explicit keyframes',
    property: 'x',
    frames: [0, 300, -50, 0],
    transition: {
      duration: 1800,
      ease: ['easeIn', 'backOut', 'easeOut'],
      times: [0, 0.13, 0.72, 1],
    },
  },
  {
    name: 'opacity',
    property: 'opacity',
    frames: [0, 1],
    transition: { type: 'spring', duration: 200, bounce: 0.4 },
  },
  {
    name: 'scale',
    property: 'scaleX',
    frames: [0.5, 1.5],
    transition: { type: 'spring', duration: 200, bounce: 0.4 },
  },
  {
    name: 'rotation',
    property: 'rotate',
    frames: [0, 180],
    transition: { type: 'spring', duration: 200, bounce: 0.4 },
  },
  {
    name: 'custom oscillation',
    property: 'x',
    frames: [0, 300],
    transition: { duration: 1200, ease: (p) => p + 0.1 * Math.sin(24 * Math.PI * p) },
  },
]
