import {
  Application,
  Button,
  GestureTypes,
  isAndroid,
  isIOS,
  type GestureEventData,
  type View,
} from '@nativescript/core'

/** `--name=value` or a bare `--name` flag on iOS; a string extra of the start intent on Android. */
export function launchArgument(name: string): string | undefined {
  if (isIOS) {
    const args = NSProcessInfo.processInfo.arguments
    for (let i = 0; i < args.count; i++) {
      const value = args.objectAtIndex(i)
      if (value === `--${name}`) return 'true'
      if (value.startsWith(`--${name}=`)) return value.slice(name.length + 3)
    }
    return undefined
  }
  if (isAndroid)
    return (
      Application.android.startActivity?.getIntent()?.getStringExtra(name) ?? undefined
    )
  return undefined
}

export function findView(
  root: View,
  predicate: (view: View) => boolean,
): View | undefined {
  if (predicate(root)) return root
  let found: View | undefined
  root.eachChildView((child) => {
    found = findView(child, predicate)
    return !found
  })
  return found
}

/** Taps the first view whose text or accessibility label equals `text`, or its nearest tappable ancestor. */
export function tapView(root: View, text: string) {
  let target = findView(
    root,
    (view) =>
      (view as View & { text?: string }).text === text ||
      view.accessibilityLabel === text,
  )
  while (target && !target.getGestureObservers(GestureTypes.tap)?.length) {
    if (target instanceof Button) break
    target = target.parent as View | undefined
  }
  if (!target) return
  const observers = target.getGestureObservers(GestureTypes.tap)
  if (observers?.length)
    for (const observer of [...observers])
      observer.callback({
        eventName: 'tap',
        object: target,
        view: target,
        type: GestureTypes.tap,
      } as unknown as GestureEventData)
  else target.notify({ eventName: 'tap', object: target })
}

/** Schedules the taps requested with `--tap`, one every `--every` milliseconds. Returns a cancel function. */
export function runLaunchTaps(root: View): () => void {
  const taps = launchArgument('tap')?.split(',').filter(Boolean) ?? []
  const every = Number(launchArgument('every') ?? 1200)
  const timers = taps.map((text, index) =>
    setTimeout(() => tapView(root, text), every * (index + 1)),
  )
  return () => timers.forEach((timer) => clearTimeout(timer))
}
