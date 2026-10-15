import { Color, type View } from '@nativescript/core'
import {
  isDecorationProperty,
  readDecoration,
  writeDecoration,
  type DecorationProperty,
} from './decoration.js'
import { isColorProperty, readColor, type ColorProperty } from './color.js'

export type NumericProperty =
  'opacity' | 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotate' | 'rotateX' | 'rotateY'
export type Property = NumericProperty | ColorProperty | DecorationProperty

const viewKeys = {
  opacity: 'opacity',
  x: 'translateX',
  y: 'translateY',
  scaleX: 'scaleX',
  scaleY: 'scaleY',
  rotate: 'rotate',
  rotateX: 'rotateX',
  rotateY: 'rotateY',
} as const satisfies Record<NumericProperty, keyof View>

const defaults: Record<NumericProperty, number> = {
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
  borderRadius: 0.1,
  borderWidth: 0.1,
  shadowOpacity: 0.002,
  shadowRadius: 0.1,
  shadowOffsetX: 0.1,
  shadowOffsetY: 0.1,
  elevation: 0.1,
  translationZ: 0.1,
  backgroundColor: 0.002,
  borderColor: 0.002,
  color: 0.002,
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
  return Object.hasOwn(viewKeys, key) || isColorProperty(key) || isDecorationProperty(key)
}

export function readValue(view: View, property: Property): number {
  if (isColorProperty(property)) return readColor(view, property)
  if (isDecorationProperty(property)) return readDecoration(view, property)
  const value = view[viewKeys[property]]
  return typeof value === 'number' && !Number.isNaN(value) ? value : defaults[property]
}

export function writeValue(view: View, property: Property, value: number) {
  if (isColorProperty(property)) {
    view[property] = new Color(value)
    return
  }
  if (isDecorationProperty(property)) return writeDecoration(view, property, value)
  view[viewKeys[property]] = value
}
