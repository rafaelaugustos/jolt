import { GridLayout, StackLayout, Utils, View, unsetValue } from '@nativescript/core'

export type SizeAxis = 'width' | 'height'
export type SizeValue = number | 'auto'
export type SizeValues = Partial<Record<SizeAxis, SizeValue>>
export type SizePixels = Record<SizeAxis, number>

type MeasuredView = View & {
  _currentWidthMeasureSpec?: number
  _currentHeightMeasureSpec?: number
  _oldLeft?: number
  _oldTop?: number
  _oldRight?: number
  _oldBottom?: number
}
const overlays = new WeakMap<View, Map<SizeAxis, object>>()

/** One live tree: speculative measurement never lays out or duplicates its views. */
export function sizeLayout(
  view: View,
  axes: readonly SizeAxis[],
  replacing: readonly SizeAxis[] = [],
  read: () => SizePixels = () => view.getActualSize(),
) {
  const parent = view.parent
  if (
    view.isLoaded &&
    !(parent instanceof StackLayout) &&
    !(parent instanceof GridLayout)
  )
    throw new TypeError('animateSize needs a child of StackLayout or GridLayout.')
  const style = view.style as unknown as Record<string, unknown>
  for (const axis of axes) {
    const initial = view[axis]
    if (
      typeof initial === 'object' &&
      initial !== null &&
      (initial.unit === 'dip' || initial.unit === 'px')
    )
      dimension(initial.value, `initial ${axis}`)
    else dimension(initial, `initial ${axis}`)
    const key = `keyframe:${axis}`
    if (
      !replacing.includes(axis) &&
      style[key] !== unsetValue &&
      style[key] !== undefined
    )
      throw new Error(`animateSize cannot own ${axis} during a CSS keyframe animation.`)
  }
  let writing = false
  let disposed = false
  let claimed = false
  const identity = {}
  const claim = () => {
    if (claimed || disposed) return
    claimed = true
    const current = overlays.get(view) ?? new Map<SizeAxis, object>()
    for (const axis of axes) current.set(axis, identity)
    overlays.set(view, current)
  }
  const owns = (axis: SizeAxis) => overlays.get(view)?.get(axis) === identity
  let releaseHooks = () => {}
  const write = (values: SizeValues) => {
    if (disposed) return
    claim()
    writing = true
    try {
      for (const axis of axes)
        if (owns(axis) && values[axis] !== undefined)
          style[`keyframe:${axis}`] = bounded(view, axis, values[axis]!)
    } finally {
      writing = false
    }
  }
  const clear = () => {
    writing = true
    try {
      for (const axis of axes) if (owns(axis)) style[`keyframe:${axis}`] = unsetValue
    } finally {
      writing = false
    }
  }
  const root = () => {
    let node = view as MeasuredView
    while (node.parent instanceof View && node.parent.typeName !== 'Page')
      node = node.parent as MeasuredView
    return node
  }
  const specs = (node: MeasuredView) => {
    // Core's last layout allocation excludes transforms; UIView.frame does not.
    const cached = [node._oldLeft, node._oldTop, node._oldRight, node._oldBottom]
    const bounds =
      cached.every((value) => Number.isFinite(value)) &&
      cached[2]! > cached[0]! &&
      cached[3]! > cached[1]!
        ? { left: cached[0]!, top: cached[1]!, right: cached[2]!, bottom: cached[3]! }
        : node._getCurrentLayoutBounds()
    const layout = Utils.layout
    return {
      bounds,
      width:
        node._currentWidthMeasureSpec ??
        layout.makeMeasureSpec(Math.max(0, bounds.right - bounds.left), layout.EXACTLY),
      height:
        node._currentHeightMeasureSpec ??
        layout.makeMeasureSpec(Math.max(0, bounds.bottom - bounds.top), layout.EXACTLY),
    }
  }
  const measure = () => {
    const node = root()
    const spec = specs(node)
    view.requestLayout()
    node.measure(spec.width, spec.height)
    return { node, ...spec }
  }
  return {
    read,
    write,
    ready() {
      const { bounds } = specs(root())
      return bounds.right > bounds.left && bounds.bottom > bounds.top
    },
    measure(destination: SizeValues): SizePixels {
      const held = Object.fromEntries(
        axes.map((axis) => [axis, style[`keyframe:${axis}`]]),
      )
      try {
        write(destination)
        measure()
        const dip = Utils.layout.toDeviceIndependentPixels
        return {
          width: dip(view.getMeasuredWidth()),
          height: dip(view.getMeasuredHeight()),
        }
      } finally {
        writing = true
        try {
          for (const axis of axes)
            if (!disposed && owns(axis)) style[`keyframe:${axis}`] = held[axis]
        } finally {
          writing = false
        }
      }
    },
    /** Flush the restored/current declarations before any draw can see probe measurements. */
    layout() {
      const { node, bounds } = measure()
      node.layout(bounds.left, bounds.top, bounds.right, bounds.bottom)
    },
    commit(values?: SizeValues) {
      writing = true
      try {
        if (values)
          for (const axis of axes)
            if (owns(axis) && values[axis] !== undefined)
              view[axis] = bounded(view, axis, values[axis]!)
      } finally {
        writing = false
        clear()
      }
    },
    watch(takeover: () => void) {
      claim()
      const undo: (() => void)[] = []
      releaseHooks = () =>
        undo
          .splice(0)
          .reverse()
          .forEach((off) => off())
      // A local/CSS write hidden under the animation override still takes ownership.
      for (const axis of axes)
        for (const name of [axis, `css:${axis}`, `keyframe:${axis}`]) {
          const own = Object.getOwnPropertyDescriptor(style, name)
          let source: object | null = style
          let descriptor: PropertyDescriptor | undefined
          while (source && !descriptor) {
            descriptor = Object.getOwnPropertyDescriptor(source, name)
            source = Object.getPrototypeOf(source)
          }
          if (!descriptor?.set || !descriptor.get || own?.configurable === false)
            throw new Error(`animateSize cannot observe ownership of ${name}.`)
          const original = descriptor
          const set = function (this: object, value: unknown) {
            if (!writing) takeover()
            original.set!.call(this, value)
          }
          Object.defineProperty(style, name, {
            configurable: true,
            get: original.get,
            set,
          })
          undo.push(() => {
            if (Object.getOwnPropertyDescriptor(style, name)?.set !== set) return
            if (own) Object.defineProperty(style, name, own)
            else delete style[name]
          })
        }
    },
    dispose() {
      disposed = true
      releaseHooks()
      clear()
      const current = overlays.get(view)
      for (const axis of axes) if (owns(axis)) current!.delete(axis)
      if (!current?.size) overlays.delete(view)
    },
  }
}

function bounded(view: View, axis: SizeAxis, value: SizeValue): SizeValue {
  if (value === 'auto') return value
  const minimum = axis === 'width' ? view.minWidth : view.minHeight
  const maximum = axis === 'width' ? view.maxWidth : view.maxHeight
  const dip = Utils.layout.toDeviceIndependentPixels
  const min =
    typeof minimum === 'number'
      ? minimum
      : dip((axis === 'width' ? view.effectiveMinWidth : view.effectiveMinHeight) ?? 0)
  const max =
    typeof maximum === 'number'
      ? maximum
      : dip(
          (axis === 'width' ? view.effectiveMaxWidth : view.effectiveMaxHeight) ??
            Infinity,
        )
  return Math.min(max, Math.max(0, min, value))
}

export function dimension(value: unknown, label: string): asserts value is SizeValue {
  if (
    value !== 'auto' &&
    (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
  )
    throw new RangeError(
      `animateSize ${label} must be a nonnegative finite DIP number or "auto"; percentages and unit objects are unsupported.`,
    )
}
