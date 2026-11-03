import { EffectStyles, effectOwnership, effectTarget, type EffectHost } from './effect.js'

const ns = 'http://www.w3.org/2000/svg'
let serial = 0
export function imageTarget(target: HTMLImageElement, host: EffectHost) {
  const view = effectTarget(target, host)
  if (!(target instanceof view.HTMLImageElement))
    throw new TypeError('Image effects need an HTMLImageElement.')
  return view
}
export function svgNode<K extends keyof SVGElementTagNameMap>(
  document: Document,
  tag: K,
  attributes: Record<string, string | number> = {},
) {
  const node = document.createElementNS(ns, tag)
  for (const [key, value] of Object.entries(attributes))
    node.setAttribute(key, String(value))
  return node
}
/** Filter input stays the original image: no DOM clone, layout change or hit target. */
export class ImageSurface {
  readonly svg: SVGSVGElement
  readonly filter: SVGFilterElement
  private styles: EffectStyles
  private off: () => void = () => {}
  private source: string
  private srcset: string
  private src: string | null
  private sizes: string
  private observer?: MutationObserver
  private base = ''
  private ended = false
  frames = 0
  constructor(
    readonly target: HTMLImageElement,
    readonly host: EffectHost,
    stop: () => void,
  ) {
    const view = imageTarget(target, host)
    this.source = target.currentSrc || target.src
    this.srcset = target.srcset
    this.src = target.getAttribute('src')
    this.sizes = target.sizes
    this.styles = new EffectStyles(target)
    this.svg = svgNode(host.document, 'svg', {
      width: 0,
      height: 0,
      'aria-hidden': 'true',
      'data-jolt-effect': 'image-filter',
    })
    this.svg.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden;'
    this.filter = svgNode(host.document, 'filter', {
      id: `jolt-image-${++serial}`,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      filterUnits: 'objectBoundingBox',
      primitiveUnits: 'objectBoundingBox',
      'color-interpolation-filters': 'sRGB',
    })
    this.svg.append(this.filter)
    try {
      this.off = effectOwnership(target, 'filter', host, stop)
      const css = view.getComputedStyle(target).filter
      this.base = css === 'none' ? '' : css
      // Keep the filter in the same tree scope, including shadow-root hosts.
      const root = target.getRootNode()
      ;(root === host.document ? host.document.body : root).appendChild(this.svg)
      this.observer = new view.MutationObserver(() => {
        if (!this.valid()) stop()
      })
      this.observer.observe(target, {
        attributes: true,
        attributeFilter: ['src', 'srcset', 'sizes', 'style'],
      })
    } catch (error) {
      this.dispose()
      throw error
    }
  }
  apply(enabled = true) {
    if (this.ended) return
    const url = new URL(`#${this.filter.id}`, this.host.document.URL).href
    this.styles.set(
      'filter',
      enabled ? `url(${JSON.stringify(url)}) ${this.base}`.trim() : this.base || 'none',
    )
    this.frames++
  }
  valid() {
    return (
      !this.ended &&
      this.target.isConnected &&
      this.svg.isConnected &&
      this.styles.owns() &&
      this.target.ownerDocument === this.host.document &&
      (this.target.currentSrc || this.target.src) === this.source &&
      this.target.srcset === this.srcset &&
      this.target.getAttribute('src') === this.src &&
      this.target.sizes === this.sizes
    )
  }
  dispose() {
    if (this.ended) return
    this.ended = true
    this.observer?.disconnect()
    this.styles.restore()
    this.svg.remove()
    this.filter.replaceChildren()
    this.off()
  }
}

export function imageFallback(
  target: HTMLImageElement,
  host: EffectHost,
): string | undefined {
  const view = imageTarget(target, host)
  if (
    !target.complete ||
    !target.naturalWidth ||
    !target.clientWidth ||
    !target.clientHeight
  )
    return 'image-not-ready'
  if (
    target.clientWidth * target.clientHeight * (view.devicePixelRatio || 1) ** 2 >
    4194304
  )
    return 'surface-too-large'
  if (!view.SVGFEImageElement || !view.CSS.supports('filter', 'url("#jolt")'))
    return 'svg-filter-unavailable'
  return undefined
}

/** A small raster displacement field, bounded independently of source dimensions. */
export class DisplacementMap {
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private data: ImageData
  private input: SVGFEImageElement
  private displacement: SVGFEDisplacementMapElement
  readonly size = 48
  constructor(readonly surface: ImageSurface) {
    this.canvas = surface.host.document.createElement('canvas')
    this.canvas.width = this.canvas.height = this.size
    const context = this.canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D is unavailable for the displacement map.')
    this.context = context
    this.data = context.createImageData(this.size, this.size)
    this.input = svgNode(surface.host.document, 'feImage', {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      preserveAspectRatio: 'none',
      result: 'map',
    })
    this.displacement = svgNode(surface.host.document, 'feDisplacementMap', {
      in: 'SourceGraphic',
      in2: 'map',
      scale: 0.32,
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    })
    surface.filter.append(this.input, this.displacement)
  }
  paint(
    displace: (x: number, y: number, index: number) => readonly [number, number],
    enabled = true,
  ) {
    if (!enabled) {
      this.surface.apply(false)
      return
    }
    const pixels = this.data.data
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        const index = y * this.size + x
        const [dx, dy] = displace(x / (this.size - 1), y / (this.size - 1), index)
        pixels[index * 4] = Math.round(255 * (0.5 + dx / 0.32))
        pixels[index * 4 + 1] = Math.round(255 * (0.5 + dy / 0.32))
        pixels[index * 4 + 2] = 0
        pixels[index * 4 + 3] = 255
      }
    this.context.putImageData(this.data, 0, 0)
    this.input.setAttribute('href', this.canvas.toDataURL())
    this.surface.apply()
  }
}
