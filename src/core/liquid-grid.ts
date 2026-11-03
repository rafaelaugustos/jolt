/** A periodic displacement field. The fixed boundary keeps transparent edges in bounds. */
export function liquidGrid(
  columns: number,
  rows: number,
  phase: number,
  intensity: number,
) {
  const positions = new Float32Array((columns + 1) * (rows + 1) * 2)
  const t = phase * Math.PI * 2
  let index = 0
  for (let row = 0; row <= rows; row++) {
    const y = row / rows
    for (let column = 0; column <= columns; column++) {
      const x = column / columns
      const edge = Math.sin(Math.PI * x) ** 2 * Math.sin(Math.PI * y) ** 2
      const amount = 0.055 * intensity * edge
      positions[index++] =
        x +
        amount *
          (Math.sin(Math.PI * 2 * y + t) + 0.4 * Math.sin(Math.PI * 2 * (x + y) - 2 * t))
      positions[index++] =
        y +
        amount *
          (Math.cos(Math.PI * 2 * x - t) + 0.4 * Math.cos(Math.PI * 2 * (x - y) + 2 * t))
    }
  }
  return positions
}
