import type { Track } from './track.js'
export const rigChannels = ['x', 'y', 'scaleX', 'scaleY', 'rotate'] as const
export type RigChannel = (typeof rigChannels)[number]
export type RigTransform = Partial<Record<RigChannel, number>>
export interface RigPart {
  parent?: string
  /** Fractions of the part's border-box size. */
  pivot?: { x: number; y: number }
  rest?: RigTransform
  /** Degrees; the entire sampled rotation, including spring overshoot, is bounded. */
  rotation?: readonly [number, number]
}
export interface RigSocket {
  part: string
  /** Local logical units (native DIPs / CSS pixels), or fractions when relative. */
  x: number
  y: number
  units?: 'dip' | 'relative'
}
export interface RigDefinition {
  parts: Record<string, RigPart>
  poses: Record<string, Record<string, RigTransform>>
  sockets?: Record<string, RigSocket>
}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
export const shortestRigAngle = (angle: number) =>
  ((((angle + 180) % 360) + 360) % 360) - 180
export interface RigPoseLayer {
  pose: Record<string, RigTransform>
  weight: number
}
export function resolveRigDefinition(definition: RigDefinition) {
  const parts = new Map(
    Object.entries(definition.parts).map(([name, part]) => [
      name,
      {
        ...part,
        pivot: part.pivot && { ...part.pivot },
        rest: { ...part.rest },
        rotation: part.rotation && ([...part.rotation] as [number, number]),
      },
    ]),
  )
  if (!parts.size || parts.size > 64) throw new RangeError('A rig supports 1..64 parts.')
  const validateTransform = (values: RigTransform) => {
    for (const [key, value] of Object.entries(values))
      if (!rigChannels.includes(key as RigChannel) || !finite(value))
        throw new TypeError('Invalid rig transform.')
  }
  const used = new Map<string, Set<RigChannel>>()
  for (const [name, part] of parts) {
    validateTransform(part.rest)
    used.set(name, new Set(Object.keys(part.rest) as RigChannel[]))
    if (part.pivot && (!finite(part.pivot.x) || !finite(part.pivot.y)))
      throw new TypeError('Invalid rig pivot.')
    if (
      part.rotation &&
      (part.rotation.length !== 2 ||
        !part.rotation.every(finite) ||
        part.rotation[0] > part.rotation[1])
    )
      throw new TypeError('Invalid rotation limits.')
    const visited = new Set([name])
    let parent = part.parent
    while (parent !== undefined) {
      if (!parts.has(parent) || visited.has(parent))
        throw new TypeError('Rig hierarchy contains a cycle or missing parent.')
      visited.add(parent)
      parent = parts.get(parent)!.parent
    }
  }
  const poses = new Map(
    Object.entries(definition.poses).map(([name, pose]) => [
      name,
      Object.fromEntries(
        Object.entries(pose).map(([part, values]) => {
          if (!parts.has(part)) throw new TypeError(`Unknown rig part "${part}".`)
          validateTransform(values)
          Object.keys(values).forEach((key) => used.get(part)!.add(key as RigChannel))
          return [part, { ...values }]
        }),
      ),
    ]),
  )
  const sockets = new Map(
    Object.entries(definition.sockets ?? {}).map(([name, socket]) => {
      if (
        !parts.has(socket.part) ||
        !finite(socket.x) ||
        !finite(socket.y) ||
        (socket.units !== undefined && !['dip', 'relative'].includes(socket.units))
      )
        throw new TypeError('Invalid rig socket.')
      return [name, { ...socket }]
    }),
  )
  const select = (
    layers: readonly { pose: string; weight: number }[],
  ): RigPoseLayer[] => {
    return layers.map((layer) => {
      if (!finite(layer.weight) || layer.weight < 0 || !poses.has(layer.pose))
        throw new TypeError('Unknown pose or invalid blend weight.')
      return { pose: poses.get(layer.pose)!, weight: layer.weight }
    })
  }
  return { parts, poses, sockets, used, select }
}
export function rigDestination(
  part: RigPart,
  name: string,
  property: RigChannel,
  rest: number,
  current: number,
  selected: readonly RigPoseLayer[],
) {
  let total = 0,
    offset = 0
  for (const layer of selected) {
    const value = layer.pose[name]?.[property]
    if (value === undefined) continue
    total += layer.weight
    offset +=
      (property === 'rotate' && !part.rotation
        ? shortestRigAngle(value - rest)
        : value - rest) * layer.weight
  }
  const destination = rest + offset / Math.max(1, total)
  return property === 'rotate' && !part.rotation
    ? current + shortestRigAngle(destination - current)
    : destination
}
export function limitRigTrack(
  original: Track,
  limits?: readonly [number, number],
): Track {
  if (!limits) return original
  const [min, max] = limits,
    clamp = (value: number) => Math.max(min, Math.min(max, value))
  return {
    ...original,
    values: original.values.map(clamp),
    to: clamp(original.to),
    valueAt: (time) => clamp(original.valueAt(time)),
    velocityAt: (time) =>
      original.valueAt(time) <= min || original.valueAt(time) >= max
        ? 0
        : original.velocityAt(time),
  }
}
