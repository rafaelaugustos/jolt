# Contributing

Repository builds require Node 22.22.3 or newer and `npm ci --prefix benchmarks/angular-tools` after the root `npm ci`. The optional Angular entry is compiled in Angular partial-library mode with its pinned TypeScript 6 toolchain; the root compiler remains independent. These are contributor build requirements, not additional dependencies for framework-free consumers.

The [native CI probe](benchmarks/native-ci.md) runs real iOS/Android measurements and a negative control on pull requests. See its guide for local reproduction and diagnostic artifacts.

Pull requests run only the CI suites their files can affect. [`.github/path-filters.yml`](.github/path-filters.yml) maps paths to the native, SwiftUI, Web, package-consumer and docs-playground jobs. The `test` job always runs. A change to the workflows, dependencies, TypeScript configuration or `src/core` runs everything, and so does every push to `main`. When a suite starts reading files outside its listed paths, add those paths to the map so the suite is not skipped.

Changes to the internal portable motion boundary also require `npm run build` followed by `npm run core:check`. This checks a dependency-free consumer of the compiled core without NativeScript mocks or DOM types. See [portable core verification](benchmarks/portable-core.md) for the frozen native baseline and the scope of this boundary.

Changes to package exports, peer dependencies or Web/framework entries also require `npm run package:check` after building. Install the pinned native build tools with `npm ci --prefix benchmarks/native-app` and Chromium with `npx playwright install chromium` first. The check installs the actual tarball into clean consumers, verifies Vite/SSR and declarations, and builds iOS/Android production JavaScript with NativeScript's resolver. It prints the retained candidate path for local consumers such as Mavis. See [package consumer verification](benchmarks/package-consumers.md). Add a packed framework consumer when a new Web framework entry is introduced; the check deliberately rejects an unverified entry.

## Documentation build resources

`npm run docs:build` gives the VitePress process a 1,280 MiB old-space heap and limits page rendering/search indexing to four concurrent pages. The build is validated in a Linux container with 2 GiB of memory, no swap, and two CPUs. The heap limit covers only V8 old space: native allocations, esbuild and filesystem cache also use the container budget. Smaller build containers are not validated. Increasing Node's heap without increasing container memory can cause an OOM kill.

VitePress 1.6.4 still depends on Vite 5. The scoped `package.json` override pins its build tool to Vite 6.4.6 (supported by the bundled Vue plugin), including a patched esbuild. Keep this override until a stable VitePress release supplies a patched dependency; validate both the static build and browser hydration/search before changing it. The root Vitest/Vite toolchain is separate. Use `npm ci` to retain the reviewed dependency versions.

The four locale-specific local-search indexes exceed Vite's default 500 kB chunk warning. They are already loaded on demand, one language at a time when search opens. This warning is informational and is kept visible; it is not an OOM diagnostic. Preserve full-text and Chinese tokenization when evaluating future search changes.

For a failed hosted build, inspect its final exit status and memory diagnostics. A V8 heap failure, a cgroup OOM kill and CPU quota throttling are different conditions. CPU throttling alone does not mean the build failed. Record the configured build memory/CPU limits as well as the Node version before comparing runs. See [the measured build investigation](benchmarks/docs-build-resources.md).

## A visual feature is complete only with a recording

For each new visual feature or visible behavior change:

1. Implement and validate it in the native demo.
2. Record the real app. Include the interaction that explains the feature: drag/release, interruption, resizing, scrolling, pause/resume or another relevant action.
3. Watch the clip and inspect representative frames. Confirm the effect is visible, the controls are readable, and the recording does not show errors or unrelated setup. Tests and screenshots are supporting evidence, not replacements for a video.
4. Save a compact H.264 MP4 in `.local/media/`, publish it with `npm run media:upload -- .local/media/YOUR_RECORDING.mp4` and embed it with `<Clip name="..." caption="..." />` in the matching English, Portuguese, Spanish and Simplified Chinese guides. Translate captions; reuse the same recordings. Captions identify the behavior and platform. Clearly identify slow motion and effects video cannot convey, such as haptics.
5. Run `npm run docs:check-media`, `npm run media:verify` and `npm run docs:build`. Do not close the issue or prepare the release before the clips are included. Keep existing recordings current when the visible behavior changes.
6. Attach only the reviewed English-language recordings directly to the PR description with playable video players, labeled by platform and behavior. Do not record or attach Portuguese versions for a PR. Use `gh pr edit YOUR_PR --attach ./.local/media/YOUR_RECORDING.mp4` (repeat `--attach` for multiple platforms; `npm run media:pull -- YOUR_RECORDING` downloads a published clip), then verify the published description. A link to the published file alone does not meet this review requirement. Leave existing PR attachments as they are unless asked to change them.

The CI media check requires every visual guide in all four languages to have a captioned clip, checks that each referenced MP4 is published, and checks page and recording parity, including the homepages. Its explicit exemptions cover setup, architecture, API navigation and planned work. A new guide requires media by default. This check cannot judge whether a video actually demonstrates the feature; human/agent visual review remains required.

## Documentation videos

Documentation MP4s are served from Cloudflare R2 at `https://media.rafaelaugusto.dev/jolt/`, not from the repository or the site build. `docs/.vitepress/media.json` lists every published recording with its size and SHA-256; the `Clip`, `NativeVideo` and homepage components build their URLs from it. Posters and other images stay in `docs/public/`.

