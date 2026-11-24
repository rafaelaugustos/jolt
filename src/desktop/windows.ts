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
export function windowsMotion(element: Element, windows: XamlRuntime) {
  const xaml = windows.UI.Xaml
  const settings = new windows.UI.ViewManagement.UISettings()
  let translation: any
  return finiteMotion(
    (property) => {
      if (property !== 'opacity' && !translation) {
        if (element.RenderTransform != null)
          throw new Error(
            'Translation requires a dedicated target with no existing RenderTransform.',
          )
        translation = new xaml.Media.TranslateTransform()
        element.RenderTransform = translation
      }
      const target = property === 'opacity' ? element : translation
      const key = property === 'opacity' ? 'Opacity' : property.toUpperCase()
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
            '<Storyboard xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"><DoubleAnimationUsingKeyFrames Storyboard.TargetProperty="' +
              key +
              '">' +
              frames +
              '</DoubleAnimationUsingKeyFrames></Storyboard>',
          )
          xaml.Media.Animation.Storyboard.SetTarget(story.Children.GetAt(0), target)
          function stop(value: number) {
            story.Completed = null
            target[key] = value
            story.Stop()
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
