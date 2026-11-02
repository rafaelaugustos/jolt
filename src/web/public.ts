import type { WebDrag, WebDragOptions } from './drag.js'
export type { WebDrag, WebDragOptions } from './drag.js'
import type { WebSpringOptions, WebSpringValue } from './spring-value.js'
export type { WebSpringOptions, WebSpringValue } from './spring-value.js'
import type {
  WebMotionValue,
  WebReadableValue,
  WebBindings,
  WebBinding,
} from './value.js'
export type {
  WebMotionValue,
  WebReadableValue,
  WebBindings,
  WebBinding,
  WebMapOptions,
} from './value.js'
import type {
  WebScrollSource,
  WebScrollValue,
  WebScrollKeyframes,
  WebScrollOptions,
  WebScrollLink,
} from './scroll.js'
export type {
  WebScrollSource,
  WebScrollValue,
  WebScrollKeyframes,
  WebScrollOptions,
  WebScrollLink,
} from './scroll.js'
import { createWebRuntime as createInternalRuntime } from './runtime.js'
import type { WebPress, WebPressOptions } from './press.js'
export type { WebPress, WebPressOptions, WebPressState } from './press.js'
import type {
  AnimateOptions,
  Keyframes,
  PlaybackAnimation,
  Preset,
  Property,
  RuntimeOptions,
  SpringName,
  Values,
  WebConfig,
} from './types.js'

export type {
  AnimateOptions,
  KeyframeProperty,
  KeyframeValue,
  Keyframes,
  Preset,
  Property,
  RuntimeOptions,
  SpringName,
  Stagger,
  Transition,
  Values,
  WebConfig,
} from './types.js'

/** Experimental finite playback handle. Activation/disposal resolves ready. */
export interface WebAnimation extends PlaybackAnimation {
  readonly ready: Promise<void>
}

/** Experimental DOM context; platform/framework adapters are not public APIs. */
export interface WebRuntime {
  scrollValue(source?: WebScrollSource): WebScrollValue
  scrollLinked(
    source: WebScrollSource,
    target: HTMLElement,
    frames: WebScrollKeyframes,
    options: WebScrollOptions,
  ): WebScrollLink
  /** Accept a supported size/pivot change without replacing animation ownership. */
  refresh(target: HTMLElement): void
  /** Observe size changes on an already claimed surface. Dispose with its owner. */
  observeGeometry(target: HTMLElement): WebBinding
  drag(target: HTMLElement, options?: WebDragOptions): WebDrag
  motionValue(initial: number): WebMotionValue
  springValue(source: WebReadableValue, options?: WebSpringOptions): WebSpringValue
  bind(target: HTMLElement, values: WebBindings): WebBinding
  animate(
    target: HTMLElement | readonly HTMLElement[],
    animation: Keyframes | string,
    options?: AnimateOptions | SpringName,
  ): WebAnimation
  set(target: HTMLElement | readonly HTMLElement[], values: Values): WebAnimation
  press(target: HTMLElement, values?: Values, options?: WebPressOptions): WebPress
  stop(
    target: HTMLElement | readonly HTMLElement[],
    properties?: readonly (Property | 'scale')[],
    options?: { layer?: string },
  ): void
  configure(options: WebConfig): void
  definePreset(name: string, preset: Preset): void
  release(target: HTMLElement): void
  dispose(): void
}

/** Call after mounting in a browser; importing this module is safe during SSR. */
export function createWebRuntime(
  document: Document,
  options?: RuntimeOptions,
): WebRuntime {
  const runtime = createInternalRuntime(document, options)
  // Keep diagnostics, ownership internals and driver implementation off the
  // package API, including at runtime rather than only in the declarations.
  return {
    scrollValue: runtime.scrollValue.bind(runtime),
    scrollLinked: runtime.scrollLinked.bind(runtime),
    refresh: runtime.refresh.bind(runtime),
    observeGeometry: runtime.observeGeometry.bind(runtime),
    drag: runtime.drag.bind(runtime),
    motionValue: runtime.motionValue.bind(runtime),
    springValue: runtime.springValue.bind(runtime),
    bind: runtime.bind.bind(runtime),
    animate: runtime.animate.bind(runtime),
    set: runtime.set.bind(runtime),
    press: runtime.press.bind(runtime),
    stop: runtime.stop.bind(runtime),
    configure: runtime.configure.bind(runtime),
    definePreset: runtime.definePreset.bind(runtime),
    release: runtime.release.bind(runtime),
    dispose: runtime.dispose.bind(runtime),
  }
}