`npm run media:upload -- FILES` uploads with Wrangler (log in once with `npx wrangler login`) and records each file in the manifest. Commit the manifest change with the guide that uses the recording. An unchanged file is skipped. A different file with an existing name is rejected unless you pass `--replace`, which is reserved for a reviewed recording of the same behavior; the edge cache can serve the previous version for up to a day. `npm run media:verify` checks that every manifest entry is published with the expected size and type. `npm run media:pull -- NAMES` downloads published recordings into `.local/media/` and checks their hashes, for example before `scripts/prepare-motion-recipe-media.mjs` cuts a recipe clip from a source recording. `docs:check-media` rejects MP4 files under `docs/public/`.

Recording notes written before November 2026 refer to `docs/public/media/`; those files are now the published copies with the same names.

## Documentation languages

Keep `docs/guide`, `docs/pt-BR/guide`, `docs/es/guide` and `docs/zh-Hans/guide` in sync. Each locale also has its own homepage. Translate prose, navigation and captions while preserving API names, runnable code, version numbers and platform limitations. Internal links should stay in the selected language. Spanish and Chinese headings retain explicit English anchor IDs so existing cross-guide section links work after translation.

Navigation, search and shared footer labels live in `docs/.vitepress`. When adding a sidebar entry, provide all four labels. Check Chinese search with an unspaced query as well as an API identifier, and check the language selector on a guide as well as the homepage.

GIFs in the README are a selection of highlights. Feature guides always contain their relevant recordings. Prefer MP4 for the documentation because it is smaller and can be paused with the player controls.

## Reproduce the documentation recordings

Use dedicated simulators/emulators and explicit device IDs. Do not take over someone else's running device. Install the normal Vue demo with `JOLT_BENCHMARK=1` so its application ID is `org.nativescript.jolt.benchmark`; omit the native probe entry-point flags. Build platforms sequentially because NativeScript shares generated assets. See `benchmarks/layout-lifecycle.md` for build/signing setup.

The iOS runner needs Xcode and the Ruby `xcodeproj` gem (available with CocoaPods). Set `GEM_PATH`/`PATH` for your local CocoaPods Ruby if necessary:

```sh
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltDocsRecordings
# Re-record just one scene:
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR_UUID /tmp/JoltDocsRecordings testLayout
```

XCTest injects real touches and gestures. The host starts/stops `simctl recordVideo` around each named scene using a handshake; launch/setup screens are excluded. The exclusive `/tmp/jolt-docs-recording-control-SIMULATOR_UUID` directory prevents concurrent recording sessions on the same device while allowing separate worktrees to record on separate simulators. Raw footage and the XCTest result bundle remain in the output directory. If forcibly interrupted, verify no runner is active before removing a stale control directory.

The Android runner records the Busy JavaScript comparison with real ADB taps and restores the device's original touch-indicator setting:

```sh
python3 benchmarks/docs-record-android.py YOUR_ADB_SERIAL /tmp/JoltDocsRecordings/android-performance.mp4
```

For a physical iPhone connected by USB, `benchmarks/record-iphone.swift` captures the exact named screen source without audio. It timestamps real frames with the host monotonic clock to preserve elapsed time; USB source timestamps can compress time with `AVCaptureMovieFileOutput`. See the [physical sensor interval workflow](benchmarks/device-sensors.md#physical-sampling-intervals-2026-10-29) for compilation, recording and signed XCTest instructions. Keep the phone unlocked in one orientation, verify playback timing, and label the physical device in the caption.

Compress while keeping the source playback timing (the interruption demo explicitly selects the app's one-fifth speed):

```sh
ffmpeg -i /tmp/JoltDocsRecordings/layout-ios.mov \
  -vf 'fps=30,scale=420:-2' -c:v libx264 -preset slow -crf 24 \
  -pix_fmt yuv420p -movflags +faststart -an .local/media/layout-ios.mp4
ffmpeg -v error -i .local/media/layout-ios.mp4 -f null -
```

Use `ffprobe` to check duration, dimensions and codec. Watch the full clip and sample frames across its duration before committing. Never generate simulated animation footage, accelerate a performance comparison, or label simulator captures as physical-device recordings.

## Documentation menu status

`docs/.vitepress/navigation-status.ts` owns the sidebar markers for all four languages. Use **New** for a capability introduced in the documented edition, **Updated** for a material capability change, and **Beta** for an experimental API/adapter. These are curated capability labels, not file modification dates. Beta takes the single badge slot for experimental entries; other badges do not promise API stability.

New/Updated entries carry the exact package edition and disappear automatically when its version changes. Review the map at every release, retiring old change markers and updating explicit `source` versus `published` availability. Do not mark source candidates as published because the documentation builds or a PR merges. Beta persists until its contract is intentionally stabilized. Keep status descriptions localized, accessible, and separate from the plain-text previous/next page labels. Inspect desktop/mobile and light/dark navigation after changing badge styles; site navigation has no native renderer counterpart.

After building the docs, start a dedicated preview with `npm run docs:preview -- --host 127.0.0.1 --port 5187`. Run `node benchmarks/docs-navigation/record.mjs` to capture actual desktop and emulated mobile menu interaction in English. `JOLT_DOCS_URL` and `JOLT_DOCS_CAPTURE_DIR` override the preview and output directory. Review the output, trim only startup frames when needed without changing playback speed, and publish the reviewed MP4s with `npm run media:upload`. Label mobile footage as browser emulation.
