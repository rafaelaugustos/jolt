import { finiteMotion } from './finite.js'
export type { DesktopOptions, DesktopProperty } from './finite.js'

// The Windows Node-API runtime projects WinRT classes at runtime. Keep mobile
// and browser imports free from its native binary.
interface XamlRuntime {
  UI: {
    Xaml: {
      Markup: { XamlReader: { Load(xml: string): any } }
      Media: {
        TranslateTransform: new () => any
        CompositeTransform: new () => any
        TransformGroup: new () => any
        Animation: { Storyboard: { SetTarget(timeline: unknown, target: unknown): void } }
      }
    }
    ViewManagement: { UISettings: new () => { AnimationsEnabled: boolean } }
  }
}
interface Element {
  Opacity: number
  RenderTransform: any
}
const installed = new WeakMap<Element, { root: any; translation: any; composite: any }>()

export function windowsMotion(element: Element, windows: XamlRuntime) {
  const xaml = windows.UI.Xaml
  const settings = new windows.UI.ViewManagement.UISettings()
  function transform(property: string) {
    const current = element.RenderTransform
    const owned = installed.get(element)
    if (owned && current === owned.root) return owned
    if (current instanceof xaml.Media.CompositeTransform)
      return { root: current, translation: undefined, composite: current }
    if (current instanceof xaml.Media.TranslateTransform) {
      if (property === 'x' || property === 'y')
        return { translation: current, composite: undefined }
      // Preserve any in-flight translation on the original native object.
      const composite = new xaml.Media.CompositeTransform()
      const root = new xaml.Media.TransformGroup()
      element.RenderTransform = root
      root.Children.Append(composite)
      root.Children.Append(current)
      const group = { root, translation: current, composite }
      installed.set(element, group)
      return group
    }
    const matrix = current?.Matrix
    if (
      current &&
      !(
        matrix &&
        matrix.M11 === 1 &&
        matrix.M22 === 1 &&
        matrix.M12 === 0 &&
        matrix.M21 === 0 &&
        matrix.OffsetX === 0 &&
        matrix.OffsetY === 0
      )
    )
      throw new Error(
        'Desktop motion needs an identity, translation or composite transform.',
      )
    const composite = new xaml.Media.CompositeTransform()
    element.RenderTransform = composite
    return { root: composite, translation: undefined, composite }
  }
  return finiteMotion(
    element,
    (property) => {
      const part = property === 'opacity' ? undefined : transform(property)
      const translation = (property === 'x' || property === 'y') && part?.translation
      const target = part ? translation || part.composite : element
      const key = translation
        ? property.toUpperCase()
        : {
            opacity: 'Opacity',
            x: 'TranslateX',
            y: 'TranslateY',
            scaleX: 'ScaleX',
            scaleY: 'ScaleY',
            rotate: 'Rotation',
          }[property]
      return {
        read: () => Number(target[key]),
        write: (value) => {
          target[key] = value
        },
        play(track, done) {
          const frames = track.values
            .map((value, i) => {
              const ticks = Math.round(track.duration * track.times[i]! * 10000)
              const seconds = Math.floor(ticks / 10000000)
              const time =
                [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
                  .map((n) => String(n).padStart(2, '0'))
                  .join(':') +
                '.' +
                String(ticks % 10000000).padStart(7, '0')
              return (
                '<LinearDoubleKeyFrame KeyTime="' + time + '" Value="' + value + '"/>'
              )
            })
            .join('')
          const story = xaml.Markup.XamlReader.Load(
            '<Storyboard xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"><DoubleAnimationUsingKeyFrames EnableDependentAnimation="True" Storyboard.TargetProperty="' +
              key +
              '">' +
              frames +
              '</DoubleAnimationUsingKeyFrames></Storyboard>',
          )
          xaml.Media.Animation.Storyboard.SetTarget(story.Children.GetAt(0), target)
          function stop(value: number) {
            story.Completed = null
            story.Stop()
            target[key] = value
          }
          story.Completed = () => {
            stop(track.to)
            done()
          }
          story.Begin()
          return () => stop(Number(target[key]))
        },
      }
    },
    () => !settings.AnimationsEnabled,
  )
}
