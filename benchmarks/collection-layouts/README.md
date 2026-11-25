# Collection layouts acceptance

The NativeScript fixture uses community CollectionView 6.1.3 and Core ListView 9.1.3. Set `--env.collectionLayouts --env.production --no-hmr` when building `benchmarks/native-app` and install the result on a dedicated simulator or emulator. Each scene uses stable keys, and the audit records the visible anchor and displacement in display units. The transfer scene records both lists and its commit count.

Run from the repository root with fresh output directories and the IDs of those devices.

```sh
python3 benchmarks/collections-scroll/record-ios.py "$SIMULATOR_ID" "$IOS_OUTPUT" testCollectionLayouts
python3 benchmarks/gesture-input/build.py "$INPUT_OUTPUT"
python3 benchmarks/collections-scroll/record-android.py "$ANDROID_SERIAL" "$ANDROID_OUTPUT" "$INPUT_OUTPUT/gesture-input.jar" layouts
node benchmarks/collection-layouts/record-web.mjs
```

The native runners inject OS contacts and save per-scene recordings. The browser runner bundles the public Web entry, exercises Chromium, Firefox and WebKit and records Chromium. It checks the settled card against its destination bounds. Core tests cover invalidated snapshots and reentrant acceptance before commit. Desktop fixtures live in the sibling desktop-motion directory.

## Grid handoff and stationary destination scrolling

The continuity fixture uses 100 cards in a forward two-column sheet and a separate 48-row transfer destination. Native OS input expands and scrolls from the grid, returns to the first row, then repeats expansion and reversal within one contact. The transfer cancels after the destination has actually scrolled and then moves a fresh card past the initially visible rows.

| System                   | Sheet range | Highest first-visible index during single-contact reversal | Cancelled offset / commits | Accepted offset / insertion position (one-based) |
| ------------------------ | ----------- | ---------------------------------------------------------: | -------------------------- | ------------------------------------------------ |
| iPhone simulator, iOS 27 | 230–580 pt  |                                                          6 | 53.3 pt / 0                | 690.7 pt / 25                                    |
| Android API 36 emulator  | 230–640 DIP |                                                          4 | 50.7 DIP / 0               | 897.9 DIP / 30                                   |

The [native readings](../results/collection-continuity/) use each platform's own viewport. Run the native app with the collectionContinuity build flag. The iOS recorder takes the testCollectionContinuity method and the Android recorder takes continuity. The browser recorder accepts GridSheet and EdgeTransfer and verifies expansion, reversal, stationary scrolling, cancellation and single insertion in Chromium, Firefox and WebKit. A captured mouse pan on WebKit suppresses native text-selection scrolling in the declared handoff region. Ordinary interactive child controls retain their input.
