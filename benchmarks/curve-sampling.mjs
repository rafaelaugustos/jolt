// Use the same Core shim as unit tests; no native module or device is loaded in Node.
import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
const root = fileURLToPath(new URL('../', import.meta.url))
const directory = await mkdtemp(join(tmpdir(), 'jolt-sampler-'))
try {
  const entry = join(directory, 'measure.mjs')
  await build({
    entryPoints: [resolve(root, 'benchmarks/curve-sampling-measure.mts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: entry,
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
    execFileSync(process.execPath, ['--expose-gc', entry], { encoding: 'utf8' }),
  )
} finally {
  await rm(directory, { recursive: true, force: true })
}
