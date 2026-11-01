export type DecorationProperty =
  | 'borderRadius'
  | 'borderWidth'
  | 'shadowOpacity'
  | 'shadowRadius'
  | 'shadowOffsetX'
  | 'shadowOffsetY'
  | 'elevation'
  | 'translationZ'

export const decorationProperties: readonly DecorationProperty[] = [
  'borderRadius',
  'borderWidth',
  'shadowOpacity',
  'shadowRadius',
  'shadowOffsetX',
  'shadowOffsetY',
  'elevation',
  'translationZ',
]
export const isDecorationProperty = (key: string): key is DecorationProperty =>
  decorationProperties.includes(key as DecorationProperty)

export function clampDecoration(property: DecorationProperty, value: number): number {
  if (property === 'shadowOpacity') return Math.max(0, Math.min(1, value))
  return property === 'borderRadius' ||
    property === 'borderWidth' ||
    property === 'shadowRadius' ||
    property === 'elevation'
    ? Math.max(0, value)
    : value
}
