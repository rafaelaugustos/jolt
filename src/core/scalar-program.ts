import { numericMap } from './numeric-map.js'
import { scalarSample, type ScalarOperation, type ScalarSample } from './scalar.js'

/** Topologically ordered, immutable instructions. References always point backwards. */
export type ScalarInstruction =
  | { op: 'input'; a: number }
  | { op: 'constant'; value: number }
  | {
      op: 'map'
      a: number
      input: readonly number[]
      output: readonly number[]
      clamp: boolean
    }
  | { op: ScalarOperation; a: number; b?: number; maximum?: number }

export function scalarProgram(program: readonly ScalarInstruction[], inputs: number) {
  if (!program.length || program.length > 1024)
    throw new RangeError('A scalar program needs 1–1024 nodes.')
  const maps = program.map((node, index) => {
    if (node.op === 'constant') {
      if (!Number.isFinite(node.value))
        throw new TypeError('A scalar constant must be finite.')
    } else if (
      !Number.isInteger(node.a) ||
      node.a < 0 ||
      node.a >= (node.op === 'input' ? inputs : index)
    ) {
      throw new RangeError(
        'A scalar graph must be acyclic and reference existing inputs.',
      )
    }
    if (
      'b' in node &&
      node.b !== undefined &&
      (!Number.isInteger(node.b) || node.b < 0 || node.b >= index)
    )
      throw new RangeError('A scalar graph must reference earlier nodes.')
    return node.op === 'map'
      ? numericMap(node.input, node.output, { clamp: node.clamp })
      : undefined
  })
  const slots: ScalarSample[] = program.map(() => ({ value: 0, velocity: 0 }))
  return (sources: readonly ScalarSample[]): ScalarSample => {
    for (let i = 0; i < program.length; i++) {
      const node = program[i]!
      if (node.op === 'constant') slots[i] = { value: node.value, velocity: 0 }
      else if (node.op === 'input') slots[i] = sources[node.a]!
      else {
        const a = slots[node.a]!
        if (node.op === 'map') {
          const mapped = maps[i]!.sample(a.value)
          slots[i] = { value: mapped.value, velocity: mapped.slope * a.velocity }
        } else {
          const b = node.b === undefined ? undefined : slots[node.b]
          slots[i] = scalarSample(
            node.op,
            a.value,
            a.velocity,
            b?.value,
            b?.velocity,
            node.maximum,
          )
        }
      }
    }
    return slots.at(-1)!
  }
}
