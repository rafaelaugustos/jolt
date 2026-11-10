# Documentation build memory and dependency investigation

## Objective and scope

Investigate the hosted VitePress build warnings reported after rc.13 and produce a bounded, validated build. Baseline: `d9f5170769e5c708d3c09047208477037080491a`. This changes contributor/build tooling only; package runtime code, documentation content, media and search semantics are unchanged.

The current upstream [Orbit default build policy](https://github.com/getcortexlabs/orbit/blob/main/backend/internal/domain/build_capacity.go) specifies 2,048 MiB and 2,000 CPU millicores. The user's deployed policy and failed deployment were not directly inspected. Do not claim the local reproduction proves the exact cause of the hosted failure.

## Findings and decisions

- `npm audit` reproduced four affected packages: `fast-uri`, `esbuild`, `vite` and `vitepress` (three moderate, one high). Update the compatible `fast-uri` lock entry to 3.1.9. Scope a Vite 6.4.6 override to VitePress 1.6.4; its bundled Vue plugin 5.2.4 declares Vite 5/6 compatibility. This replaces the old nested esbuild with 0.25.12. The separate Vite 8/Vitest toolchain is unchanged. Audit after the change: zero vulnerabilities. Revisit the override when stable VitePress supplies patched dependencies.
- VitePress defaults `buildConcurrency` to 64 for search indexing and SSR rendering. Set it to four to bound concurrent page work. This alone did **not** resolve the 2 GiB reproduction.
- In a memory-constrained Node 22 container, the implicit old-space heap exhausted at approximately 1 GiB. Set **only the documentation build process** to `--max-old-space-size=1280`. Native allocations and other build processes must still fit in the container budget; this flag does not increase physical memory.
- The only chunks exceeding 500 kB are the four locale search indexes: approximately 765–842 kB on the baseline. VitePress already imports one locale index lazily when search opens. Keep the warning visible and preserve full-text search, API identifiers and Chinese tokenization. Raising `chunkSizeWarningLimit` would not fix memory exhaustion.
- CPU quota throttling measures delayed CPU execution, not build failure. It is still present in successful constrained runs. Kernel OOM kills and V8 heap errors are separate: the reported hosted log mentioned kernel OOM kills; the local reproduction below hit V8's heap limit with zero kernel OOM kills.

## Linux container acceptance — 2026-11-10

Docker image `node:22-bookworm-slim`, local image ID `sha256:a48b3f87a17b11bb338dd993e56878c677cbd9218cf3ab94db07b197e95d7a3a`, Linux arm64. All runs used two CPUs, 2 GiB memory, and `--memory-swap 2g` (no swap). Sources were copied into isolated temporary directories; Linux dependencies were installed with `npm ci --ignore-scripts` in anonymous volumes, separate from macOS dependencies. The final build used the committed `npm run docs:build` command with no environment override.

| Candidate                                                           | Result                       | Kernel OOM kills |
| ------------------------------------------------------------------- | ---------------------------- | ---------------: |
| Baseline, implicit heap, concurrency 64                             | V8 heap exhaustion, exit 134 |                0 |
| Patched dependencies, implicit heap, concurrency 4                  | V8 heap exhaustion, exit 134 |                0 |
| Patched dependencies, 1,280 MiB heap via environment, concurrency 4 | Build passed in 28.86 s      |                0 |
| Final npm script, patched dependencies, concurrency 4               | Build passed in 29.93 s      |                0 |

The final cgroup recorded memory reclaim at its 2 GiB ceiling (`memory.peak = 2147483648`, `memory.events.max = 3811`), but `oom` and `oom_kill` were zero. This includes filesystem cache and does **not** demonstrate spare memory or support for smaller containers. The final run still recorded 78 throttled CPU periods; those did not prevent success. Times are single local observations, not a hosted performance benchmark.

Before merge/deploy, use the PR checks. After deployment, verify Orbit's actual build policy and the final deployment result. If the policy is smaller than 2 GiB or other processes share its budget, adjust the build allocation based on diagnostics. Do not blindly increase Node's heap within the same memory limit.

## Regression evidence

- `npm run docs:test-site`: all existing interaction checks passed in Chromium and WebKit.
- Root audit: zero vulnerabilities.
- Unit suite: 1,789 tests across 130 files passed; root typecheck passed.
- `npm run docs:check-media`: 450 recordings preserved across four locales; all 71 Web playground methods accounted for.
- `npm run docs:build`: passed locally and using the final command in the constrained Linux container.
- `node benchmarks/docs-build-resources/review.mjs`: Chromium and WebKit, all four locales, verified full-text results, API identifiers, an unspaced Chinese query, result navigation, no page errors, and exactly one locale-specific search index loaded per fresh page.

To repeat search acceptance after starting a dedicated docs preview:

```sh
npm run docs:preview -- --host 127.0.0.1 --port 5189
# In a second terminal:
JOLT_SITE_URL=http://127.0.0.1:5189 node benchmarks/docs-build-resources/review.mjs
```

No visible feature or animation behavior was changed, so existing reviewed recordings remain applicable. This is not a new Web runtime capability and requires no Mavis adoption task.
