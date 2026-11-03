export interface StyleConflict {
  readonly property: string
  readonly previous: string
  readonly current: string
}

/** Keep diagnostics useful without retaining the DOM node after disposal. */
export function surfaceConflict(target: HTMLElement, changes: StyleConflict[]) {
  const escape = (value: string) => target.ownerDocument.defaultView!.CSS.escape(value)
  const element =
    target.localName +
    (target.id
      ? `#${escape(target.id)}`
      : [...target.classList]
          .slice(0, 3)
          .map((name) => `.${escape(name)}`)
          .join(''))
  const geometry = changes.some((change) =>
    ['width', 'height', 'transform-origin'].includes(change.property),
  )
  const describe = (value: string) =>
    JSON.stringify(value.length > 180 ? value.slice(0, 180) + '…' : value)
  const details = changes
    .map(
      ({ property, previous, current }) =>
        `${property}: ${describe(previous)} → ${describe(current)}`,
    )
    .join('; ')
  const guidance = geometry
    ? 'For intended size/origin changes, call runtime.observeGeometry(element) before layout changes, or runtime.refresh(element) after them. For other external style/animation ownership changes, release and recreate the surface.'
    : 'Release the element with runtime.release(element), apply the external styles, then recreate its motion bindings or animations.'
  return Object.assign(
    new Error(`External style changes on ${element}: ${details}. ${guidance}`),
    {
      name: 'WebSurfaceConflictError',
      element,
      changes: changes.map((change) => Object.freeze({ ...change })),
    },
  )
}
