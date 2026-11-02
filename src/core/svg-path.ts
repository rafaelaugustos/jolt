/** SVG path geometry in local DIPs. No DOM or platform path API is used. */
export interface PathPoint {
  x: number
  y: number
}
export interface PathPose extends PathPoint {
  rotate: number
}
type Segment = {
  point(t: number): PathPoint
  tangent(t: number): PathPoint
  angle?: number
}
type Vertex = PathPoint & {
  segment: number
  t: number
  distance: number
  heading: number
}
export interface MotionPath {
  readonly length: number
  at(progress: number): PathPose
}
const LIMIT = 1_000_000
const MAX_SEGMENTS = 1024
const MAX_VERTICES = 8192
const TOLERANCE = 0.025
const distance = (a: PathPoint, b: PathPoint) => Math.hypot(b.x - a.x, b.y - a.y)
const mix = (a: PathPoint, b: PathPoint, t: number): PathPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})
const checked = (p: PathPoint) => {
  if (![p.x, p.y].every((n) => Number.isFinite(n) && Math.abs(n) <= LIMIT))
    throw new RangeError('Path coordinates must stay within ±1000000 DIPs.')
  return p
}
const unwrap = (angle: number, reference: number) =>
  angle + 360 * Math.round((reference - angle) / 360)

export class Scanner {
  index = 0
  private hasNumber = false
  constructor(readonly text: string) {}
  peek() {
    while (/[\t\n\r ]/.test(this.text[this.index] ?? '\0')) this.index++
    return this.text[this.index]
  }
  command() {
    const value = this.peek()!
    this.index++
    this.hasNumber = false
    return value
  }
  number(flag = false) {
    this.peek()
    if (this.text[this.index] === ',') {
      if (!this.hasNumber) this.error()
      this.index++
      this.peek()
    }
    const rest = this.text.slice(this.index)
    const token = flag
      ? /^[01]/.exec(rest)?.[0]
      : /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(rest)?.[0]
    if (!token) this.error()
    const value = Number(token)
    if (!Number.isFinite(value) || Math.abs(value) > LIMIT)
      throw new RangeError('Path numbers must be finite and within ±1000000.')
    this.index += token!.length
    this.hasNumber = true
    return value
  }
  error(): never {
    throw new SyntaxError(`Invalid SVG path at character ${this.index}.`)
  }
}

function line(a: PathPoint, b: PathPoint): Segment {
  return { point: (t) => mix(a, b, t), tangent: () => ({ x: b.x - a.x, y: b.y - a.y }) }
}
function bezier(points: readonly PathPoint[]): Segment {
  const evaluate = (values: readonly PathPoint[], t: number): PathPoint => {
    let row = [...values]
    while (row.length > 1) row = row.slice(1).map((p, i) => mix(row[i]!, p, t))
    return row[0]!
  }
  const derivative = points.slice(1).map((p, i) => ({
    x: (p.x - points[i]!.x) * (points.length - 1),
    y: (p.y - points[i]!.y) * (points.length - 1),
  }))
  return { point: (t) => evaluate(points, t), tangent: (t) => evaluate(derivative, t) }
}

