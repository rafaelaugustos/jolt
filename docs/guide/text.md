# Text

Reveal a title letter by letter, or a word at a time:

```ts
import { animateText } from '@rafaelaugusto/jolt'

await animateText(title)
await animateText(title, { by: 'word', stagger: 100 })
```

The target must be a NativeScript `Label`, or a template ref / `ElementRef` holding one. TextKit lays out the complete text before Jolt separates its shaped glyphs into temporary image layers. Spaces, line breaks, alignment and attributed styles stay in place. Composed characters such as accented letters and joined emoji stay together; letters sharing a ligature animate together.

Each piece fades in and moves to its original baseline. Core Animation plays the effect without JavaScript callbacks per frame. The original Label keeps its layout and accessibility element, with the full accessible text available throughout. The temporary layers add no accessibility elements.

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

Unload, a different native view, changes to text/style, or resized bounds cancel playback and remove the temporary layers. App changes to text and accessibility labels are preserved. Reduce Motion skips the entrance; enabling it during playback restores the full text immediately and resolves with `true`.

## Scope

iOS only for now. Android calls resolve with `false` and leave the Label unchanged.

This effect is intended for titles and short passages. Truncated labels, embedded attachments and labels using automatic font shrinking keep their original text and resolve with `false`. The same applies above 256 pieces or when snapshots would exceed four million pixels (about 16 MB of RGBA data). Empty text completes immediately. Dynamic Type changes that affect layout cancel the entrance; the normal Label then uses the updated layout.
