# Rolling numbers

Change a number and let the digits that differ roll into place:

```ts
import { rollTo } from '@rafaelaugusto/jolt'

await rollTo(balance, 1249.9, { format: (value) => value.toFixed(2) })
await rollTo(timer, '00:42')
```

The target must be a NativeScript `Label`, or a template ref / `ElementRef` holding one. The label receives its final text right away, so layout, bindings and accessibility hold the new value from the first frame. Only the drawing moves: at each changed position the old glyph slides out while the new one slides in behind it, on a Jolt spring, clipped to the label. Digits that stay the same do not move.

A number goes through `format` first, `String` by default. A string is shown as it is.

## Options

| Option      | Default  | Meaning                                                                   |
| ----------- | -------- | ------------------------------------------------------------------------- |
| `format`    | `String` | Turns a number into the text to show.                                     |
| `duration`  | `600`    | How long the spring feels, in milliseconds.                               |
| `bounce`    | `0.2`    | Spring bounce, from -1 to 1, as in [springs](./transitions).              |
| `stagger`   | `0`      | Milliseconds between changed positions, starting from the rightmost one.  |
| `delay`     | `0`      | Milliseconds before the first position moves.                             |
| `direction` | `'auto'` | `'auto'`, `'up'` or `'down'`.                                             |
| `tabular`   | `true`   | Tabular figures on the native label, so every digit takes the same width. |

With `'auto'`, a higher number rolls up and a lower one rolls down. The comparison uses the number from the previous `rollTo()` on that label, or the previous text when it parses as a number; strings roll up. Rolling up means the old glyph leaves through the top while the new one enters from below.

## How positions match

Both texts are split into graphemes, so an accented letter or a joined emoji counts as one position, and aligned on their last character. The units digit stays put when the number grows: `99` becomes `100` by rolling two nines into zeros and rolling a `1` in on the left, and `100` becomes `99` by rolling the `1` out alone. Separators and suffixes that do not change stay still.

Stagger counts changed positions from the right: the units digit moves first, then each position to its left, and finally the digits that roll out with nothing coming in.

## Platforms

On iOS, TextKit lays out the old and the new text in the label's current bounds and Jolt separates their glyphs into temporary image layers, the way [text entrances](./text) do. Core Animation plays the spring and the fades with no JavaScript per frame while the label's own text is drawn transparent. The limits of the text guide apply: truncated labels, embedded attachments and automatic font shrinking show the final text and resolve with `false`.

On Android, a span per changed position draws the old and the new glyphs and one native animator moves them, following the system animator duration scale. The `TextView` keeps the real text throughout. Rebuild the Android app after upgrading so the native class is included; without it the label shows the final text and the call resolves with `false`.

With `tabular` on, Jolt asks the native label for tabular figures: the number-spacing font feature on iOS and the `tnum` setting on Android. Proportional fonts then stop shifting the rest of the line when a `1` becomes an `8`. NativeScript may set the font again on its next style change; the next roll applies the feature again.

The roll uses the label bounds at the moment it starts. When the digit count changes, the label's own width changes on the next layout pass, which shifts centered and right-aligned text. A left-aligned label with tabular figures, or a fixed width, gives the cleanest result.

## Stopping and changes

```ts
const roll = rollTo(balance, 2000, { format })
roll.stop()

await sequence([() => rollTo(score, 10), () => animate(badge, 'popIn')])
```

Returns an `Animation`: `await` it, read `finished`, or call `stop()`. Native completion resolves with `true`. Stopping leaves the final text in place and resolves with `false`. When the text does not change, the call resolves with `true` at once. Starting another `rollTo()` on the same label cancels the previous one and rolls from the text it had settled on.

Unload, a different native view, and changes the app makes to the text or style cancel the roll and keep what the app set. A `formattedText` is replaced by the rolled plain text. Reduce Motion on iOS and disabled animators on Android show the final text immediately and resolve with `true`. More than 256 changed positions show the final text and resolve with `false`.
