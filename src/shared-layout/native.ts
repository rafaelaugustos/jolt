import { isIOS, type View } from '@nativescript/core'

export interface Flight {
  pixels(): number
  state(): string
  prepare(view: View, image: boolean, radius: number, budget: number): string | null
  holdPage?(page: View, budget: number): boolean
  fade?(duration: number, complete: (finished: boolean) => void): void
  freeze(budget: number): boolean
  play(tracks: string, complete: (finished: boolean) => void): void
  dispose(): void
}
export function capture(
  view: View,
  image: boolean,
  radius: number,
  budget: number,
): Flight | undefined {
  if (isIOS) {
    if (typeof JoltSharedLayoutFlight === 'undefined')
      throw new Error('Rebuild the native app to use sharedLayout().')
    const flight = JoltSharedLayoutFlight.captureImageRadiusMaxPixels(
      view.nativeViewProtected,
      image,
      radius,
      budget,
    )
    if (!flight) return
    return {
      holdPage: (page, budget) =>
        flight.holdPageMaxPixels(page.nativeViewProtected, budget),
      fade: (duration, done) => flight.fadeOnEnd(duration, done),
      pixels: () => flight.pixels(),
      state: () => flight.state(),
      prepare: (target, image, radius, budget) =>
        flight.prepareImageRadiusMaxPixels(
          target.nativeViewProtected,
          image,
          radius,
          budget,
        ),
      freeze: (budget) => flight.freeze(budget),
      play: (json, done) => flight.playOnEnd(json, done),
      dispose: () => flight.dispose(),
    }
  }
  const Native = org.rafaelaugusto.jolt.SharedLayoutFlight
  if (!Native) throw new Error('Rebuild the native app to use sharedLayout().')
  const flight = Native.capture(view.nativeViewProtected, image, radius, budget)
  if (!flight) return
  return {
    holdPage: (page, budget) => flight.holdPage(page.nativeViewProtected, budget),
    fade: (duration, done) =>
      flight.fade(
        duration,
        new org.rafaelaugusto.jolt.SharedLayoutFlight.Listener({ onEnd: done }),
      ),
    pixels: () => flight.pixels(),
    state: () => flight.state(),
    prepare: (target, image, radius, budget) =>
      flight.prepare(target.nativeViewProtected, image, radius, budget),
    freeze: (budget) => flight.freeze(budget),
    play: (json, done) =>
      flight.play(
        json,
        new org.rafaelaugusto.jolt.SharedLayoutFlight.Listener({ onEnd: done }),
      ),
    dispose: () => flight.dispose(),
  }
}

/** Static decoded Image content; native crop coordinates animate with the moving clip. */
export function captureNavigationImage(
  view: View,
  radius: number,
  budget: number,
): Flight | undefined {
  if (isIOS) {
    if (
      typeof JoltSharedLayoutFlight === 'undefined' ||
      !JoltSharedLayoutFlight.captureNavigationImageRadiusMaxPixels
    )
      throw new Error('Rebuild the native app to use sharedNavigation().')
    const flight = JoltSharedLayoutFlight.captureNavigationImageRadiusMaxPixels(
      view.nativeViewProtected,
      radius,
      budget,
    )
    if (!flight) return
    return {
      holdPage: (page, budget) =>
        flight.holdPageMaxPixels(page.nativeViewProtected, budget),
      fade: (duration, done) => flight.fadeOnEnd(duration, done),
      pixels: () => flight.pixels(),
      state: () => flight.state(),
      prepare: (target, _image, radius, budget) =>
        flight.prepareNavigationImageRadiusMaxPixels(
          target.nativeViewProtected,
          radius,
          budget,
        ),
      freeze: () => false,
      play: (json, done) => flight.playOnEnd(json, done),
      dispose: () => flight.dispose(),
    }
  }
  const Native = org.rafaelaugusto.jolt.SharedLayoutFlight
  if (!Native?.captureNavigationImage)
    throw new Error('Rebuild the native app to use sharedNavigation().')
  const flight = Native.captureNavigationImage(view.nativeViewProtected, radius, budget)
  if (!flight) return
  return {
    holdPage: (page, budget) => flight.holdPage(page.nativeViewProtected, budget),
    fade: (duration, done) =>
      flight.fade(
        duration,
        new org.rafaelaugusto.jolt.SharedLayoutFlight.Listener({ onEnd: done }),
      ),
    pixels: () => flight.pixels(),
    state: () => flight.state(),
    prepare: (target, _image, radius, budget) =>
      flight.prepareNavigationImage(target.nativeViewProtected, radius, budget),
    freeze: () => false,
    play: (json, done) =>
      flight.play(
        json,
        new org.rafaelaugusto.jolt.SharedLayoutFlight.Listener({ onEnd: done }),
      ),
    dispose: () => flight.dispose(),
  }
}
