import { Color, type View } from '@nativescript/core'
import { set } from '../src/index.js'
declare const logo: View
set(logo, { opacity: 1, scale: 1, y: 0 })
set([logo, { nativeView: logo }], { backgroundColor: '#fff', color: new Color('red') })
// @ts-expect-error set takes one value, not keyframes
set(logo, { x: [0, 10] })
// @ts-expect-error null is not a value
set(logo, { opacity: null })
// @ts-expect-error paths animate, they are not set
set(logo, { path: 'M0 0 L10 10' })
// @ts-expect-error unknown property
set(logo, { width: 10 })
