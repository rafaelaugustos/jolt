import { colorMixer } from '../core/color.js'
import type { Property as CoreProperty } from '../core/properties.js'

export const transformProperties = [
  'x',
  'y',
  'rotate',
  'scaleX',
  'scaleY',
  'opacity',
] as const
export type TransformProperty = (typeof transformProperties)[number]
export const sides = ['Top', 'Right', 'Bottom', 'Left'] as const
export const corners = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'] as const
export type ColorProperty =
  'backgroundColor' | 'color' | `border${(typeof sides)[number]}Color`
export type RadiusProperty = `border${(typeof corners)[number]}Radius`
export type WidthProperty = `border${(typeof sides)[number]}Width`
export type DecorationProperty = WidthProperty | `${RadiusProperty}${'X' | 'Y'}`
export type Property = TransformProperty | ColorProperty | DecorationProperty
export type KeyframeProperty =
  Property | RadiusProperty | 'scale' | 'borderColor' | 'borderWidth' | 'borderRadius'
export type Scalar = number | string
export const colorProperties: ColorProperty[] = [
  'backgroundColor',
  'color',
  ...sides.map((s) => `border${s}Color` as const),
]
export const radiusProperties: RadiusProperty[] = corners.map(
  (c) => `border${c}Radius` as const,
)
export const properties: readonly Property[] = [
  ...transformProperties,
  ...colorProperties,
  ...sides.map((s) => `border${s}Width` as const),
  ...radiusProperties.flatMap((p) => [`${p}X`, `${p}Y`] as const),
]
export const keyframeProperties: readonly KeyframeProperty[] = [
  ...properties,
  ...radiusProperties,
  'scale',
  'borderColor',
  'borderWidth',
  'borderRadius',
]
export const isColor = (p: Property): p is ColorProperty =>
  colorProperties.includes(p as ColorProperty)
export const isTransform = (p: Property): p is TransformProperty =>
  (transformProperties as readonly string[]).includes(p)
export const isRadius = (p: Property) => p.includes('Radius')
export const coreProperty = (p: Property): CoreProperty =>
  isTransform(p)
    ? p
    : isColor(p)
      ? p === 'backgroundColor' || p === 'color'
        ? p
        : 'borderColor'
      : isRadius(p)
        ? 'borderRadius'
        : 'borderWidth'
export const cssName = (p: string) => p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
export function expand(p: KeyframeProperty): Property[] {
  if (p === 'scale') return ['scaleX', 'scaleY']
  if (p === 'borderColor') return sides.map((s) => `border${s}Color` as const)
  if (p === 'borderWidth') return sides.map((s) => `border${s}Width` as const)
  if (p === 'borderRadius')
    return radiusProperties.flatMap((r) => [`${r}X`, `${r}Y`] as const)
  if (radiusProperties.includes(p as RadiusProperty))
    return [`${p}X`, `${p}Y`] as Property[]
  return [p as Property]
}
export const colorCSS = (n: number) =>
  `rgba(${(n >>> 16) & 255}, ${(n >>> 8) & 255}, ${n & 255}, ${(n >>> 24) / 255})`
export function mixValue(p: Property, a: number, b: number, progress: number) {
  return isColor(p) ? colorMixer(a, b)(progress) : a + (b - a) * progress
}
