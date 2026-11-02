import {
  cssName,
  isTransform,
  isColor,
  isRadius,
  type Property,
  type KeyframeProperty,
  type Scalar,
} from './properties.js'

const canvases = new WeakMap<Document, CanvasRenderingContext2D>()
export function parseColor(document: Document, value: string): number {
  if (/\b(?:var|env)\s*\(|^currentcolor$/i.test(value.trim()))
    throw new TypeError(
      'Color mappings need resolved CSS colors, not target-dependent variables.',
    )
  let context = canvases.get(document)
  if (!context) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    context = canvas.getContext('2d', { willReadFrequently: true })!
    if (!context)
      throw new Error('A 2D canvas context is required to normalize CSS colors.')
    canvases.set(document, context)
  }
  if (!document.defaultView!.CSS.supports('color', value))
    throw new TypeError(`Invalid CSS color: ${value}`)
  context.clearRect(0, 0, 1, 1)
  // Canvas silently ignores unresolved/unsupported syntax. Two sentinels catch
  // that case without mistaking a valid color equal to a sentinel for failure.
  context.fillStyle = '#010203'
  context.fillStyle = value
  const parsed = context.fillStyle
  context.fillStyle = '#040506'
  context.fillStyle = value
  if (context.fillStyle !== parsed)
    throw new TypeError(
      'Color mappings need resolved CSS colors, not target-dependent variables.',
    )
  context.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
  return ((a! << 24) | (r! << 16) | (g! << 8) | b!) >>> 0
}
export function borderBox(
  target: HTMLElement,
  css = target.ownerDocument.defaultView!.getComputedStyle(target),
) {
  const width = parseFloat(css.width),
    height = parseFloat(css.height)
  return {
    width: Number.isFinite(width)
      ? width +
        (css.boxSizing === 'border-box'
          ? 0
          : ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce(
              (n, p) =>
                n + parseFloat((css[p as keyof CSSStyleDeclaration] as string) || '0'),
              0,
            ))
      : target.offsetWidth,
    height: Number.isFinite(height)
      ? height +
        (css.boxSizing === 'border-box'
          ? 0
          : ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce(
              (n, p) =>
                n + parseFloat((css[p as keyof CSSStyleDeclaration] as string) || '0'),
              0,
            ))
      : target.offsetHeight,
  }
}
/** Split CSS components without splitting calc(), color() or var() arguments. */
export function components(value: string) {
  const result: string[] = []
  let depth = 0,
    start = 0
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++
    else if (value[i] === ')') depth--
    else if (!depth && /\s/.test(value[i]!)) {
      if (i > start) result.push(value.slice(start, i))
      start = i + 1
    }
  }
  if (start < value.length) result.push(value.slice(start))
  return result
}
function length(
  target: HTMLElement,
  value: string,
  axis: 'width' | 'height',
  css: CSSStyleDeclaration,
) {
  if (/^-?[\d.]+px$/.test(value) || value === '0') return parseFloat(value)
  const box = borderBox(target, css)
  if (/^-?[\d.]+%$/.test(value)) return (parseFloat(value) * box[axis]) / 100
  const document = target.ownerDocument,
    parent = document.createElement('div'),
    child = document.createElement('div')
  parent.style.cssText = `position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;contain:strict;width:${box[axis]}px;height:0;`
  parent.style.font = css.font
  parent.setAttribute('aria-hidden', 'true')
  parent.inert = true
  child.style.cssText = 'all:initial;display:block;box-sizing:content-box;font:inherit;'
  child.style.width = value
  if (!child.style.width) throw new TypeError(`Invalid CSS length: ${value}`)
  parent.append(child)
  document.documentElement.append(parent)
  try {
    return parseFloat(document.defaultView!.getComputedStyle(child).width)
  } finally {
    parent.remove()
  }
}
export function readProperty(
  target: HTMLElement,
  p: Property,
  css = target.ownerDocument.defaultView!.getComputedStyle(target),
): number {
  if (isTransform(p))
    return p === 'opacity' ? Number(css.opacity) : p.startsWith('scale') ? 1 : 0
  if (isColor(p))
    return parseColor(target.ownerDocument, css.getPropertyValue(cssName(p)))
  if (isRadius(p)) {
    const parts = components(css.getPropertyValue(cssName(p.slice(0, -1))))
    return Math.max(
      0,
      length(
        target,
        parts[p.endsWith('Y') ? 1 : 0] ?? parts[0] ?? '0px',
        p.endsWith('Y') ? 'height' : 'width',
        css,
      ),
    )
  }
  return Math.max(0, parseFloat(css.getPropertyValue(cssName(p))) || 0)
}
/** Resolve browser syntax against the real cascade, without changing a running effect. */
export function resolveProperty(
  target: HTMLElement,
  p: Property,
  source: KeyframeProperty,
  value: Scalar,
): number {
  if (isTransform(p)) {
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new TypeError(`${p} requires finite numbers.`)
    return value
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${p} requires finite values.`)
    if (isColor(p)) return value >>> 0
    return Math.max(0, value)
  }
  const name =
    source.endsWith('RadiusX') || source.endsWith('RadiusY')
      ? cssName(source.slice(0, -1))
      : cssName(source)
  if (!target.ownerDocument.defaultView!.CSS.supports(name, value))
    throw new TypeError(`Invalid ${source}: ${value}`)
  const original = target.style.cssText
  try {
    // Important defeats our WAAPI effect only during this synchronous measurement.
    target.style.setProperty(name, value, 'important')
    return readProperty(target, p)
  } finally {
    target.style.cssText = original
  }
}
