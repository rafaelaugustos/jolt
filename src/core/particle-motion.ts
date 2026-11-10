/** Shared ballistic sampling. Time/lifetime are milliseconds; spin is radians/second. */
export function sampleParticle(
  x: number,
  y: number,
  vx: number,
  vy: number,
  gravity: number,
  spin: number,
  lifetime: number,
  milliseconds: number,
  fadeOut = true,
) {
  const age = Math.max(0, milliseconds) / 1000
  return {
    x: x + vx * age,
    y: y + vy * age + (gravity * age * age) / 2,
    rotation: spin * age,
    opacity: fadeOut ? Math.max(0, 1 - (age * 1000) / lifetime) : 1,
  }
}
