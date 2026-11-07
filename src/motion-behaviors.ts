import { Application } from '@nativescript/core'
import { motionScope, type MotionScope } from './motion-scope.js'
import { createMotionBehaviors } from './core/motion-behaviors.js'
import type { MotionBehaviorsOptions, MotionBehaviors } from './core/motion-behaviors.js'
export type {
  BehaviorStatus,
  BehaviorResult,
  BehaviorRun,
  MotionBehaviorsOptions,
  MotionBehaviors,
} from './core/motion-behaviors.js'
export type BehaviorContext =
  import('./core/motion-behaviors.js').BehaviorContext<MotionScope>
export type MotionBehavior =
  import('./core/motion-behaviors.js').MotionBehavior<MotionScope>

/** One exclusive interaction lane, backed by native scopes and app lifecycle. */
export function motionBehaviors<const D extends Record<string, MotionBehavior>>(
  definitions: D,
  options: MotionBehaviorsOptions<Extract<keyof D, string>> = {},
): MotionBehaviors<Extract<keyof D, string>> {
  let background = Application.suspended
  return createMotionBehaviors(definitions, options, {
    scope: motionScope,
    hidden: () => background,
    visibility(callback) {
      const suspend = () => {
        background = true
        callback()
      }
      const resume = () => {
        background = false
        callback()
      }
      Application.on(Application.suspendEvent, suspend)
      Application.on(Application.resumeEvent, resume)
      return () => {
        Application.off(Application.suspendEvent, suspend)
        Application.off(Application.resumeEvent, resume)
      }
    },
  })
}
