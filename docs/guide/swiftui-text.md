# SwiftUI: text entrance and rolling numbers

Pending merge and publication in [PR #488](https://github.com/rafaelaugustos/jolt/pull/488); not in 0.1.0-rc.13. For iOS 17+ and macOS 14+, without NativeScript or JavaScript. See [installation](./swiftui), [ownership](./swiftui-motion) and [interaction/geometry](./swiftui-geometry) for platform limits. They follow the Web [`animateText` and `rollTo`](./web-effects#text) and share their split, stagger and alignment through the portable core.

<Clip name="swiftui-text-ios" caption="iOS simulator, native SwiftUI: a sentence entering by word and by letter with replay, a Hebrew line in right-to-left order, currency and percentage values rolling up and down with interruption, Reduce Motion and larger Dynamic Type. Not a physical-device recording." />

<Clip name="swiftui-text-macos" caption="macOS native SwiftUI, driven by actual XCTest mouse clicks: word and letter entrances with replay, currency and percentage rolls with interruption, and Reduce Motion. macOS has no Dynamic Type." />

## Text entrance

`JoltTextEntrance` owns one string and its playback. `JoltAnimatedText` draws it as a single SwiftUI `Text`, styled by the surrounding `font`, `foregroundStyle`, `multilineTextAlignment` and `lineLimit` modifiers. Each visible piece fades from 0 to 1 and rises `y` points to its place on an ease-out tween. The defaults are those of the Web: letters, 400 ms per piece, 35 ms stagger, no delay, 12 points.

```swift
@StateObject private var title = try! JoltTextEntrance(
    "Motion should feel like it belongs to the words it carries.",
    options: .init(by: .word, duration: 400, stagger: 70, y: 12))

JoltAnimatedText(title).font(.title2.bold())
Button("Replay") { title.replay() }
// try title.replay("A new headline")   // validates, then replays
```

`by: .letter` splits extended grapheme clusters, so an accented letter, a flag or a joined emoji family is one piece. `by: .word` uses the Unicode word segments the system tokenizer reports for the current locale; spaces and punctuation are pieces of their own. Whitespace draws nothing but keeps its place in the order: the piece at position _k_ starts at `delay + k × stagger` milliseconds, spaces included, exactly as on the Web. The entrance lasts until the last visible piece arrives. A zero duration shows the whole text at once, whatever the delay.

Durations, stagger and delay are milliseconds, finite, from 0 to 60,000. `y` is in points, finite, within ±10,000; negative values enter from above. The text holds at most 256 graphemes, and the last piece must arrive within 60,000 ms. Invalid input throws `JoltError.invalidMotion` before anything changes: `replay(_:)` with an invalid string leaves the current entrance playing.

The entrance is a `JoltResource` driven by `JoltClock`. It plays from creation unless `autoplay: false`, which keeps it hidden at its first frame until `play()` or `replay()`. `pause()` freezes it; `cancel()` shows the whole text and keeps it replayable; `dispose()` shows the whole text for good. `state`, `elapsed` and `progress` report playback. A `JoltScope` can retain it. `JoltAnimatedText` suspends it while the view is off screen, while the iOS scene is inactive or while the macOS window is hidden, minimized or covered; a manual pause survives resume. No clock runs before playback, while paused or after completion.

**Accessibility.** The view is one accessibility element whose label is the whole string, from the first frame, whatever the pieces are drawing. Pieces add no elements.

**Reduce Motion.** The system setting, `joltReduceMotion(true)` on an ancestor and `reducedMotion: true` show the final text at once and complete the entrance. Turning it on during an entrance completes it.

**Layout, Dynamic Type and right-to-left.** On iOS 18 and macOS 15 and later, each piece is a run of one laid-out `Text`, drawn by a `TextRenderer`. Line breaking, wrapping, Dynamic Type, bidirectional order and Arabic joining are SwiftUI's own; the view has the same size as a plain `Text`. A Dynamic Type change during the entrance lays the text out again and playback continues at its current time. In right-to-left text, pieces enter in reading order, so the first Hebrew or Arabic word, on the right, enters first. While letters move, a ligature that spans two pieces is drawn as separate letters; at rest the view is a plain `Text`. Moving glyphs draw up to `y` points outside the frame. On iOS 17 and macOS 14, where `TextRenderer` does not exist, the view shows the final text and the entrance completes as soon as it starts. macOS has no Dynamic Type.

**Platform differences.** Letters match the Web grapheme for grapheme. Word boundaries come from each platform's text engine: `Intl.Segmenter` on the Web, the system tokenizer on Apple. They agree wherever the Unicode word rules decide, which the shared fixtures check for English, punctuation, emoji, combining marks, Korean, Arabic, Hebrew and numbers. Chinese and Japanese words come from different dictionaries: `你好世界` is `你好 | 世界` on the Web and `你 | 好 | 世界` on Apple. The NativeScript `animateText` differs from both: spaces add no letter steps there, and punctuation joins its word.

## Rolling numbers

`JoltRollingNumber` keeps a value and the text an application formatter makes of it. `roll(to:)` sets `value`, `text` and the accessibility value at once; only the drawing moves. `JoltRollingText` draws it: at each changed position the glyph on screen slides out while the new one slides in, on a spring. Glyphs that stay the same do not move.

```swift
@StateObject private var balance = try! JoltRollingNumber(
    1249.9,
    format: { $0.formatted(.currency(code: "USD")) },
    options: .init(duration: 600, bounce: 0.2, stagger: 0))

HStack {
    Text("Balance")
    Spacer()
    JoltRollingText(balance)  // tabular: true, alignment: .trailing
        .font(.largeTitle.bold())
        .accessibilityLabel("Balance")
}
Button("Deposit") { try? balance.roll(to: 12980.6) }
```

`format` is an `@MainActor (Double) -> String` and must return at most 256 graphemes; the default, `JoltRollingNumber.plain`, prints whole numbers without a fraction and other values as Swift's shortest decimal. Values must be finite. `duration` (above 0, at most 60,000 ms) and `bounce` (−1 to 1) describe the spring as SwiftUI and the Web do: `JoltTransition.spring(milliseconds:bounce:)` returns the same stiffness and damping as the Web, with bounce limited to ±0.99. `stagger` and `delay` are milliseconds from 0 to 60,000. Invalid input throws before the text or a running roll changes.

Both strings are split into graphemes and aligned on their last one, so the units digit stays put when the number grows: `99` becomes `100` by rolling two nines into zeros and a `1` in on the left. Graphemes compare by their exact Unicode scalars, as on the Web, so `é` and `e` followed by a combining accent roll. Stagger counts changed positions from the right, then the old graphemes that leave with nothing replacing them. `direction: .auto` rolls up to a higher value and down to a lower one; rolling up means the old glyph leaves through the top while the new one enters from below. `roll(to:direction:)` can override the direction once. `set(_:)` jumps without rolling.

**Interruption.** A new target during a roll takes effect at once in `text` and the accessibility value. Glyphs that are the same in both targets keep moving as they were. Every other glyph leaves from the offset and opacity it is drawn with, so nothing jumps. At most eight generations of leaving glyphs are kept; older ones disappear. On the Web, a retarget flattens what is drawn and rolls the whole new text in.

**Drawing and layout.** Moving glyphs are clipped to their line, like an odometer. The view takes the size of the new text, laid out as a native `Text` with Dynamic Type. Leaving glyphs are laid out on one line at their natural width and placed at `alignment` inside the view: the default `.trailing` keeps columns aligned from the end, which suits numbers in a trailing-aligned row. Use the alignment the container keeps fixed when the width changes; a fixed width or `tabular: true` (monospaced digits, the default) gives the steadiest columns. In a right-to-left layout `.trailing` is the left edge; set the alignment explicitly when a number sits in right-to-left text. On iOS 17 and macOS 14 the final text shows at once.

**Accessibility and Reduce Motion.** The view is one element whose accessibility value is the formatted target from the first frame of the change; give it a label with `.accessibilityLabel`. Reduce Motion, `joltReduceMotion(true)` and `reducedMotion: true` show the final text at once. The roll is a `JoltResource` with the same pause, suspension, scope and disposal rules as the entrance.

## Shared fixtures

`npm run swiftui:check` regenerates `Fixtures/text.json` from the portable core and fails when it is stale. It holds the letter and word pieces of strings with ASCII, punctuation, emoji ZWJ sequences, combining marks, CJK, Arabic, Hebrew and mixed numbers; entrance start times and eased progress for three duration/stagger/delay combinations; roll diffs with their stagger; and springs from duration and bounce. `JoltCoreTests` reproduces all of them, comparing Chinese and Japanese word boundaries outside dictionary runs only.
