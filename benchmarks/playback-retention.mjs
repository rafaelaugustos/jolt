import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
const root = fileURLToPath(new URL('../', import.meta.url))
const directory = await mkdtemp(join(tmpdir(), 'jolt-retention-'))
const baseline = process.argv[2]
try {
  const entry = join(directory, 'measure.mjs')
  const plugins = baseline
    ? [
        {
          name: 'baseline-engine',
          setup(build) {
            build.onLoad({ filter: /\/src\/engine\.ts$/ }, () => ({
              contents: execFileSync('git', ['show', `${baseline}:src/engine.ts`], {
                cwd: root,
                encoding: 'utf8',
              }),
              loader: 'ts',
              resolveDir: resolve(root, 'src'),
            }))
          },
        },
      ]
    : []
  await build({
    entryPoints: [resolve(root, 'benchmarks/playback-retention-measure.mts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: entry,
    plugins,
    alias: {
      '@nativescript/core/animation-frame': resolve(root, 'test/shims/frame.ts'),
      '@nativescript/core/ui/styling/style-properties': resolve(
        root,
        'test/shims/core.ts',
      ),
      '@nativescript/core/ui/image': resolve(root, 'test/shims/core.ts'),
      '@nativescript/core/ui/text-base': resolve(root, 'test/shims/core.ts'),
      '@nativescript/core': resolve(root, 'test/shims/core.ts'),
    },
  })
  process.stdout.write(
    execFileSync(process.execPath, ['--expose-gc', entry], {
      encoding: 'utf8',
      env: { ...process.env, JOLT_RETENTION_BASELINE: baseline ?? '' },
    }),
  )
} finally {
  await rm(directory, { recursive: true, force: true })
}
