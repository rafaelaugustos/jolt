import { interactionExperiments } from './interaction'
import { motionExperiments } from './motion'
import { touchExperiments } from './touch'
import { layoutExperiments } from './layout'
import { effectExperiments } from './effects'
import { typeExperiments } from './typography'
import { navigationExperiments } from './navigation'
import { deviceExperiments } from './device'
import { portableExperiments } from './portable'

export const experiments = [
  ...motionExperiments,
  ...touchExperiments,
  ...layoutExperiments,
  ...effectExperiments,
  ...typeExperiments,
  ...navigationExperiments,
  ...deviceExperiments,
  ...portableExperiments,
  ...interactionExperiments,
]

/** Infrastructure used by the playground host, not independent visual effects. */
export const hostAPIs = {
  configure: 'useMotion.ts: respects site and OS reduced motion',
  release: 'LabStage.vue: releases retired DOM targets',
  dispose: 'useMotion.ts: disposes the runtime on unmount',
} as const
