import type { View } from '@nativescript/core'

export type Property =
  'opacity' | 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotate' | 'rotateX' | 'rotateY'

const viewKeys = {
  opacity: 'opacity',
  x: 'translateX',
  y: 'translateY',
  scaleX: 'scaleX',
  scaleY: 'scaleY',
  rotate: 'rotate',
  rotateX: 'rotateX',
  rotateY: 'rotateY',
} as const satisfies Record<Property, keyof View>

const defaults: Record<Property, number> = {
  opacity: 1,
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
}

/** How close to its target a spring or decay has to be to count as settled. */
export const precision: Record<Property, number> = {
  opacity: 0.002,
  x: 0.25,
  y: 0.25,
  scaleX: 0.001,
  scaleY: 0.001,
  rotate: 0.1,
  rotateX: 0.1,
  rotateY: 0.1,
}

export function isProperty(key: string): key is Property {
  return key in viewKeys
}

export function readValue(view: View, property: Property): number {
  const value = view[viewKeys[property]]
  return typeof value === 'number' && !Number.isNaN(value) ? value : defaults[property]
}

export function writeValue(view: View, property: Property, value: number) {
  view[viewKeys[property]] = value
}
