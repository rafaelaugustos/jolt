# Complete native recipes

These runnable Core NativeScript screens show the full integration, including view creation and cleanup. They use public APIs and work without a framework. The Vue preview only mounts their Frame. Each source below is the exact file compiled by the demo.

Run the compiled demo with --recipe=gallery, --recipe=sheet or --recipe=lists. Android uses the corresponding recipe string intent extra. The supported list is Core ListView; other routers and virtualization plugins need their own target resolver. These captures establish simulator behavior, not physical-device performance.

## Gallery

Use stable item keys and resolve the current list cell at return time. Keep image sources owned by each view through src; sharing a mutable ImageSource wrapper across recycled views can clear another view’s pixels. The Frame callback applies Jolt’s route options before going back. The viewer holds the dismissal pose until navigation accepts or cancels it.

<Clip name="recipe-gallery-ios" caption="iPhone 17 simulator · iOS 26.2. Real XCTest taps and drags; English UI, original speed. Zoom, pan, cancelled dismissal, moving the selected item to the end, keyed thumbnail return and another drag-to-close." />

<<< @/../demo/src/recipes/gallery.ts

## Sheet

One controller owns the panel, handle, nested ScrollView, keyboard following and return focus. Releasing the root disposes the controller.

<Clip name="recipe-sheet-ios" caption="iPhone 17 simulator · iOS 26.2. Real XCTest taps and drags; English UI, original speed. Open, resize, add content, type with the real software keyboard, close/reopen and scroll." />

<<< @/../demo/src/recipes/sheet.ts

## List

Create one animateItems binding per loaded list; release it on unload. itemLoading updates recycled labels from the current data. Replacing items does not require another binding.

<Clip name="recipe-list-ios" caption="iPhone 17 simulator · iOS 26.2. Real XCTest taps and drags; English UI, original speed. Scroll a virtualized Core ListView and replace its data twice." />

For the pinned Core 9.1.3 iOS runtime, this recipe disables UIKit cell prefetching: a prefetched cell could lose its content before display. Fixed row heights and matching estimates keep layout predictable. This is a scoped recipe setting, not a global ListView modification.

<<< @/../demo/src/recipes/lists.ts

## Shared UI setup

<<< @/../demo/src/recipes/ui.ts
