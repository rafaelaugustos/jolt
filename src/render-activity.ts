import { Application, Trace } from '@nativescript/core'
import {
  createRenderActivity,
  type RenderActivityAdapter,
} from './core/render-activity.js'
export type { RenderActivity, RenderActivityAdapter } from './core/render-activity.js'

/** Boundary-driven demand for an explicitly integrated native renderer. */
export function renderActivity(adapter: RenderActivityAdapter) {
  return createRenderActivity(adapter, {
    hidden: () => Application.suspended,
    visibility(change) {
      Application.on(Application.suspendEvent, change)
      Application.on(Application.resumeEvent, change)
      return () => {
        Application.off(Application.suspendEvent, change)
        Application.off(Application.resumeEvent, change)
      }
    },
    error: (error) =>
      Trace.write(String(error), Trace.categories.Error, Trace.messageType.error),
  })
}
