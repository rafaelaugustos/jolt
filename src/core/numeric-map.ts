export interface NumericMapOptions {
  clamp?: boolean
}

/** A bounded piecewise linear map. At an interior knot, use the left derivative. */
export function numericMap(
  input: readonly number[],
  output: readonly number[],
  options: NumericMapOptions = {},
) {
  if (
    !Array.isArray(input) ||
    !Array.isArray(output) ||
    input.length < 2 ||
    input.length > 1024 ||
    input.length !== output.length ||
    [...input, ...output].some((n) => typeof n !== 'number' || !Number.isFinite(n))
  )
    throw new TypeError('A numeric map needs 2–1024 finite input/output pairs.')
  if (
    !options ||
    typeof options !== 'object' ||
    Object.keys(options).some((key) => key !== 'clamp') ||
    (options.clamp !== undefined && typeof options.clamp !== 'boolean')
  )
    throw new TypeError('Mapping options support only a boolean clamp.')
  const clamp = options.clamp !== false
  const x = [...input],
    y = [...output]
  if (x.at(-1)! < x[0]!) {
    x.reverse()
    y.reverse()
  }
  const slopes = x.slice(1).map((stop, i) => {
    if (stop <= x[i]!)
      throw new RangeError(
        'Map inputs must be strictly monotonic; duplicate stops are unsupported.',
      )
    const span = stop - x[i]!,
      slope = (y[i + 1]! - y[i]!) / span
    if (!Number.isFinite(span) || !Number.isFinite(slope))
      throw new RangeError('Numeric mapping range overflowed.')
    return slope
  })
  const sample = (value: number) => {
    if (!Number.isFinite(value)) throw new RangeError('Mapped input must be finite.')
    if (clamp) {
      if (value <= x[0]!) return { value: y[0]!, slope: 0 }
      if (value >= x.at(-1)!) return { value: y.at(-1)!, slope: 0 }
    }
    let i = 0
    while (i < slopes.length - 1 && value > x[i + 1]!) i++
    const mapped = y[i]! + (value - x[i]!) * slopes[i]!
    if (!Number.isFinite(mapped)) throw new RangeError('Mapped output overflowed.')
    return { value: mapped, slope: slopes[i]! }
  }
  return { sample, input: x as readonly number[], output: y as readonly number[], clamp }
}
