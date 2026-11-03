# Packed native framework acceptance

The four adapters are local, unpublished candidates. [Acceptance results](results/frameworks/acceptance.json) record the packed artifact integrity, exact framework versions, native tests and reviewed recording hashes. No release is produced by this workflow.

Each fixture installs the actual `npm pack` artifact. Run the root build first, then `node benchmarks/frameworks/prepare.mjs NAME` with `react`, `svelte`, `solid` or `angular`. The generated app is under `.local/framework-native/NAME`. Build it with that app's installed NativeScript CLI, `--env.production --no-hmr`, and explicitly select an iOS simulator or Android emulator. The functional runs use debug native shells with production JavaScript; they are not release performance measurements.

| Framework            | Validated version                     | Integration limit                                                                                                                |
| -------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| React NativeScript   | 4.0.1 / React 16.14.0                 | The inspected 5.0.0 package omitted declared runtime files. Separate hook tests also run React 18.                               |
| Svelte Native        | 1.0.29 / Svelte 4.2.20                | Compile with namespace `foreign` to preserve NativeScript property casing.                                                       |
| Solid / DOMiNATIVE   | Solid 1.9.18 / renderer 0.0.4-alpha.1 | Experimental native renderer. Use the client runtime and the fixture's forwarding `use` helper with the universal JSX transform. |
| NativeScript Angular | 22.0.2 / Angular 22.2.4               | Jolt ships partial compilation; the fixture runs real standalone directives and signals. `joltIf` requires one native root.      |

NativeScript runtimes are pinned to iOS 9.1.0 and Android 9.1.1. Core is 8.9.9 for React/Svelte/Solid and 9.1.3 for Angular. `prepare.mjs` writes the packed candidate integrity into each app. Renderer compatibility configuration is explicit in the fixture and [user guide](../docs/guide/frameworks.md).

After installing the four apps on the selected devices:

```sh
python3 benchmarks/docs-record-ios.py SIMULATOR_UUID OUTPUT \
  testReactAdapter testSvelteAdapter testSolidAdapter testAngularAdapter
python3 benchmarks/frameworks/android.py EMULATOR_SERIAL OUTPUT
```

Both runners interact with real native controls and assert position changes, interruption, press, removal/remount, target replacement (or cancelled Angular exit) and final removal. iOS uses XCTest; Android resolves actual accessibility bounds before ADB touches. Unit tests separately cover deferred load, unload suspension, equivalent-value stability, explicit replay and idempotent cleanup. Packed-consumer checks cover optional peers, exported declarations, native bundles and Web/SSR isolation.

English iOS 26.2 iPhone 17 simulator recordings are embedded in all four documentation languages. Android 16 emulator interactions passed for all four fixtures. The recordings play and were visually reviewed; this is simulator/emulator evidence, as requested, and does not imply physical-device performance or compatibility with every framework version.
