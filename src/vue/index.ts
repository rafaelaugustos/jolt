import {
  BaseTransition,
  defineComponent,
  h,
  onUnmounted,
  onActivated,
  onDeactivated,
  readonly,
  shallowRef,
  type App,
  type BaseTransitionProps,
  type NSVElement,
  type ObjectDirective,
  type PropType,
  type Ref,
} from 'nativescript-vue'
import {
  press,
  motionScope,
  bind,
  motionValue,
  scrollValue,
  onKeyboard,
  onReducedMotion,
  stop,
  type Bindings,
  type MotionValue,
  type ScrollValue,
  type Target,
  reducedMotion,
  type KeyboardState,
  type MotionScope,
  type AnimateOptions,
  type Keyframes,
  type PlaybackAnimation,
  type PresetName,
  type SpringName,
} from '../index.js'
import { currentKeyboard } from '../keyboard.js'

type Host = NSVElement
type Options = AnimateOptions | SpringName

/** A preset name or keyframes, alone or paired with a transition. */
export type AnimateValue =
  PresetName | Keyframes | readonly [animation: PresetName | Keyframes, options?: Options]

/** The pressed keyframes, alone or paired with a transition. */
export type PressValue = Keyframes | readonly [pressed: Keyframes, options?: Options]

export interface TransitionProps {
  /** Played when the child is inserted. */
  enter?: AnimateValue
  /** Played before the child is removed. */
  leave?: AnimateValue
  /** Also play `enter` on the first render. */
  appear?: boolean
  mode?: 'in-out' | 'out-in' | 'default'
}

const animations = new WeakMap<object, PlaybackAnimation>()
const scopes = new WeakMap<object, MotionScope>()
const removers = new WeakMap<object, () => void>()

function split<T>(
  value: T | readonly [T, Options?],
): [animation: T, options: Options | undefined] {
  return Array.isArray(value)
    ? [value[0] as T, value[1] as Options | undefined]
    : [value as T, undefined]
}

function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null)
    return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) =>
      same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  )
}

function play(el: Host, value: AnimateValue) {
  const [animation, options] = split<PresetName | Keyframes>(value)
  let scope = scopes.get(el)
  if (!scope) scopes.set(el, (scope = motionScope()))
  const handle = scope.animate(el, animation, options)
  animations.set(el, handle)
  return handle
}

function cancel(el: Host) {
  scopes.get(el)?.dispose()
  scopes.delete(el)
  animations.delete(el)
}

function attach(el: Host, value: PressValue | undefined) {
  const [pressed, options] = value === undefined ? [] : split<Keyframes>(value)
  removers.set(el, press(el, pressed, options))
}

/**
 * Plays an animation when the element mounts, and again whenever the value changes.
 *
 * ```vue
 * <Label v-animate="'fadeInUp'" />
 * <Label v-animate="['popIn', { delay: 200 }]" />
 * ```
 */
export const vAnimate: ObjectDirective<Host, AnimateValue> = {
  mounted(el, { value }) {
    play(el, value)
  },
  updated(el, { value, oldValue }) {
    if (!same(value, oldValue)) play(el, value)
  },
  unmounted: cancel,
}

/**
 * Press feedback while a finger is on the element.
 *
 * ```vue
 * <GridLayout v-press />
 * <GridLayout v-press="{ scale: 0.95 }" />
 * ```
 */
export const vPress: ObjectDirective<Host, PressValue | undefined> = {
  mounted(el, { value }) {
    attach(el, value)
  },
  updated(el, { value, oldValue }) {
    if (same(value, oldValue)) return
    removers.get(el)?.()
    attach(el, value)
  },
  unmounted(el) {
    removers.get(el)?.()
    removers.delete(el)
  },
}

/** The hooks `JoltTransition` hands to Vue's `BaseTransition`. */
export function transitionHooks(props: TransitionProps): BaseTransitionProps<Host> {
  const run = (value: AnimateValue | undefined) => (el: Host, done: () => void) => {
    if (value === undefined) {
      done()
      return
    }
    const handle = play(el, value)
    void handle.finished.then(() => {
      if (animations.get(el) === handle) animations.delete(el)
      done()
    })
  }
  const hooks: BaseTransitionProps<Host> = {
    onEnter: run(props.enter),
    onEnterCancelled: cancel,
    onLeave: run(props.leave),
    onLeaveCancelled: cancel,
  }
  if (props.appear) {
    hooks.onAppear = hooks.onEnter
    hooks.onAppearCancelled = cancel
  }
  return hooks
}

const value = {
  type: [String, Object, Array] as PropType<AnimateValue>,
  default: undefined,
}

/**
 * Animates a child in and out. Vue keeps the element until the leave animation settles.
 *
 * ```vue
 * <JoltTransition enter="popIn" leave="fadeOut">
 *   <Label v-if="visible" text="Saved" />
 * </JoltTransition>
 * ```
 */
export const JoltTransition = defineComponent({
  name: 'JoltTransition',
  props: {
    enter: value,
    leave: value,
    appear: Boolean,
    mode: { type: String as PropType<TransitionProps['mode']>, default: undefined },
  },
  setup(props, { slots }) {
    return () =>
      h(
        BaseTransition,
        { ...transitionHooks(props), mode: props.mode, appear: props.appear },
        slots,
      )
  },
})

/** Registers `v-animate`, `v-press` and `JoltTransition` on the app. */
export function install(app: App) {
  app.directive('animate', vAnimate)
  app.directive('press', vPress)
  app.component('JoltTransition', JoltTransition)
}

export default { install }

/** Call in setup(): suspend cached components and dispose only on actual unmount. */
export function useMotionScope(): MotionScope {
  const scope = motionScope()
  onUnmounted(() => scope.dispose())
  onDeactivated(() => scope.suspend())
  onActivated(() => scope.resume())
  return scope
}

/** Call in setup(): whether motion is reduced, kept up to date until the component unmounts. */
export function useReducedMotion(): Readonly<Ref<boolean>> {
  const reduced = shallowRef(reducedMotion())
  const off = onReducedMotion((value) => (reduced.value = value))
  onUnmounted(off)
  return readonly(reduced)
}

/** Call in setup(): the keyboard's state, kept up to date until the component unmounts. */
export function useKeyboard(): Readonly<Ref<KeyboardState>> {
  const keyboard = shallowRef<KeyboardState>(currentKeyboard())
  const off = onKeyboard((next) => (keyboard.value = next))
  keyboard.value = currentKeyboard()
  onUnmounted(off)
  return readonly(keyboard) as Readonly<Ref<KeyboardState>>
}

/** Call in setup(): a motion value that stops when the component unmounts. */
export function useMotionValue(initial = 0): MotionValue {
  const value = motionValue(initial)
  onUnmounted(() => stop(value))
  return value
}

/**
 * Call in setup(): a template ref that binds motion values to the element on mount
 * and releases them on unmount. A recreated element picks the values up again.
 */
export function useBinding(bindings: Bindings): (element: Target | null) => void {
  let element: Target | null = null
  let release: (() => void) | undefined
  onUnmounted(() => {
    release?.()
    release = undefined
  })
  return (next) => {
    if (next === element) return
    release?.()
    release = undefined
    element = next
    if (next) release = bind(next, bindings)
  }
}

/**
 * Call in setup(): a scroll offset as a value. Pass its `ref` to the ScrollView's
 * template ref; it stops following when the component unmounts.
 */
export function useScrollValue(options?: { axis?: 'x' | 'y' }): ScrollValue {
  const value = scrollValue(null, options)
  onUnmounted(() => value.dispose())
  return value
}
