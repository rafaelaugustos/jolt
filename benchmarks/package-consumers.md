# Packed package consumers — #282

## Decision

Keep one package and add an explicit experimental `@rafaelaugusto/jolt/web` export. Mark `@nativescript/core` as an optional peer, alongside the already optional `nativescript-vue`. Native root, `/native`, `/vue`, their declaration targets and native payload remain unchanged. No browser condition silently replaces a native import. The internal core is still private.

The baseline packed from merge `6f30e03` installed **17 packages**, including `@nativescript/core@9.1.3`, into an empty consumer. The candidate installs **one package: Jolt**, with ordinary `npm install <tarball>` and no peer/optional omission flags. This matches [npm's optional-peer behavior](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#peerdependenciesmeta). A separate package is unnecessary for dependency isolation at this stage; it could reduce the downloaded native payload later. The current tarball still includes native sources/assets, while the browser bundle excludes them.

Native entries remain native. Importing the root without its peer fails with `ERR_MODULE_NOT_FOUND` naming `@nativescript/core`; `/vue` without its peer names `nativescript-vue`. These real resolver diagnostics are checked and documented with installation guidance. There is no install hook or runtime loader that guesses the platform, catches missing peers or changes native execution. [Explicit subpath exports](https://nodejs.org/api/packages.html#subpath-exports) preserve those meanings.

## Experimental API boundary

`/web` exports `createWebRuntime` plus types for finite motion, its context and its handles. The factory returns only `animate`, `set`, `stop`, `configure`, `definePreset`, `release` and `dispose`. Internal diagnostics, ownership mutation, implementation classes, driver registration and portable component references are not part of the package API. The factory needs a mounted browser document; importing it does not.

`/core`, deep implementation paths and `/web/react` remain private. The optional `/web/vue` entry now has its own actual-tarball consumer. Its strict DOM-only declarations, direct/Vite SSR and dev/production enter/leave plus press run with Vue 3.5.44, without NativeScript or React. The imperative-only install still contains just Jolt.

Coordinates are CSS pixels, rotation is degrees and scale is multiplicative. The entry supports the finite 2D transform/opacity capabilities and CSS-surface policy from [#281](./web-runtime.md). Packaging does not add gestures, continuous springs, layout or Mavis integration.

## What is verified

`scripts/check-package-consumers.mjs` uses **the actual `npm pack` artifact**, installed as extracted files in new directories outside the repository. It does not substitute the internal core package used by #279, source aliases, symlinks to the checkout, or NativeScript mocks. Build/test tools execute from the repository, but all application imports and native peers resolve from the isolated consumers.

| Consumer                           | Evidence                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web-only install                   | Lockfile contains only Jolt; NativeScript, Vue and React are absent. Native binary/source payload and existing export targets remain in the tarball.                                                                                                                                                                                  |
| Web declaration graph              | Strict NodeNext and Bundler resolution with DOM/ES libs and `types: []`, `skipLibCheck: false`; reachable Jolt declarations are only `dist/web` and `dist/core`.                                                                                                                                                                      |
| Runtime graph                      | A bundle of the installed public entry reaches only the installed Web/core modules, with no external runtime dependency.                                                                                                                                                                                                              |
| Direct Node SSR                    | Throwing accessors detect any import-time browser global access; throwing timer/listener functions detect scheduled work.                                                                                                                                                                                                             |
| Vite SSR                           | Production outputs with externalized and bundled Jolt both pass the SSR guard; development SSR also renders without creating a context.                                                                                                                                                                                               |
| Vite browser                       | Real Chromium runs the development server and production preview. Both animate through the installed public entry, reach the expected transform/opacity and expose only the seven context methods.                                                                                                                                    |
| Native declarations                | Packed root, `/native` and `/vue` compile with actual native peers, no DOM lib, and both the repository compiler and the production native fixture's compiler.                                                                                                                                                                        |
| NativeScript production JavaScript | The project's pinned `@nativescript/webpack` toolchain builds the installed root, `/native` and `/vue` for both iOS and Android, in NativeScript 9 ESM production mode. Module auditing follows concatenated modules and verifies that every Jolt/native-core module comes from the isolated consumer. No Jolt aliases are installed. |

The Web declaration consumer uses DOM types because the API accepts `Document` and `HTMLElement`; SSR safety means import-time safety, not that the browser-facing declaration file omits DOM types. The native consumer uses the existing project's `skipLibCheck: true` convention for NativeScript's platform declarations.

Vite checks cover development, [SSR externalization](https://vite.dev/guide/ssr.html#ssr-externals) and production bundling explicitly. The optional Vue adapter is exercised separately; no React adapter is claimed. Native production checks compile JavaScript with the actual platform resolver and existing NativeScript-Vue hooks; they do not launch this consumer on a device. The separate Native CI app continues to exercise real iOS-simulator/Android-emulator playback. That existing app has internal aliases for its instrumentation and is not presented as the packed-consumer proof.

## Reproduce and use the candidate

Using Node 22:

```sh
npm ci
npm ci --prefix benchmarks/native-app
npx playwright install chromium
npm run build
npm run package:check
npm run core:check
npm run docs:check-media
npm run docs:build
```

The checker prints its retained temporary directory. Its `rafaelaugusto-jolt-0.1.0-rc.4.tgz` can be installed by Mavis without publishing to npm. The candidate keeps the checkout's version; it is not equivalent to the already-published rc.4 artifact. The report records its npm integrity hash. Do not overwrite that distinction by installing `@next` and expecting `/web`.

The compact report and native bundle logs are written to `benchmarks/package-consumers/results/` and uploaded by the package-consumer CI job, including partial evidence on failure. Workspaces are retained locally for inspection; CI runners are disposable. [Retained local evidence](./package-consumers/validation.json) records the successful matrix and tool versions.

No visual behavior changes in this slice. Existing Web runtime and native Layers recordings are preserved in all four documentation languages. The same reviewed English clips can illustrate the existing behavior in the PR; installation, import isolation and SSR are established by the consumer checks rather than video. This issue authorizes a locally consumable candidate, not npm publication.