/** Endpoint-to-center conversion: https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter */
export function arc(
  a: PathPoint,
  b: PathPoint,
  rx: number,
  ry: number,
  degrees: number,
  large: boolean,
  sweep: boolean,
): Segment {
  rx = Math.abs(rx)
  ry = Math.abs(ry)
  if (!rx || !ry || distance(a, b) === 0) return line(a, b)
  const phi = ((degrees % 360) * Math.PI) / 180,
    cos = Math.cos(phi),
    sin = Math.sin(phi)
  const dx = (a.x - b.x) / 2,
    dy = (a.y - b.y) / 2
  const xp = cos * dx + sin * dy,
    yp = -sin * dx + cos * dy
  const correction = Math.max(1, Math.hypot(xp / rx, yp / ry))
  rx *= correction
  ry *= correction
  const u = xp / rx,
    v = yp / ry,
    norm = u * u + v * v
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (1 - norm) / norm))
  const cxp = factor * rx * v,
    cyp = -factor * ry * u
  const cx = cos * cxp - sin * cyp + (a.x + b.x) / 2,
    cy = sin * cxp + cos * cyp + (a.y + b.y) / 2
  const ux = (xp - cxp) / rx,
    uy = (yp - cyp) / ry,
    vx = (-xp - cxp) / rx,
    vy = (-yp - cyp) / ry
  const start = Math.atan2(uy, ux)
  let delta = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  if (!sweep && delta > 0) delta -= 2 * Math.PI
  if (sweep && delta < 0) delta += 2 * Math.PI
  if (![cx, cy, rx, ry, start, delta].every(Number.isFinite))
    throw new RangeError('Path arc exceeds finite geometry limits.')
  return {
    angle: delta,
    point(t) {
      if (t === 0) return a
      if (t === 1) return b
      const angle = start + t * delta,
        x = rx * Math.cos(angle),
        y = ry * Math.sin(angle)
      return checked({ x: cx + cos * x - sin * y, y: cy + sin * x + cos * y })
    },
    tangent(t) {
      const angle = start + t * delta,
        x = -rx * Math.sin(angle) * delta,
        y = ry * Math.cos(angle) * delta
      return { x: cos * x - sin * y, y: sin * x + cos * y }
    },
  }
}

export function parsePath(data: string): MotionPath {
  if (typeof data !== 'string' || !data.trim())
    throw new TypeError('Path must be a nonempty SVG path string.')
  if (data.length > 100_000)
    throw new RangeError('SVG path is too long (100000 characters maximum).')
  const scanner = new Scanner(data)
  const segments: Segment[] = []
  let current: PathPoint = { x: 0, y: 0 },
    first: PathPoint | undefined
  let command = '',
    previous = '',
    control: PathPoint = current
  const add = (segment: Segment, end: PathPoint) => {
    if (segments.length >= MAX_SEGMENTS)
      throw new RangeError('SVG path has too many segments (1024 maximum).')
    segments.push(segment)
    current = checked(end)
  }
  while (scanner.peek() !== undefined) {
    const token = scanner.peek()!
    if (/[a-z]/i.test(token)) {
      command = scanner.command()
      if (!/[mlhvcsqtaz]/i.test(command)) scanner.error()
    } else if (!command) scanner.error()
    const upper = command.toUpperCase(),
      relative = command !== upper,
      origin = current
    const point = () =>
      checked({
        x: scanner.number() + (relative ? origin.x : 0),
        y: scanner.number() + (relative ? origin.y : 0),
      })
    if (!first && upper !== 'M') throw new SyntaxError('SVG path must start with M or m.')
    if (upper === 'M') {
      if (first)
        throw new SyntaxError(
          'Motion paths support one continuous subpath; use a single M command.',
        )
      first = current = point()
      command = relative ? 'l' : 'L'
    } else if (upper === 'Z') {
      add(line(current, first!), first!)
      command = ''
    } else if (upper === 'L') {
      const end = point()
      add(line(current, end), end)
    } else if (upper === 'H' || upper === 'V') {
      const n = scanner.number(),
        end = checked(
          upper === 'H'
            ? { x: n + (relative ? origin.x : 0), y: current.y }
            : { x: current.x, y: n + (relative ? origin.y : 0) },
        )
      add(line(current, end), end)
    } else if (upper === 'C' || upper === 'S') {
      const c1 =
        upper === 'C'
          ? point()
          : /[CS]/.test(previous)
            ? { x: 2 * current.x - control.x, y: 2 * current.y - control.y }
            : current
      const c2 = point(),
        end = point()
      checked(c1)
      add(bezier([current, c1, c2, end]), end)
      control = c2
    } else if (upper === 'Q' || upper === 'T') {
      const c =
        upper === 'Q'
          ? point()
          : /[QT]/.test(previous)
            ? { x: 2 * current.x - control.x, y: 2 * current.y - control.y }
            : current
      const end = point()
      checked(c)
      add(bezier([current, c, end]), end)
      control = c
    } else if (upper === 'A') {
      const rx = scanner.number(),
        ry = scanner.number(),
        rotation = scanner.number(),
        large = scanner.number(true),
        sweep = scanner.number(true),
        end = point()
      add(arc(current, end, rx, ry, rotation, !!large, !!sweep), end)
    }
    previous = upper
  }
  return measure(first!, segments)
}

