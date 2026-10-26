import { Scanner, arc, type PathPoint } from '../svg-path.js'

/** Absolute M/L/C/Q/Z commands, shared by both native renderers. */
export interface ShapePath {
  commands: string
  points: number[]
  contours: number
}
export function shapePath(d: string): ShapePath {
  if (typeof d !== 'string' || !d.trim())
    throw new TypeError('Shape d must be a nonempty SVG path.')
  if (d.length > 20000) throw new RangeError('Shape path exceeds 20000 characters.')
  const scanner = new Scanner(d),
    result: ShapePath = { commands: '', points: [], contours: 0 }
  let current = { x: 0, y: 0 },
    first: PathPoint | undefined,
    control = current
  let command = '',
    previous = ''
  const add = (op: string, ...points: PathPoint[]) => {
    if (result.commands.length >= 256)
      throw new RangeError('Shapes support at most 256 normalized commands.')
    result.commands += op
    for (const p of points) {
      if (![p.x, p.y].every((n) => Number.isFinite(n) && Math.abs(n) <= 1000000))
        throw new RangeError('Shape coordinates must stay within ±1000000.')
      result.points.push(p.x, p.y)
    }
    if (points.length) current = points.at(-1)!
  }
  while (scanner.peek() !== undefined) {
    if (/[a-z]/i.test(scanner.peek()!)) command = scanner.command()
    else if (!command) scanner.error()
    const upper = command.toUpperCase(),
      relative = command !== upper,
      origin = current
    const point = () => ({
      x: scanner.number() + (relative ? origin.x : 0),
      y: scanner.number() + (relative ? origin.y : 0),
    })
    if (!first && upper !== 'M')
      throw new SyntaxError('Shape path must start with M or m.')
    if (upper === 'M') {
      first = point()
      add('M', first)
      result.contours++
      command = relative ? 'l' : 'L'
    } else if (upper === 'L') add('L', point())
    else if (upper === 'H' || upper === 'V') {
      const n = scanner.number()
      add(
        'L',
        upper === 'H'
          ? { x: n + (relative ? origin.x : 0), y: current.y }
          : { x: current.x, y: n + (relative ? origin.y : 0) },
      )
    } else if (upper === 'C' || upper === 'S') {
      const c1 =
        upper === 'C'
          ? point()
          : /[CS]/.test(previous)
            ? { x: 2 * current.x - control.x, y: 2 * current.y - control.y }
            : current
      const c2 = point(),
        end = point()
      add('C', c1, c2, end)
      control = c2
    } else if (upper === 'Q' || upper === 'T') {
      const c =
        upper === 'Q'
          ? point()
          : /[QT]/.test(previous)
            ? { x: 2 * current.x - control.x, y: 2 * current.y - control.y }
            : current
      add('Q', c, point())
      control = c
    } else if (upper === 'A') {
      const rx = scanner.number(),
        ry = scanner.number(),
        rotation = scanner.number(),
        large = scanner.number(true),
        sweep = scanner.number(true),
        end = point()
      const segment = arc(current, end, rx, ry, rotation, !!large, !!sweep)
      if (!segment.angle) add('L', end)
      else {
        const count = Math.ceil(Math.abs(segment.angle) / (Math.PI / 2)),
          factor = ((4 / 3) * Math.tan(segment.angle / count / 4)) / segment.angle
        for (let i = 0; i < count; i++) {
          const a = segment.point(i / count),
            b = segment.point((i + 1) / count),
            da = segment.tangent(i / count),
            db = segment.tangent((i + 1) / count)
          add(
            'C',
            { x: a.x + da.x * factor, y: a.y + da.y * factor },
            { x: b.x - db.x * factor, y: b.y - db.y * factor },
            b,
          )
        }
      }
    } else if (upper === 'Z') {
      add('Z')
      current = first!
      command = ''
    } else scanner.error()
    previous = upper
  }
  if (!/[LCQ]/.test(result.commands))
    throw new SyntaxError('Shape needs at least one drawing segment.')
  return result
}
export function compatible(a: ShapePath, b: ShapePath) {
  if (a.commands !== b.commands)
    throw new TypeError(
      'Morph paths need matching normalized commands and subpaths. Use set() for a topology change.',
    )
}
export function pathString(path: ShapePath) {
  let i = 0
  return [...path.commands]
    .map((op) => {
      const count = op === 'C' ? 6 : op === 'Q' ? 4 : op === 'Z' ? 0 : 2
      return op + path.points.slice(i, (i += count)).join(' ')
    })
    .join(' ')
}
