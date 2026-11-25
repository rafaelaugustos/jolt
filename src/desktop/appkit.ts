import { finiteMotion } from './finite.js'
export type { DesktopOptions, DesktopProperty } from './finite.js'
interface AppKitLayer {
  valueForKeyPath(key: string): number
  setValueForKeyPath(value: number, key: string): void
  presentationLayer(): AppKitLayer | null
  addAnimationForKey(animation: unknown, key: string): void
  removeAnimationForKey(key: string): void
}
interface AppKitGlobals {
  CAKeyframeAnimation: { animationWithKeyPath(key: string): any }
  CATransaction: {
    begin(): void
    setDisableActions(disable: boolean): void
    setCompletionBlock(done: () => void): void
    commit(): void
  }
  NSArray: { arrayWithArray(values: readonly number[]): unknown }
  NSWorkspace: { sharedWorkspace: { accessibilityDisplayShouldReduceMotion: boolean } }
}
export function appKitMotion(view: { wantsLayer: boolean; layer: AppKitLayer }) {
  const api = globalThis as unknown as AppKitGlobals
  if (!api.CAKeyframeAnimation)
    throw new Error('Load AppKit and QuartzCore before creating a desktop motion owner.')
  view.wantsLayer = true
  const layer = view.layer
  function transaction(action: () => void) {
    api.CATransaction.begin()
    try {
      api.CATransaction.setDisableActions(true)
      action()
    } finally {
      api.CATransaction.commit()
    }
  }
  return finiteMotion(
    view,
    (property) => {
      const key = {
        opacity: 'opacity',
        x: 'transform.translation.x',
        y: 'transform.translation.y',
        scaleX: 'transform.scale.x',
        scaleY: 'transform.scale.y',
        rotate: 'transform.rotation.z',
      }[property]
      const factor = property === 'rotate' ? Math.PI / 180 : 1
      const animationKey = 'jolt.' + key
      const read = () =>
        Number((layer.presentationLayer() ?? layer).valueForKeyPath(key)) / factor
      return {
        read,
        write: (value) =>
          transaction(() => layer.setValueForKeyPath(value * factor, key)),
        play(track, done) {
          const animation = api.CAKeyframeAnimation.animationWithKeyPath(key)
          animation.values = api.NSArray.arrayWithArray(
            track.values.map((value) => value * factor),
          )
          animation.keyTimes = api.NSArray.arrayWithArray(track.times)
          animation.duration = track.duration / 1000
          transaction(() => {
            layer.setValueForKeyPath(track.to * factor, key)
            api.CATransaction.setCompletionBlock(done)
            layer.addAnimationForKey(animation, animationKey)
          })
          return () => {
            const current = read()
            transaction(() => {
              layer.setValueForKeyPath(current * factor, key)
              layer.removeAnimationForKey(animationKey)
            })
          }
        },
      }
    },
    () => Boolean(api.NSWorkspace.sharedWorkspace.accessibilityDisplayShouldReduceMotion),
  )
}
