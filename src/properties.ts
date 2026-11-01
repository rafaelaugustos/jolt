import { defaults, type NumericProperty, type Property } from './core/properties.js'
export { precision, type NumericProperty, type Property } from './core/properties.js'
import { Color, type View } from '@nativescript/core'
import { isDecorationProperty, readDecoration, writeDecoration } from './decoration.js'
import { isColorProperty, readColor } from './color.js'

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
