/** The DOM parent chain can continue beyond an element's rendered coordinate root. */
export function topLayer(element: Element): boolean {
  if (element.matches(':modal') || element === element.ownerDocument.fullscreenElement)
    return true
  try {
    if (element.matches(':popover-open')) return true
  } catch {
    /* Older engines have no popover selector. */
  }
  // Discrete overlay transitions can retain top-layer placement during closing.
  return (
    element.ownerDocument
      .defaultView!.getComputedStyle(element)
      .getPropertyValue('overlay') === 'auto'
  )
}

/** Includes the top-layer root, whose own transform still affects descendants. */
export function* renderedAncestors(target: Element): Generator<Element> {
  let node: Element | null = target
  while (node) {
    yield node
    if (topLayer(node)) return
    node = node.parentElement ?? (node.getRootNode() as ShadowRoot).host ?? null
  }
}

export function identityTransform(element: Element, css: CSSStyleDeclaration): boolean {
  const view = element.ownerDocument.defaultView! as Window & typeof globalThis
  const matrix = new view.DOMMatrixReadOnly(
    css.transform === 'none' ? undefined : css.transform,
  )
  return (
    matrix.isIdentity &&
    (css.translate === 'none' ||
      css.translate.split(/\s+/).every((v) => parseFloat(v) === 0)) &&
    (css.rotate === 'none' || /^(?:z\s+)?0(?:deg|rad|turn|grad)?$/.test(css.rotate)) &&
    (css.scale === 'none' || css.scale.split(/\s+/).every((v) => Number(v) === 1))
  )
}
