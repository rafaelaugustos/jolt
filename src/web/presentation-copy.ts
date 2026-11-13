import { renderedAncestors } from './geometry.js'
export interface PresentationCopy {
  element: HTMLElement
  rect: DOMRect
}
export function copySpace(element: HTMLElement) {
  const view = element.ownerDocument.defaultView! as Window & typeof globalThis
  for (const node of renderedAncestors(element)) {
    const css = view.getComputedStyle(node),
      matrix = new view.DOMMatrixReadOnly(
        css.transform === 'none' ? undefined : css.transform,
      )
    if (
      !matrix.is2D ||
      matrix.b !== 0 ||
      matrix.c !== 0 ||
      matrix.a <= 0 ||
      matrix.d <= 0 ||
      css.perspective !== 'none' ||
      (css.rotate !== 'none' && css.rotate !== '0deg') ||
      (css.scale !== 'none' && css.scale.split(/\s+/).some((n) => Number(n) <= 0))
    )
      return false
  }
  return true
}
export function presentationCopy(
  element: HTMLElement,
  budget: { remaining: number },
): PresentationCopy {
  const document = element.ownerDocument,
    view = document.defaultView! as Window & typeof globalThis
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height || !copySpace(element))
    throw new Error('unsupported-target')
  // Never clone active documents, custom-element constructors, media/canvas
  // state or form controls. These need a renderer-specific snapshot provider.
  const elements = [element, ...element.querySelectorAll('*')]
  if (
    elements.length > budget.remaining ||
    elements.some(
      (node) =>
        !(node instanceof view.HTMLElement) ||
        node.localName.includes('-') ||
        node.shadowRoot ||
        node.matches(
          'script,style,link,iframe,object,embed,canvas,video,audio,input,textarea,select',
        ) ||
        ['::before', '::after'].some((pseudo) => {
          const content = view.getComputedStyle(node, pseudo).content
          if (
            content === '-moz-alt-content' &&
            node instanceof view.HTMLImageElement &&
            node.complete &&
            node.naturalWidth > 0
          )
            return false
          return content !== 'none' && content !== 'normal' && content !== '""'
        }),
    )
  )
    throw new Error('unsupported-target')
  budget.remaining -= elements.length
  const clone = element.cloneNode(true) as HTMLElement
  const copies = [clone, ...clone.querySelectorAll<HTMLElement>('*')]
  for (let index = 0; index < elements.length; index++) {
    const source = elements[index]!,
      copy = copies[index]!,
      css = view.getComputedStyle(source)
    for (const attribute of [...copy.attributes]) copy.removeAttribute(attribute.name)
    for (const name of css) copy.style.setProperty(name, css.getPropertyValue(name))
    copy.style.animation = 'none'
    copy.style.transition = 'none'
    copy.style.pointerEvents = 'none'
    copy.removeAttribute('id')
    copy.tabIndex = -1
    copy.inert = true
    if (source instanceof view.HTMLImageElement) {
      const image = copy as HTMLImageElement
      image.src = source.currentSrc || source.src
      image.alt = ''
    }
  }
  // Flatten the root's presented translation/scale into a viewport rectangle;
  // child geometry is frozen through computed declarations.
  const width = element.offsetWidth,
    height = element.offsetHeight
  if (!width || !height) throw new Error('unsupported-target')
  Object.assign(clone.style, {
    position: 'absolute',
    inset: 'auto',
    left: '0px',
    top: '0px',
    margin: '0px',
    width: `${width}px`,
    height: `${height}px`,
    minWidth: '0px',
    maxWidth: 'none',
    minHeight: '0px',
    maxHeight: 'none',
    boxSizing: 'border-box',
    transformOrigin: '0px 0px',
    translate: 'none',
    rotate: 'none',
    scale: 'none',
    transform: `scale(${rect.width / width}, ${rect.height / height})`,
  })
  const shell = document.createElement('div')
  shell.dataset.joltSharedCopy = ''
  shell.inert = true
  shell.setAttribute('aria-hidden', 'true')
  Object.assign(shell.style, {
    all: 'initial',
    position: 'absolute',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    transformOrigin: '0px 0px',
    pointerEvents: 'none',
    overflow: 'hidden',
  })
  shell.append(clone)
  return { element: shell, rect }
}
