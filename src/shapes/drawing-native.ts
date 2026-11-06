import { isIOS, type View } from '@nativescript/core'
export interface DrawingPainter {
  readonly compact?: boolean
  apply(program: string, points?: readonly number[]): void
  resize(): void
  dispose(): void
}
export type DrawingFactory = (view: View) => DrawingPainter
let override: DrawingFactory | undefined
export function setDrawingFactory(factory: DrawingFactory | undefined) {
  override = factory
}
export function createDrawing(view: View): DrawingPainter {
  if (override) return override(view)
  if (isIOS) {
    if (typeof JoltBatchDrawing === 'undefined')
      throw new Error('Rebuild the iOS app to install drawing surfaces.')
    const layer = JoltBatchDrawing.attach(view.nativeViewProtected as UIView)
    return {
      apply(program) {
        if (!layer.apply(program)) throw new Error(layer.lastError)
      },
      resize: () => layer.resize(),
      dispose: () => layer.dispose(),
    }
  }
  const native = view.nativeViewProtected as android.view.View
  const layer = new org.rafaelaugusto.jolt.BatchDrawing()
  native.getOverlay().add(layer)
  return {
    compact: true,
    apply(program, points = []) {
      const values = Array.create('float', points.length)
      points.forEach((value, index) => {
        values[index] = value
      })
      layer.apply(program, values)
    },
    resize: () => layer.setBounds(0, 0, native.getWidth(), native.getHeight()),
    dispose() {
      native.getOverlay().remove(layer)
      layer.dispose()
    },
  }
}
