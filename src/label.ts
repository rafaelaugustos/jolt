import type { Label } from '@nativescript/core'

const callbacks = new WeakMap<NSObject, (finished: boolean) => void>()
let Delegate: typeof NSObject | undefined
const styleEvents = [
  'fontInternalChange',
  'colorChange',
  'textAlignmentChange',
  'textDecorationChange',
  'textTransformChange',
  'letterSpacingChange',
  'lineHeightChange',
  'textShadowChange',
  'textStrokeChange',
  'whiteSpaceChange',
  'textOverflowChange',
  'maxLinesChange',
  'paddingLeftChange',
  'paddingRightChange',
  'paddingTopChange',
  'paddingBottomChange',
  'visibilityChange',
  'directionChange',
  'borderLeftWidthChange',
  'borderRightWidthChange',
  'borderTopWidthChange',
  'borderBottomWidthChange',
]

/** Reports text, formatted text and style changes of a Label until the returned function is called. */
export function watchLabel(view: Label, onChange: () => void): () => void {
  const formatted = view.formattedText
  view.on('textChange', onChange)
  view.on('formattedTextChange', onChange)
  formatted?.on('propertyChange', onChange)
  for (const event of styleEvents) view.style.on(event, onChange)
  return () => {
    view.off('textChange', onChange)
    view.off('formattedTextChange', onChange)
    formatted?.off('propertyChange', onChange)
    for (const event of styleEvents) view.style.off(event, onChange)
  }
}

/** A CAAnimationDelegate that reports when its animation stops. Release it with `forgetCompletion`. */
export function completion(
  callback: (finished: boolean) => void,
): NSObject & CAAnimationDelegate {
  if (!Delegate) {
    const base = NSObject as typeof NSObject & {
      extend(
        methods: object,
        options: { protocols: unknown[]; name: string },
      ): typeof NSObject
    }
    Delegate = base.extend(
      {
        animationDidStopFinished(
          this: NSObject,
          _animation: CAAnimation,
          finished: boolean,
        ) {
          callbacks.get(this)?.(finished)
        },
      },
      { protocols: [CAAnimationDelegate], name: 'JoltLabelAnimationDelegate' },
    )
  }
  const delegate = Delegate.new()
  callbacks.set(delegate, callback)
  return delegate
}

export function forgetCompletion(delegate: NSObject) {
  callbacks.delete(delegate)
}
