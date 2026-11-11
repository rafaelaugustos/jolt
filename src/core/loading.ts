/**
 * Durations and geometry of the loading effects, shared by the NativeScript, Web and
 * SwiftUI adapters. Lengths are DIPs, CSS px or points; times are milliseconds.
 */
export type LoaderStyle = 'dots' | 'bars' | 'ring'

export interface LoaderKind {
  /** Copies drawn by one source item. */
  readonly count: number
  /** Item width and height as fractions of the loader's side. */
  readonly width: number
  readonly height: number
  /** Each copy starts `duration / stagger` after the previous one. */
  readonly stagger: number
  readonly property: 'scale' | 'scaleY' | 'opacity'
  /** Keyframes of the animated property, linear between `times` (fractions of a cycle). */
  readonly values: readonly number[]
  readonly times: readonly number[]
  /** Item opacity when the property is not animated, including under reduced motion. */
  readonly rest: number
}

export const shimmerDefinition = {
  duration: 1500,
  /** Web and SwiftUI: a white band painted over the content. */
  highlight: {
    /** CSS degrees: 90 runs left to right. */
    angle: 100,
    /** Percent positions of the band's stops. */
    stops: [15, 50, 85],
    /** White opacity at each stop. */
    opacity: [0, 0.55, 0],
    /** Horizontal travel in widths of the view, from the first to the last frame. */
    travel: [-1, 1],
  },
  /** NativeScript iOS: a mask three widths wide dims the content outside the band. */
  mask: { opacity: 0.35, from: [0, 0.125, 0.25], to: [0.75, 0.875, 1] },
} as const

export const loaderDefinition = {
  style: 'dots' as LoaderStyle,
  color: '#71717a',
  /** Maximum side, fitted inside the target. */
  size: 48,
  duration: 1200,
  kinds: {
    dots: {
      count: 3,
      width: 0.2,
      height: 0.2,
      stagger: 5,
      property: 'scale',
      values: [0.35, 1, 0.35, 0.35],
      times: [0, 0.3, 0.6, 1],
      rest: 1,
    },
    bars: {
      count: 5,
      width: 0.12,
      height: 0.75,
      stagger: 5,
      property: 'scaleY',
      values: [0.35, 1, 0.35, 0.35],
      times: [0, 0.3, 0.6, 1],
      rest: 1,
    },
    ring: {
      count: 12,
      width: 0.16,
      height: 0.16,
      stagger: 12,
      property: 'opacity',
      values: [1, 0.2],
      times: [0, 1],
      rest: 0.35,
    },
  } satisfies Record<LoaderStyle, LoaderKind>,
  /** The Web draws CSS boxes instead: percent sizes of the box and an eased pulse. */
  css: {
    dots: { width: 20, height: 20, radius: '50%' },
    bars: { width: 12, height: 65, radius: '3px' },
    ring: { diameter: 75, border: 3 },
    pulse: 0.45,
    stagger: 7,
    ease: 'ease-in-out',
  },
} as const

export const revealDefinition = { duration: 400, ease: 'easeInOut' } as const

export interface LoaderItem {
  /** Centre in the loader's square, from its top-left corner. */
  x: number
  y: number
  width: number
  height: number
  /** Degrees clockwise around the square's centre. */
  rotate: number
  scaleX: number
  scaleY: number
  opacity: number
}

function keyframe(kind: LoaderKind, phase: number) {
  const { times, values } = kind
  for (let i = 1; i < times.length; i++)
    if (phase <= times[i]!) {
      const span = times[i]! - times[i - 1]!
      const t = span > 0 ? (phase - times[i - 1]!) / span : 1
      return values[i - 1]! + (values[i]! - values[i - 1]!) * t
    }
  return values[values.length - 1]!
}

/**
 * Every copy of a loader drawn in a `size` square. Without `elapsed`, the static pose
 * shown under reduced motion. Copy `i` runs `i * duration / stagger` behind the first.
 */
export function loaderItems(
  style: LoaderStyle,
  size: number,
  elapsed?: number,
  duration: number = loaderDefinition.duration,
): LoaderItem[] {
  const kind: LoaderKind = loaderDefinition.kinds[style]
  const width = size * kind.width
  const height = size * kind.height
  return Array.from({ length: kind.count }, (_, i) => {
    let value: number | undefined
    if (elapsed !== undefined) {
      const local = (elapsed - (i * duration) / kind.stagger) % duration
      value = keyframe(kind, (local < 0 ? local + duration : local) / duration)
    }
    const scale = kind.property === 'opacity' ? 1 : (value ?? 1)
    const ring = style === 'ring'
    const angle = ring ? (360 / kind.count) * i : 0
    const radians = (angle * Math.PI) / 180
    const orbit = size / 2 - height / 2
    return {
      x: ring
        ? size / 2 + orbit * Math.sin(radians)
        : width / 2 + (i * (size - width)) / (kind.count - 1),
      y: ring ? size / 2 - orbit * Math.cos(radians) : size / 2,
      width,
      height,
      rotate: angle,
      scaleX: kind.property === 'scale' ? scale : 1,
      scaleY: scale,
      opacity: kind.property === 'opacity' ? (value ?? kind.rest) : kind.rest,
    }
  })
}

/** Horizontal offset of the shimmer band, in widths of the view. */
export function shimmerOffset(
  elapsed: number,
  duration: number = shimmerDefinition.duration,
) {
  const [from, to] = shimmerDefinition.highlight.travel
  const local = elapsed % duration
  return from + (to - from) * ((local < 0 ? local + duration : local) / duration)
}

/** The radius that reaches the farthest corner of a box from `x`, `y`. */
export function revealRadius(width: number, height: number, x: number, y: number) {
  return Math.max(
    Math.hypot(x, y),
    Math.hypot(width - x, y),
    Math.hypot(x, height - y),
    Math.hypot(width - x, height - y),
  )
}
