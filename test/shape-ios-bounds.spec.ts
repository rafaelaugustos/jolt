import { afterEach, expect, it, vi } from 'vitest'
import { iosShape } from '../src/shapes/ios.js'
import { shapePath } from '../src/shapes/path.js'
import { createView } from './helpers.js'

afterEach(() => vi.unstubAllGlobals())

it('paints in UIView local bounds when transformed layout frames are larger', () => {
  const layers: any[] = []
  const makeLayer = () => {
    const layer = {
      addSublayer: vi.fn(),
      removeAllAnimations: vi.fn(),
      removeFromSuperlayer: vi.fn(),
    }
    layers.push(layer)
    return layer
  }
  const rect = (x: number, y: number, width: number, height: number) => ({
    origin: { x, y },
    size: { width, height },
  })
  vi.stubGlobal('CALayer', { new: makeLayer })
  vi.stubGlobal('CAShapeLayer', { new: makeLayer })
  vi.stubGlobal('CATransaction', { begin() {}, commit() {}, setDisableActions() {} })
  vi.stubGlobal('UIScreen', { mainScreen: { scale: 3 } })
  vi.stubGlobal('kCAFillRuleEvenOdd', 'evenodd')
  vi.stubGlobal('kCAFillRuleNonZero', 'nonzero')
  vi.stubGlobal('CGRectMake', rect)
  vi.stubGlobal('CGPointMake', (x: number, y: number) => ({ x, y }))
  vi.stubGlobal('CATransform3DMakeScale', (x: number, y: number, z: number) => ({
    x,
    y,
    z,
  }))
  vi.stubGlobal('UIBezierPath', {
    bezierPath: () => ({
      moveToPoint() {},
      addLineToPoint() {},
      closePath() {},
      CGPath: {},
    }),
  })
  const view = createView()
  const native = { bounds: rect(0, 0, 240, 240), layer: { addSublayer: vi.fn() } }
  view.nativeViewProtected = native
  const actual = vi
    .spyOn(view, 'getActualSize')
    .mockReturnValue({ width: 418, height: 418 })
  const painter = iosShape(
    view,
    {
      viewBox: [0, 0, 240, 240],
      fill: 0,
      stroke: 0,
      width: 2,
      cap: 'round',
      join: 'round',
      rule: 'nonzero',
    },
    { path: shapePath('M0 0L240 240'), start: 0, end: 1 },
  )
  expect(layers[0].frame).toEqual(rect(0, 0, 240, 240))
  expect(layers[1].position).toEqual({ x: 120, y: 120 })
  expect(layers[1].transform).toEqual({ x: 1, y: 1, z: 1 })
  native.bounds = rect(5, 8, 120, 180)
  painter.resize()
  expect(layers[0].frame).toEqual(native.bounds)
  expect(layers[1].position).toEqual({ x: 60, y: 90 })
  expect(layers[1].transform.x).toBe(0.5)
  expect(actual).not.toHaveBeenCalled()
  painter.dispose()
})
