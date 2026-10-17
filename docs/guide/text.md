# Text

Reveal a title letter by letter, or a word at a time:

```ts
import { animateText } from '@rafaelaugusto/jolt'

await animateText(title)
await animateText(title, { by: 'word', stagger: 100 })
```

The target must be a NativeScript `Label`, or a template ref / `ElementRef` holding one. Spaces, line breaks, alignment and formatted styles stay in place. Composed characters such as accented letters and joined emoji stay together.

Each piece fades in and moves to its original baseline. The original Label keeps its layout and accessibility element, with the full accessible text available throughout, and nothing runs in JavaScript per frame.

- **iOS:** TextKit lays out the complete text before Jolt separates its shaped glyphs into temporary image layers, which Core Animation plays. Letters sharing a ligature animate together. The temporary layers add no accessibility elements.
- **Android:** spans that only affect drawing fade and lift each piece under one native animator. The TextView keeps its text, line breaks, truncation and formatted-text spans; nothing is measured again.

## Options

| Option     | Default    | Meaning                                                            |
| ---------- | ---------- | ------------------------------------------------------------------ |
| `by`       | `'letter'` | `'letter'` or `'word'`; punctuation follows its word in word mode. |
| `duration` | `400`      | Milliseconds per piece.                                            |
| `stagger`  | `35`       | Milliseconds between pieces, in text order.                        |
| `delay`    | `0`        | Milliseconds before the first piece.                               |
| `y`        | `12`       | Initial vertical offset in DIPs; negative values enter from above. |

Total playback is `delay + duration + (pieces - 1) * stagger`. Spaces do not add letter-mode steps. Zero duration reveals the full text immediately, including when a delay was requested.

## Stopping and changes

```ts
const entrance = animateText(title, { by: 'word', y: 18 })
entrance.stop()

await sequence([() => animateText(title), () => animate(button, 'fadeIn')])
```

Returns an `Animation`: `await` it, read `finished`, or call `stop()`. Native completion resolves with `true`. Stopping restores the full text and resolves with `false`. Starting another `animateText()` on the same Label cancels the previous entrance and starts fresh.

Unload, a different native view, or changes to text/style cancel playback and restore the full text; on iOS, resized bounds do too. App changes to text and accessibility labels are preserved. Reduce Motion on iOS and Remove animations on Android (animators disabled) skip the entrance; enabling Reduce Motion during playback restores the full text immediately and resolves with `true`.

## Scope

This effect is intended for titles and short passages. Above 256 pieces the label keeps its original text and resolves with `false`. Empty text completes immediately.

On iOS, truncated labels, embedded attachments and labels using automatic font shrinking keep their original text and resolve with `false`. The same applies when snapshots would exceed four million pixels (about 16 MB of RGBA data). Dynamic Type changes that affect layout cancel the entrance; the normal Label then uses the updated layout.

On Android, rebuild the app after upgrading so the native class is included; without it the call resolves with `false` and keeps the text. Truncated text plays as drawn, and letters on either side of a piece boundary lose their ligature while the entrance plays.
