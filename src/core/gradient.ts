/** Renderer-independent gradient geometry; colors are premultiplied ARGB values. */
export interface GradientFrame {
  colors: number[]
  stops: number[]
  angle: number
  x: number
  y: number
  radius: number
}
export type GradientComponent =
  'angle' | 'x' | 'y' | 'radius' | `color:${number}` | `stop:${number}`
export function cloneFrame(frame: GradientFrame): GradientFrame {
  return { ...frame, colors: [...frame.colors], stops: [...frame.stops] }
}
export function put(frame: GradientFrame, key: GradientComponent, value: number) {
  if (key.startsWith('color:')) frame.colors[Number(key.slice(6))] = value
  else if (key.startsWith('stop:')) frame.stops[Number(key.slice(5))] = value
  else frame[key as 'angle' | 'x' | 'y' | 'radius'] = value
}
export function take(frame: GradientFrame, key: GradientComponent) {
  if (key.startsWith('color:')) return frame.colors[Number(key.slice(6))]!
  if (key.startsWith('stop:')) return frame.stops[Number(key.slice(5))]!
  return frame[key as 'angle' | 'x' | 'y' | 'radius']
}
/** Project overshooting stops without reordering color identities. */
export function projectGradient(frame: GradientFrame) {
  frame.radius = Math.max(0, frame.radius)
  frame.stops = frame.stops.map((stop) => Math.min(1, Math.max(0, stop)))
  for (let i = 1; i < frame.stops.length; i++)
    frame.stops[i] = Math.max(frame.stops[i - 1]!, frame.stops[i]!)
  return frame
}
