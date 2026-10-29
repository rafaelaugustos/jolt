# Bottom sheet

`bottomSheet()` combines native dragging, scroll handoff, springs, a backdrop and keyboard following in an optional in-page recipe. Import it from `@rafaelaugusto/jolt/bottom-sheet`; it does not add a sheet to the core entry point.

Available since **0.1.0-beta.17**, in the core package. Install `@rafaelaugusto/jolt@0.1.0-rc.2` and rebuild the native app to include the native contact callbacks. No optional native-property plugin is needed.

Place a `GestureSurface` directly inside a full-size, single-cell `GridLayout`. Put a separate handle and a vertical NativeScript `ScrollView` inside the panel. The backdrop is a sibling behind it. The application owns these views and their appearance.

```ts
import { bottomSheet } from '@rafaelaugusto/jolt/bottom-sheet'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const sheet = scope.add(
  bottomSheet(panel, {
    handle,
    scrollView: results,
    snap: ['content', '50%', '90%'],
    backdrop,
    returnFocus: openButton,
    keyboard: 'follow',
  }),
)

sheet.open('50%')
sheet.expand() // Next larger resolved stop
sheet.collapse() // Next smaller stop, then dismiss
sheet.dismiss()
// On component destruction:
scope.dispose()
```

The handle is a separate accessible view, so making it actionable does not collapse the sheet's children into one screen-reader element. `GestureSurface` is also exported from the bottom-sheet entry point.

## Drag, scroll and moving stops

Snap points are positive DIP heights, percentages up to `100%`, or `content`. Percentages use the host's usable height after safe areas and keyboard overlap. `content` measures `scrollView.content` plus the panel's non-scroll area. Without a ScrollView, supply an intrinsically sized `content` view containing the desired sheet content.

Layout changes remeasure the stops. Growing content, resizing the host or rotating the window retargets the selected logical stop without restarting the native spring from a new position. The viewport is sized for the largest stop, so the last rows remain reachable when fully expanded. `sheet.remeasure()` is also available for application-driven changes.

Dragging upward inside the list first expands the panel, then scrolls its contents in the same contact. Dragging downward first returns the list to its top, then moves the panel. A touch interrupts a fling immediately; releasing that touch without a pan still selects a stop. The native gesture coordinator handles movement and scroll consumption. The panel and backdrop use native motion-value bindings. JavaScript handles layout/keyboard events and observes closing briefly to hide the views after settling.

<Clip name="bottom-sheet-ios" caption="Real XCTest input on an iOS 26 simulator: content growth, drag-to-scroll handoff, a focused field following the software keyboard, and dismissal. This is a simulator recording, not physical-device or screen-reader performance evidence." />

<Clip name="bottom-sheet-android" caption="Real OS input on an Android emulator: expanding before scrolling, returning the list to its top before moving the panel, content growth, keyboard following and back dismissal." />

## Keyboard and dismissal

`keyboard: 'follow'` is the default. While the keyboard is visible, the sheet temporarily fills the usable space above it, keeps the focused field visible and retains the chosen snap. When the keyboard hides, the selected snap is restored. If Android has already resized the host, its keyboard space is not subtracted again. Use `'none'` when the application manages this itself.

The backdrop, a downward release, Android back and the native Dismiss accessibility action can close the sheet. Set `dismissible: false` to disable those user dismissal paths; an explicit `sheet.dismiss()` still works. An interrupted close does not call `onDismiss` or restore focus prematurely.

Safe-area insets come from the host. `safeArea: { top, bottom }` can override them when the surrounding layout already accounts for those insets. Keep the overlay host in the same window as the panel and keyboard.

## Accessibility and ownership

The handle receives native Expand, Collapse and Dismiss custom actions. Existing custom actions are preserved. Localize them with `accessibility: { label, expand, collapse, dismiss }`; native back is only intercepted while the sheet is open and loaded. `returnFocus` identifies the opener to focus after a completed dismissal. Without it, the recipe captures the current native focus. Reduced Motion follows Jolt's configuration and the platform preference.

The controller provides `isOpen`, `snapPoint`, `visibleHeight`, `paused` and `disposed`, plus `open`, `snapTo`, `expand`, `collapse`, `dismiss`, `remeasure`, `pause`, `play` and `dispose`. `onChange(point)` reports the selected snap, or `null` on a close request; `onDismiss()` waits for completion.

Unloading releases the native gesture session, bindings and keyboard subscription; reloading reattaches to the same views. For a content snap, the measured content is aligned to the top so a short list retains its intrinsic height. Disposal restores that alignment and the other layout/accessibility properties the recipe owns. Do not simultaneously animate its panel Y or backdrop opacity with another owner.

The first version supports an in-page panel and the core vertical `ScrollView`. Native modal presentation, virtualized list plugins and scroll handoff across windows need separate adapters. Native checks exercise custom actions and focus handling; a full VoiceOver/TalkBack navigation audit on physical devices is separate from these simulator recordings.
