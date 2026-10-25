import {
  Application,
  Image,
  isIOS,
  SharedTransition,
  Transition,
  Trace,
  type EventData,
  type Frame,
  type NavigationTransition,
  type Page,
  type NavigationData,
} from '@nativescript/core'
import { find, radius, supportedImage } from '../shared-navigation/targets.js'
import { onReducedMotion, reducedMotion, timeScale } from '../config.js'
import { springPhysics } from '../spring.js'
import { springs, type Spring } from '../transition.js'

export type InteractiveNavigationState =
  'ready' | 'animating' | 'idle' | 'dragging' | 'finishing' | 'cancelling' | 'disposed'
export interface InteractiveNavigationEvent {
  state: InteractiveNavigationState
  outcome?: 'completed' | 'cancelled'
  shared?: { status: 'ready' | 'unavailable'; reason?: string }
  /** Present on finishing/cancelling. Velocity is page widths per second. */
  release?: Readonly<{ progress: number; velocity: number }>
}
export interface InteractiveNavigationOptions {
  /** Optional stable image/card identity in the two pages. Unsupported pairs use normal page motion. */
  shared?: { tag: string; maxSnapshotPixels?: number }
  /** Same physics as Jolt's live springs. Default smooth; settling is bounded at 3 s. */
  spring?:
    | keyof typeof springs
    | Pick<Spring, 'duration' | 'bounce' | 'stiffness' | 'damping' | 'mass'>
  /** Synchronous extra gate. Page.enableSwipeBackNavigation is always respected. */
  canBegin?: () => boolean
  /** Lifecycle only. Finger updates and spring playback stay in Objective-C. */
  onState?: (event: InteractiveNavigationEvent) => void
}
export interface InteractiveNavigation {
  readonly supported: boolean
  /** Use for ONE pushed Frame entry. Pass to Frame.navigate or router.push. */
  readonly transition: NavigationTransition | undefined
  readonly state: InteractiveNavigationState
  /** Rolls back a held drag. A release already committed to UIKit finishes normally. */
  cancel(): void
  /** Detaches the gesture; future programmatic back uses UIKit's default transition. */
  dispose(): void
}

