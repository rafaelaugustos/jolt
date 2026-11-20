# Native-only framework peer compatibility (#517)

Source follow-up to RC.16. The published RC.16 package rejects normal installation
alongside Solid 2.0.0 or Svelte 4.2.20, even when an app never imports a Jolt framework
binding. Both original `npm install --package-lock-only --ignore-scripts`
reproductions were confirmed with Core 9.1.3 before changing the manifest.

The optional package peers now include Solid `^1.9.18 || ^2.0.0` and Svelte
`^4.2.20 || ^5.0.0`. This is an installation contract, distinct from each entry's
framework binding contract. The native root and `/native` have no Solid/Svelte
runtime or declaration dependency. Components using them own motion scopes,
subscriptions and disposal through their framework lifecycle.

## Clean packed consumers

| Fixture                             | Exact application dependencies                                                                                                            | Acceptance                                                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Solid Native 2                      | Core 9.1.3, Solid 2.0.0, `@nativescript-community/solid-js` 2.0.1, DOMiNATIVE 0.1.3, `@solidjs/universal` / `@solidjs/babel-plugin` 2.0.0 | Normal npm lock resolution and `npm ci`, complete application peer tree, imperative types, iOS and Android production bundles |
| Stable Svelte Native 4              | Core 8.9.9, Svelte 4.2.20, `@nativescript-community/svelte-native` 1.0.32                                                                 | The same installation/type/bundle checks; actual Svelte 4 compiler consumes the existing native action component              |
| Original Svelte/Core 9 reproduction | Core 9.1.3 and Svelte 4.2.20 without the renderer                                                                                         | Normal lock resolution succeeds with the packed Jolt artifact                                                                 |

Node 22.23.3 was used (Solid 2 requires Node 22.12+). The Solid fixture pins universal
2.0.0 because the newer universal 2.0.3 requires Solid 2.0.3; this avoids silently
changing the issue's Solid 2.0.0 reproduction. DOMiNATIVE 0.1.3 accepts Core 9;
0.1.2's Core 8-only peer is not used. Stable Svelte Native 1.0.32 itself pins Core
8.9.9, independently of Jolt's Core >=8.9 contract. No renderer peer is overridden.

The test installs the real packed artifact into fresh directories, with neither
`--legacy-peer-deps`, `--force`, Jolt aliases nor source replacements. It first
runs the reported lock-only command, then `npm ci` and validates the application
peer tree. Both native production bundles resolve only the installed Jolt files;
the imperative entries cannot pull in unused framework bindings or framework
declarations. Renderer Webpack hooks use their actual installed toolchain.
These are installation, type and bundle checks, not a claim of complete renderer
runtime acceptance or new physical-device performance.

## Binding boundaries

The existing `/svelte` native actions were already demonstrated with Svelte 4.2.20
in the [native framework acceptance](frameworks.md). Public action tests now
explicitly cover update, unload/reload and disposal; the clean Svelte 4 compiler
fixture verifies the actual component/action integration. Existing recordings
retain their original renderer/version/platform labels.

Solid 2 separates dependency computation from side effects. Running the Solid 1
callback form there can perform work in the wrong phase. `/solid` and `/web/solid`
therefore reject the Solid 2 runtime with an explicit imperative-API alternative.
The check happens before native binding resources are allocated. Packed probes use
actual Solid 2 server and client builds; a separate native ownership test checks
that rejection leaves no animation or listeners. Solid 1 reactive update/disposal
continues to pass. This change does not port the Solid bindings to Solid 2.

The Web binding matrix remains Solid 1.9.18 and Svelte 5.57.3. Existing packed
SSR/client consumers and browser lifecycle tests validate those combinations.
A broad package peer does not promise every subentry works with every framework
version. No new visible animation behavior or public motion API is introduced.

## Reproduction and evidence

Run the root build and `npm run package:check` with the pinned root, Angular and
`benchmarks/native-app` dependencies installed. The package check calls
`benchmarks/package-consumers/native-peers.mjs` and the fixtures under
`test/fixtures/package-consumers/native-peers`. Its normal report and CI artifact
include `nativeImperativePeers`: resolved versions, compiler checks, Solid boundary
checks and both native bundle module inventories.

The suite also retains existing native/framework and Web consumers. It exercises
the actual tarball with ordinary package resolution; unit mocks are not used for
installation, peer resolution, packed Solid runtime probes or native bundling.

## Consumer-owned overrides

Mavis main `0cdb4ec64688e17a0681754d442b70feb530a307` and its current root manifest were inspected. It pins Solid 2.0.0, its maintained
native renderer 2.0.1 and Svelte 4.2.20 / community renderer 1.0.32. Its root app owns
these temporary RC.16 overrides:

```json
{
  "@rafaelaugusto/jolt": {
    "solid-js": "$solid-js",
    "svelte": "$svelte"
  }
}
```

Keep them while using the published RC.16 package. Remove just those two mappings
after installing a verified release containing #517 and rerunning Mavis's native
acceptance. The separate `@nativescript-community/svelte-native` Core override
belongs to the renderer's Core 9 compatibility work and is not resolved here.
Mavis implementation and release remain a separate workstream; no overrides are
removed from that repository by this change.

## Local validation

All 1,896 unit tests in 145 files pass, including native Svelte action ownership
and the Solid version boundary. The full packed-consumer check completes, retaining
existing SSR/browser/native cases and adding both clean renderer installations,
four imperative native bundles and the separate Svelte 4/Core 9 resolver check.
All 24 framework/binding browser cases pass across Chromium, Firefox and WebKit.
Root build, type checks, formatting, documentation media/playground checks and the
four-language documentation build pass. Hosted checks remain visible on the PR.
