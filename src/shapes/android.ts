import type { ShapeFactory } from './native.js'
const floats = (values: readonly number[]) => {
  const a = Array.create('float', values.length)
  values.forEach((v, i) => (a[i] = v))
  return a
}
export const androidShape: ShapeFactory = (view, style, initial) => {
  if (
    typeof org === 'undefined' ||
    typeof org.rafaelaugusto.jolt.ShapeLayer !== 'function'
  )
    throw new Error('Rebuild the Android app to install native shapes.')
  const native = view.nativeViewProtected as android.view.View
  const layer = new org.rafaelaugusto.jolt.ShapeLayer(JSON.stringify(style))
  native.getOverlay().add(layer)
  let path = initial.path
  const paint = (frame: typeof initial) => {
    path = frame.path
    layer.paint(path.commands, floats(path.points), frame.start, frame.end)
  }
  const resize = () => layer.setBounds(0, 0, native.getWidth(), native.getHeight())
  resize()
  paint(initial)
  return {
    paint,
    resize,
    read() {
      const v = layer.values()
      return {
        path: {
          ...path,
          points: Array.from({ length: v.length - 2 }, (_, i) => v[i + 2]!),
        },
        start: v[0]!,
        end: v[1]!,
      }
    },
    play(from, to, track) {
      path = from.path
      layer.play(
        path.commands,
        floats([from.start, from.end, ...from.path.points]),
        floats([to.start, to.end, ...to.path.points]),
        floats(track.times),
        floats(track.values),
        track.duration,
        track.delay,
        track.repeat === Infinity ? -1 : track.repeat,
        track.reverse,
      )
    },
    control: (time, paused) => layer.control(time, paused),
    animations: () => (layer.isPlaying() ? 1 : 0),
    bounds() {
      const b = layer.geometryBounds()
      return Array.from({ length: b.length }, (_, i) => b[i]!)
    },
    dispose() {
      layer.dispose()
      native.getOverlay().remove(layer)
    },
  }
}
