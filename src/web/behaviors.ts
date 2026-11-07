import type { WebMotionScope } from './scope.js'
export type {
  BehaviorStatus,
  BehaviorResult,
  BehaviorRun,
  MotionBehaviorsOptions,
  MotionBehaviors,
} from '../core/motion-behaviors.js'
export type WebBehaviorContext =
  import('../core/motion-behaviors.js').BehaviorContext<WebMotionScope>
export type WebMotionBehavior =
  import('../core/motion-behaviors.js').MotionBehavior<WebMotionScope>
