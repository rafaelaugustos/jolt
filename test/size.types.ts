import { animateSize, motionScope, type SizeAnimation } from '../src/index.js'
import type { View } from '@nativescript/core'
declare const view: View
const animation: SizeAnimation = animateSize(
  view,
  { width: 200, height: 'auto' },
  'snappy',
)
animateSize(view, { height: 'auto' }, () => {}, { duration: 300 })
motionScope().animateSize(view, { height: 0 }, 'bouncy')
animation.pause()
animation.play()
animation.stop({ restore: true })
// @ts-expect-error percentages are not destinations
animateSize(view, { height: '50%' })
// @ts-expect-error keyframes/repeat not supported by a changing intrinsic endpoint
animateSize(view, { height: 'auto' }, { repeat: 2 })
// @ts-expect-error size handles do not provide seeking
animation.progress = 0.5
