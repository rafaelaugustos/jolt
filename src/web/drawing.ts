import {
  drawingPatch,
  drawingSnapshot,
  drawingUpdate,
  prepareDrawing,
  type Drawing,
  type DrawingOptions,
  type DrawingState,
} from '../core/drawing.js'
import { pathString } from '../core/shape-path.js'
import { decorativeLayer, effectTarget, positioned, type EffectHost } from './effect.js'
import { colorCSS } from './properties.js'
import { parseColor } from './style.js'
const owners = new WeakSet<HTMLElement>()

/** Ordered SVG paths preserve per-item fill/stroke and alpha compositing. */
export function createDrawing(
  target: HTMLElement,
  options: DrawingOptions,
  host: EffectHost,
): Drawing {
  effectTarget(target, host)
  if (owners.has(target)) throw new Error('This target already owns a drawing surface.')
  const color = (value: string) => parseColor(host.document, value)
  let state = prepareDrawing(options, color),
    painted: DrawingState | undefined
  let layer = decorativeLayer(target, 'drawing')
  let svg = host.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', state.viewBox.join(' '))
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.style.cssText = 'display:block;overflow:hidden'
  layer.append(svg)
  let nodes = new Map<string, SVGPathElement>()
  let ended = false,
    held = false
  const off: (() => void)[] = []
  const valid = () =>
    !ended &&
    target.isConnected &&
    target.ownerDocument === host.document &&
    layer.parentNode === target &&
    svg.parentNode === layer
  const blocked = () => held || !!host?.document.hidden
  const paint = (next: DrawingState) => {
    if (blocked()) {
      state = next
      return
    }
    const prior = new Map(painted?.items.map((item) => [item.id, item]))
    const oldStyles = new Map(
      painted?.styles.map((style) => [style.id, JSON.stringify(style)]),
    )
    const styles = new Map(next.styles.map((style) => [style.id, style]))
    const prepared = new Map<string, SVGPathElement>()
    // All geometry and styles were validated before preparing replacement nodes.
    for (const item of next.items) {
      const style = styles.get(item.style)!
      let node = nodes.get(item.id)
      if (
        !node ||
        prior.get(item.id) !== item ||
        oldStyles.get(item.style) !== JSON.stringify(style)
      ) {
        node = host.document.createElementNS(svg.namespaceURI!, 'path') as SVGPathElement
        node.dataset.joltItem = item.id
        node.setAttribute('d', pathString(item.path))
        node.setAttribute('fill', colorCSS(style.fill))
        node.setAttribute('stroke', colorCSS(style.stroke))
        node.setAttribute('stroke-width', String(style.width))
        node.setAttribute('stroke-linecap', style.cap)
        node.setAttribute('stroke-linejoin', style.join)
        node.setAttribute('fill-rule', style.rule)
      }
      prepared.set(item.id, node)
    }
    for (const [id, node] of nodes) if (prepared.get(id) !== node) node.remove()
    let cursor = svg.firstElementChild
    for (const node of prepared.values()) {
      if (node !== cursor) svg.insertBefore(node, cursor)
      cursor = node.nextElementSibling
    }
    nodes = prepared
    state = painted = next
  }
  const dispose = () => {
    if (ended) return
    ended = true
    layer.remove()
    nodes.clear()
    painted = undefined
    state = {
      ...state,
      items: [],
      styles: [],
      sourceStyles: {},
      commands: 0,
      components: 0,
    }
    owners.delete(target)
    for (const release of off.splice(0).reverse()) release()
    svg.replaceChildren()
    layer.replaceChildren()
    target = undefined!
    layer = undefined!
    svg = undefined!
    host = undefined!
  }
  const alive = () => {
    if (ended || !valid()) {
      dispose()
      throw new Error('Drawing is disposed or detached.')
    }
  }
  const drawing: Drawing = {
    get disposed() {
      return ended
    },
    get suspended() {
      return blocked()
    },
    set(values) {
      alive()
      paint(drawingUpdate(state, values, color))
    },
    update(items) {
      alive()
      paint(drawingPatch(state, items, color))
    },
    snapshot: () => drawingSnapshot(state, !ended && valid()),
    suspend() {
      if (!ended) held = true
    },
    resume() {
      if (!ended) {
        alive()
        held = false
        paint(state)
      }
    },
    dispose,
  }
  owners.add(target)
  try {
    off.push(positioned(target))
    target.append(layer)
    paint(state)
    off.push(
      host.visibility(() => {
        if (!ended && !blocked()) paint(state)
      }),
    )
    off.push(
      host.register(
        target,
        {
          get disposed() {
            return ended
          },
          get paused() {
            return held
          },
          pause: drawing.suspend,
          play: drawing.resume,
          cancel() {},
          dispose,
        },
        () => {
          if (!valid()) dispose()
        },
      ),
    )
  } catch (error) {
    dispose()
    throw error
  }
  return drawing
}
