import { samplingCases } from '../../benchmarks/curve-sampling-cases.js'
import type { Property } from '../../src/properties.js'
import {
  resolveTransition as resolve,
  type ResolvedTransition,
  type Transition,
} from '../../src/transition.js'

const resolveTransition = (property: Property, count: number, transition: Transition) =>
  resolve(transition, property, count)

export interface MotionCase {
  name: string
  property: Property
  frames: number[]
  transition: ResolvedTransition
  velocity: number
  timeScale: number
  reducedMotion: boolean
}

const spring = resolveTransition('x', 2, { type: 'spring', bounce: 0.3 })
const tween = resolveTransition('x', 2, { duration: 360, ease: 'easeInOut' })
const extra: (Partial<MotionCase> & Pick<MotionCase, 'name'>)[] = [
  { name: 'y spring', property: 'y' },
  { name: 'scaleY spring', property: 'scaleY', frames: [0.4, 1.2] },
  { name: 'slow spring handoff', velocity: -740, timeScale: 0.25 },
  { name: 'fast spring handoff', velocity: 1230, timeScale: 3 },
  { name: 'delayed spring', transition: { ...spring, delay: 150 }, velocity: 520 },
  { name: 'reverse spring', transition: { ...spring, repeat: 3, reverse: true } },
  { name: 'endless spring', transition: { ...spring, repeat: Infinity, reverse: true } },
  { name: 'repeat hold', transition: { ...tween, repeat: 2, repeatDelay: 90 } },
  {
    name: 'seeded repeat holds',
    transition: { ...tween, repeat: 3, reverse: true, repeatDelay: [30, 200], seed: 42 },
  },
  {
    name: 'seeded endless holds',
    transition: {
      ...tween,
      repeat: Infinity,
      reverse: true,
      repeatDelay: [30, 200],
      seed: 42,
    },
  },
  { name: 'instant tween', transition: resolveTransition('x', 2, { duration: 0 }) },
  {
    name: 'linear seams',
    frames: [0, 40, -20, 100],
    transition: resolveTransition('x', 4, {
      duration: 800,
      ease: 'linear',
      times: [0, 0.3, 0.3, 1],
    }),
  },
  {
    name: 'whole-track ease',
    frames: [0, 40, -20, 100],
    transition: resolveTransition('x', 4, {
      duration: 800,
      ease: 'backOut',
      easeTrack: true,
      times: [0, 0.2, 0.6, 1],
    }),
  },
  {
    name: 'decay',
    transition: {
      ...spring,
      curve: { type: 'decay', velocity: 1700, friction: 0.998, snap: undefined },
    },
  },
  {
    name: 'snapped decay',
    transition: {
      ...spring,
      curve: { type: 'decay', velocity: -850, friction: 0.995, snap: [-200, 0, 300] },
    },
  },
  {
    name: 'drag edge recovery',
    transition: {
      ...spring,
      curve: {
        type: 'drag',
        velocity: 1700,
        friction: 0.998,
        bounds: [0, 300],
        rubberband: true,
      },
    },
  },
  {
    name: 'drag snap',
    transition: {
      ...spring,
      curve: {
        type: 'drag',
        velocity: -850,
        friction: 0.995,
        bounds: [-200, 300],
        rubberband: false,
        snap: [-200, 0, 300],
      },
    },
  },
  {
    name: 'gravity handoff',
    velocity: -500,
    transition: resolveTransition('y', 2, {
      type: 'gravity',
      acceleration: 1800,
      restitution: 0.6,
    }),
  },
  { name: 'reduced translation', reducedMotion: true },
  {
    name: 'reduced reverse',
    reducedMotion: true,
    transition: { ...spring, repeat: 1, reverse: true },
  },
  {
    name: 'reduced opacity still plays',
    property: 'opacity',
    frames: [0, 1],
    reducedMotion: true,
    timeScale: 0.5,
  },
  {
    name: 'color still plays',
    property: 'backgroundColor',
    frames: [0xffff0000, 0x800000ff],
    reducedMotion: true,
    timeScale: 2,
    transition: resolveTransition('backgroundColor', 2, {
      duration: 400,
      ease: 'linear',
    }),
  },
  { name: 'clamped radius', property: 'borderRadius', frames: [40, 0] },
  { name: 'clamped shadow opacity', property: 'shadowOpacity', frames: [0, 1] },
  { name: 'native rotateX', property: 'rotateX', frames: [0, 90] },
]

export const motionCases: MotionCase[] = [
  ...samplingCases.map((item) => ({
    ...item,
    transition: resolveTransition(item.property, item.frames.length, item.transition),
    velocity: item.velocity ?? 0,
    timeScale: 1,
    reducedMotion: false,
  })),
  ...extra.map((item) => ({
    property: 'x' as const,
    frames: [0, 300],
    transition: spring,
    velocity: 0,
    timeScale: 1,
    reducedMotion: false,
    ...item,
  })),
]
