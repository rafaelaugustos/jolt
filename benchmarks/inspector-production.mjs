import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  treeShaking: true,
  platform: 'neutral',
  format: 'esm',
  packages: 'external',
  write: false,
})
if (
  /JoltMotionProbe|MotionProbe|createMotionInspector|inspectViewMotion|inspectViewBindings/.test(
    result.outputFiles[0].text,
  )
)
  throw new Error('Development inspector code leaked into the production core bundle.')
console.log('PASS: production core bundle excludes inspector hooks, probe bridge and UI.')
