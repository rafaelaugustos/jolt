export interface ScrollHeaderGeometry {
  expanded: number
  minimum: number
  section: number
  range: number
  spacer: number
  rowHeight: number
  parallax: number
  divider: number
  handoff: number
  titleFade: readonly [number, number]
  toolbarFade: readonly [number, number]
}

export function headerGeometry(
  expanded: number,
  minimum: number,
  section: number,
  rowHeight: number,
  parallax: number,
  divider = 0,
  titleFade: readonly [number, number] = [0, 0.7],
  toolbarFade: readonly [number, number] = [0.55, 0.95],
): ScrollHeaderGeometry {
  if (
    ![expanded, minimum, section, rowHeight, parallax, divider].every(Number.isFinite) ||
    divider < 0 ||
    minimum <= 0 ||
    expanded <= minimum ||
    section < 0 ||
    rowHeight <= 0 ||
    parallax < 0 ||
    parallax > expanded - minimum
  )
    throw new RangeError(
      'scrollHeader needs expanded > minimum > 0, a positive rowHeight, and parallax within the collapse range.',
    )
  for (const interval of [titleFade, toolbarFade]) {
    if (
      !Array.isArray(interval) ||
      interval.length !== 2 ||
      !interval.every(Number.isFinite) ||
      interval[0] < 0 ||
      interval[1] > 1 ||
      interval[0] >= interval[1]
    )
      throw new RangeError('Fade intervals must increase within [0, 1].')
  }
  return {
    divider,
    handoff: (toolbarFade[0] + toolbarFade[1]) / 2,
    titleFade: [...titleFade],
    toolbarFade: [...toolbarFade],
    expanded,
    minimum,
    section,
    rowHeight,
    parallax,
    range: expanded - minimum,
    spacer: expanded + section,
  }
}

/** Keep the visible rows anchored when late artwork/text changes the header height. */
export function resizedOffset(
  offset: number,
  before: ScrollHeaderGeometry,
  after: ScrollHeaderGeometry,
) {
  return offset <= 0 ? 0 : Math.max(0, offset + after.spacer - before.spacer)
}

export function restoredOffset(
  offset: number,
  before: ScrollHeaderGeometry,
  after: ScrollHeaderGeometry,
  previousIndex: number,
  nextIndex: number,
) {
  if (offset <= 0) return 0
  return Math.max(
    0,
    offset +
      after.spacer -
      before.spacer +
      (nextIndex - previousIndex) * (after.rowHeight + after.divider),
  )
}