/** Interactive iOS page navigation using Core's existing UINavigationController delegate. */
export function interactiveNavigation(
  frame: Frame,
  options: InteractiveNavigationOptions = {},
): InteractiveNavigation {
  if (
    options.shared &&
    (typeof options.shared.tag !== 'string' || !options.shared.tag.trim())
  )
    throw new TypeError('A nonempty sharedTransitionTag is required.')
  const budget = options.shared?.maxSnapshotPixels ?? 8_000_000
  if (!Number.isSafeInteger(budget) || budget <= 0 || budget > 32_000_000)
    throw new RangeError('maxSnapshotPixels must be a positive integer at most 32000000.')
  const input =
    typeof options.spring === 'string' ? springs[options.spring] : options.spring
  if (options.spring !== undefined && !input)
    throw new TypeError('Unknown navigation spring.')
  for (const [key, value] of Object.entries(input ?? {}) as [string, unknown][]) {
    if (!['type', 'duration', 'bounce', 'stiffness', 'damping', 'mass'].includes(key))
      throw new TypeError(`Unsupported navigation spring option: ${key}.`)
    if (key === 'type' && value !== 'spring')
      throw new TypeError('Interactive navigation requires a spring.')
    if (key !== 'type' && (typeof value !== 'number' || !Number.isFinite(value)))
      throw new RangeError(`${key} must be finite.`)
    if (['duration', 'stiffness', 'mass'].includes(key) && (value as number) <= 0)
      throw new RangeError(`${key} must be positive.`)
    if (key === 'damping' && (value as number) < 0)
      throw new RangeError('damping must be nonnegative.')
  }
  const physics = springPhysics(input ?? springs.smooth)
  if (Object.values(physics).some((value) => !Number.isFinite(value)))
    throw new RangeError('Navigation spring physics must be finite.')
  const supported = isIOS && typeof JoltInteractiveNavigation !== 'undefined'
  let state: InteractiveNavigationState = 'ready'
  let native: JoltInteractiveNavigation | undefined, page: Page | undefined
  let candidate: Page | undefined
  let start: (() => void) | undefined
  let transitioning = false
  let fromPage: Page | undefined, toPage: Page | undefined
  let shared: InteractiveNavigationEvent['shared']
  const originalPage = frame.currentPage
  function prepareShared() {
    if (!native || !options.shared) return
    const unavailable = (reason: string) => {
      shared = { status: 'unavailable', reason }
    }
    if (reducedMotion()) return unavailable('reduced-motion')
    const sources = find(fromPage, options.shared.tag),
      targets = find(toPage, options.shared.tag)
    if (sources.length !== 1)
      return unavailable(sources.length ? 'duplicate-source' : 'missing-source')
    if (targets.length !== 1)
      return unavailable(targets.length ? 'duplicate-target' : 'missing-target')
    const source = sources[0]!,
      target = targets[0]!,
      image = source instanceof Image
    if (
      image &&
      (!supportedImage(source) ||
        !supportedImage(target) ||
        (source.src !== target.src && source.imageSource !== target.imageSource))
    )
      return unavailable('unsupported-image')
    if (!image && target instanceof Image) return unavailable('content-mismatch')
    try {
      shared = native.prepareSharedFromToImageFromRadiusToRadiusMaxPixels(
        source.nativeViewProtected,
        target.nativeViewProtected,
        image,
        radius(source),
        radius(target),
        budget,
      )
        ? { status: 'ready' }
        : { status: 'unavailable', reason: 'unsupported-geometry' }
    } catch {
      unavailable('native-unavailable')
    }
  }
  let transition: NavigationTransition | undefined
  let releaseMotion: (() => void) | undefined
  const emit = (
    next: InteractiveNavigationState,
    outcome?: InteractiveNavigationEvent['outcome'],
    release?: InteractiveNavigationEvent['release'],
  ) => {
    if (state === 'disposed') return
    state = next
    try {
      options.onState?.({
        state,
        ...(shared ? { shared } : {}),
        ...(outcome ? { outcome } : {}),
        ...(release ? { release } : {}),
      })
    } catch (error) {
      Trace.write(
        `Interactive navigation observer failed: ${String(error)}`,
        'Jolt',
        Trace.messageType.error,
      )
    }
  }
  const cancel = () => native?.cancel()
  const unload = () => control.dispose()
  const shown = () => native?.sync()
  const swipeChanged = () => {
    void Promise.resolve().then(shown)
  }
  const arrived = () => {
    if (transitioning) return
    // clearHistory/replace/programmatic pop also release the entry's recognizer.
    if (
      page &&
      frame.currentPage !== page &&
      !frame.backStack.some((entry) => entry.resolvedPage === page)
    )
      void Promise.resolve().then(() => control.dispose())
    else shown()
  }
  const entering = (args: EventData) => {
    const event = args as NavigationData
    if (!page && !event.isBack) candidate = event.entry?.resolvedPage
  }
  class PageMotion extends Transition {
    override setupInteractiveGesture(callback: () => void) {
      start = callback
    }
    override iosNavigatedController(
      nav: UINavigationController,
      operation: number,
      from: UIViewController,
      to: UIViewController,
    ) {
      if (state === 'disposed' || nav !== frame.ios.controller) return undefined
      if (operation === 1) {
        // An entry owns one transition. Reusing its instance never steals another page.
        if (page || candidate?.ios !== to) return undefined
        page = candidate
        page.on('enableSwipeBackNavigationChange', swipeChanged)
      }
      if (!page) return undefined
      const pages = [
        originalPage,
        page,
        ...frame.backStack.map((entry) => entry.resolvedPage),
      ]
      fromPage = pages.find((candidate) => candidate?.ios === from)
      toPage = pages.find((candidate) => candidate?.ios === to)
      shared = undefined
      transitioning = true
      if (!native) {
        native = JoltInteractiveNavigation.attachStiffnessDampingMassShouldBeginOnEvent(
          nav,
          physics.stiffness,
          physics.damping,
          physics.mass,
          () => {
            try {
              return (
                state === 'idle' &&
                !!start &&
                !reducedMotion() &&
                !!page &&
                frame.currentPage === page &&
                page.enableSwipeBackNavigation &&
                frame.canGoBack() &&
                (options.canBegin?.() ?? true) === true
              )
            } catch {
              return false
            }
          },
          (event) => {
            if (state === 'disposed') return
            if (event === 8) {
              prepareShared()
              return
            }
            if (event === 2) {
              transitioning = true
              frame.transitionId = this.id
              SharedTransition.updateState(this.id, {
                interactiveBegan: true,
                interactiveCancelled: false,
              })
              emit('dragging')
              start?.()
            } else if (event === 3 || event === 4) {
              emit(
                event === 3 ? 'finishing' : 'cancelling',
                undefined,
                native && { progress: native.progress, velocity: native.velocity },
              )
            } else if (event === 0) emit('animating')
            else {
              transitioning = false
              SharedTransition.updateState(this.id, {
                interactiveBegan: false,
                interactiveCancelled: event === 6,
              })
              emit(
                'idle',
                event === 5 ? 'completed' : event === 6 ? 'cancelled' : undefined,
              )
              arrived()
            }
          },
        )
      }
      if (options.shared) native.sharedEnabled = true
      native.prepareOperationPresentedReducedTimeScale(
        operation,
        page.ios,
        reducedMotion(),
        timeScale(),
      )
      return native
    }
    override iosInteractionDismiss() {
      return native?.interactive ? native : undefined
    }
  }
  const control: InteractiveNavigation = {
    supported,
    get transition() {
      return transition
    },
    get state() {
      return state
    },
    cancel,
    dispose() {
      if (state === 'disposed') return
      // Complete UIKit's context before releasing Core's interactive state.
      native?.disposeRestoringSwipe(
        !!page?.enableSwipeBackNavigation && frame.canGoBack(),
      )
      native = undefined
      emit('disposed')
      releaseMotion?.()
      frame.off('unloaded', unload)
      frame.off('navigatingTo', entering)
      frame.off('navigatedTo', arrived)
      frame.off('viewControllerShown', shown)
      Application.off(Application.suspendEvent, cancel)
      if (transition?.instance) SharedTransition.finishState(transition.instance.id)
      page?.off('enableSwipeBackNavigationChange', swipeChanged)
      start = undefined
      page = undefined
      candidate = undefined
      fromPage = undefined
      toPage = undefined
    },
  }
  if (supported) {
    if (!frame.isLoaded || !frame.ios?.controller)
      throw new Error('Create interactiveNavigation after the Frame is loaded.')
    transition = SharedTransition.custom(new PageMotion(), {
      interactive: { dismiss: {} },
    })
    frame.on('navigatingTo', entering)
    frame.on('navigatedTo', arrived)
    frame.on('viewControllerShown', shown)
    frame.on('unloaded', unload)
    Application.on(Application.suspendEvent, cancel)
    releaseMotion = onReducedMotion((value) => {
      if (value) cancel()
    })
  }
  return control
}