function measure(first: PathPoint, segments: readonly Segment[]): MotionPath {
  const vertices: Vertex[] = [{ ...first, segment: -1, t: 0, distance: 0, heading: 0 }]
  const heading = (segment: Segment, t: number, fallback: PathPoint) => {
    let v = segment.tangent(t)
    if (Math.hypot(v.x, v.y) < 1e-9) {
      const a = segment.point(Math.max(0, t - 1e-5)),
        b = segment.point(Math.min(1, t + 1e-5))
      v = { x: b.x - a.x, y: b.y - a.y }
      if (Math.hypot(v.x, v.y) < 1e-9) v = fallback
    }
    return (Math.atan2(v.y, v.x) * 180) / Math.PI
  }
  const append = (p: PathPoint, index: number, t: number) => {
    const last = vertices.at(-1)!,
      length = distance(last, p)
    if (!length) return
    if (vertices.length >= MAX_VERTICES)
      throw new RangeError('Path needs too many geometry samples (8192 maximum).')
    const direction = { x: p.x - last.x, y: p.y - last.y }
    const start = heading(
      segments[index]!,
      last.segment === index ? last.t : 0,
      direction,
    )
    if (vertices.length === 1) last.heading = start
    const angle = unwrap(
      heading(segments[index]!, t, direction),
      unwrap(start, last.heading),
    )
    vertices.push({
      ...checked(p),
      segment: index,
      t,
      distance: last.distance + length,
      heading: angle,
    })
  }
  segments.forEach((segment, index) => {
    const flatten = (
      t0: number,
      t1: number,
      a: PathPoint,
      b: PathPoint,
      depth: number,
    ) => {
      const span = t1 - t0,
        q1 = segment.point(t0 + span * 0.25),
        mid = segment.point(t0 + span * 0.5),
        q3 = segment.point(t0 + span * 0.75)
      const poly =
          distance(a, q1) + distance(q1, mid) + distance(mid, q3) + distance(q3, b),
        chord = distance(a, b)
      const deviation = Math.max(
        distance(q1, mix(a, b, 0.25)),
        distance(mid, mix(a, b, 0.5)),
        distance(q3, mix(a, b, 0.75)),
      )
      const directions = [
        t0,
        t0 + span * 0.25,
        t0 + span * 0.5,
        t0 + span * 0.75,
        t1,
      ].map((t) => segment.tangent(t))
      const turn = directions.some((v, i) => {
        const before = directions[i - 1]
        return (
          before &&
          Math.hypot(v.x, v.y) > 1e-12 &&
          Math.hypot(before.x, before.y) > 1e-12 &&
          Math.abs(
            Math.atan2(before.x * v.y - before.y * v.x, before.x * v.x + before.y * v.y),
          ) >
            Math.PI / 8
        )
      })
      const flat = poly - chord <= TOLERANCE && deviation <= TOLERANCE
      if (flat && (!turn || depth >= 18)) {
        append(b, index, t1)
        return
      }
      if (depth >= 18)
        throw new RangeError('Path geometry exceeds the sampling precision limit.')
      flatten(t0, (t0 + t1) / 2, a, mid, depth + 1)
      flatten((t0 + t1) / 2, t1, mid, b, depth + 1)
    }
    flatten(0, 1, segment.point(0), segment.point(1), 0)
  })
  const length = vertices.at(-1)!.distance
  return {
    length,
    at(progress) {
      if (!length) return { ...first, rotate: 0 }
      const target = Math.max(0, Math.min(1, progress)) * length
      let low = 1,
        high = vertices.length - 1
      while (low < high) {
        const middle = (low + high) >>> 1
        if (vertices[middle]!.distance <= target) low = middle + 1
        else high = middle
      }
      const b = vertices[low]!,
        a = vertices[low - 1]!,
        fraction = Math.max(
          0,
          Math.min(1, (target - a.distance) / (b.distance - a.distance)),
        )
      const point = mix(a, b, fraction),
        t0 = a.segment === b.segment ? a.t : 0,
        t = t0 + (b.t - t0) * fraction
      const angle = heading(segments[b.segment]!, t, { x: b.x - a.x, y: b.y - a.y })
      return { ...point, rotate: unwrap(angle, b.heading) }
    },
  }
}
