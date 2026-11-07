import { colorCSS } from './properties.js'
export function linearGradientCSS(
  angle: number,
  colors: readonly number[],
  stops: readonly number[],
) {
  return `linear-gradient(${angle}deg,${colors.map((color, i) => `${colorCSS(color)} ${stops[i]! * 100}%`).join(',')})`
}
