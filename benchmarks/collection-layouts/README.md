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
