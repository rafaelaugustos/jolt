import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { summarizeFrames } from './android-busy-report.mjs'

const [serial, output] = process.argv.slice(2)
if (!serial || !output)
  throw Error('Usage: node benchmarks/android-busy.mjs DEVICE OUTPUT_DIRECTORY')
const pkg = 'org.nativescript.jolt.benchmark'
const adb = (...args) =>
  execFileSync('adb', ['-s', serial, ...args], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  }).trim()
const report = () =>
  JSON.parse(adb('shell', 'cat', `/sdcard/Android/data/${pkg}/files/jolt-busy.json`))
const save = (file, value) =>
  writeFileSync(
    join(output, file),
    typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n',
  )
mkdirSync(output, { recursive: true })
const initial = report()
if (
  initial.phase !== 'ready' ||
  !initial.lifecyclePassed ||
  initial.debuggable ||
  initial.build.bundleMode !== 'production'
)
  throw Error('Open the release busy benchmark and wait for Ready.')
save('device.json', {
  serial,
  collectedAt: new Date().toISOString(),
  fingerprint: adb('shell', 'getprop', 'ro.build.fingerprint'),
  emulator: adb('shell', 'getprop', 'ro.kernel.qemu') === '1',
  benchmark: initial,
})
const results = []
// Rotate order to give each mode an early, middle and late position.
for (const [index, mode] of [
  'idle',
  'main',
  'worker',
  'worker',
  'idle',
  'main',
  'main',
  'worker',
  'idle',
].entries()) {
  const id = `${index + 1}-${mode}`
  adb('shell', 'dumpsys', 'gfxinfo', pkg, 'reset')
  adb(
    'shell',
    'am',
    'broadcast',
    '-a',
    'org.nativescript.jolt.BUSY_BENCHMARK',
    '-p',
    pkg,
    '--es',
    'mode',
    mode,
  )
  let result
  const timeout = Date.now() + 12000
  do {
    await sleep(150)
    result = report()
    if (result.phase === 'error') throw Error(result.error)
    if (Date.now() > timeout) throw Error(`Timeout in ${id}`)
  } while (
    result.phase !== 'done' ||
    result.result.mode !== mode ||
    results.some((previous) => previous.startedAt === result.result.startedAt)
  )
  const trial = result.result
  if (trial.layerAfter !== 0 || trial.completedAt - trial.startedAt < 1500)
    throw Error(`Invalid native completion: ${id}`)
  const raw = adb('shell', 'dumpsys', 'gfxinfo', pkg, 'framestats')
  const frames = summarizeFrames(raw, trial)
  if (frames.samples < 20) throw Error(`Not enough native UI frames: ${id}`)
  save(`${id}-gfxinfo.txt`, raw)
  save(`${id}-report.json`, result)
  results.push({
    id,
    mode,
    startedAt: trial.startedAt,
    workMs: trial.work.elapsedMs,
    workerOffMainThread:
      mode === 'worker' ? trial.work.threadId !== trial.mainThreadId : null,
    joltRotationDuringWork: trial.afterWork.jolt - trial.beforeWork.jolt,
    withLayerRotationDuringWork: trial.afterWork.withLayer - trial.beforeWork.withLayer,
    ...frames,
  })
  save('summary.json', results)
  console.log(
    `${id}: work ${trial.work.elapsedMs} ms, UI gap across work ${frames.maxGapAcrossWorkMs?.toFixed(2)} ms`,
  )
  await sleep(250)
}
