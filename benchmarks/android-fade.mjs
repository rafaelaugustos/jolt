import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const [serial, output] = process.argv.slice(2)
if (!serial || !output)
  throw new Error('Usage: node benchmarks/android-fade.mjs DEVICE OUTPUT_DIRECTORY')
const pkg = 'org.nativescript.jolt.benchmark'
const file = `/sdcard/Android/data/${pkg}/files/jolt-fade.json`
const adb = (...args) =>
  execFileSync('adb', ['-s', serial, ...args], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  }).trim()
const save = (name, value) =>
  writeFileSync(
    join(output, name),
    typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n',
  )
const report = () => JSON.parse(adb('shell', 'cat', file))
mkdirSync(output, { recursive: true })
const initial = report()
if (
  !initial.lifecyclePassed ||
  initial.phase !== 'ready' ||
  initial.debuggable ||
  initial.build.bundleMode !== 'production'
) {
  throw new Error('Open the Release benchmark and wait for Ready before collecting.')
}
save('device.json', {
  serial,
  collectedAt: new Date().toISOString(),
  fingerprint: adb('shell', 'getprop', 'ro.build.fingerprint'),
  emulator: adb('shell', 'getprop', 'ro.kernel.qemu') === '1',
  gpu: adb('shell', 'dumpsys', 'SurfaceFlinger')
    .split('\n')
    .filter((line) => /GLES:|RenderEngine:/.test(line)),
  benchmark: initial,
})

function frames(text) {
  const result = []
  let columns
  for (const line of text.split('\n')) {
    if (line.startsWith('Flags,')) {
      columns = line.split(',').filter(Boolean)
      continue
    }
    if (!columns || !/^\d+,/.test(line)) continue
    const values = line.split(',').map(Number)
    const entry = Object.fromEntries(columns.map((name, i) => [name, values[i]]))
    if (entry.Flags === 0 && entry.FrameCompleted > entry.IntendedVsync)
      result.push(entry)
  }
  return result
}
function stats(values) {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b)
  if (!sorted.length) return null
  return {
    count: sorted.length,
    median:
      sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted.at(-1),
  }
}
function summarize(text) {
  const data = frames(text)
  return {
    samples: data.length,
    frameMs: stats(data.map((row) => (row.FrameCompleted - row.IntendedVsync) / 1e6)),
    drawMs: stats(data.map((row) => (row.SyncQueued - row.DrawStart) / 1e6)),
    commandMs: stats(
      data.map((row) => (row.SwapBuffers - row.IssueDrawCommandsStart) / 1e6),
    ),
    missedDeadlines: data.filter(
      (row) => row.FrameDeadline > 0 && row.FrameCompleted > row.FrameDeadline,
    ).length,
    gfxinfo: text
      .split('\n')
      .filter((line) => /Total frames rendered:|Janky frames:|percentile:/.test(line)),
  }
}

const summaries = []
// ABBAAB balances order while giving three runs to each mode.
for (const [index, mode] of [
  'baseline',
  'hardware',
  'hardware',
  'baseline',
  'baseline',
  'hardware',
].entries()) {
  const id = `${index + 1}-${mode}`
  adb('shell', 'dumpsys', 'gfxinfo', pkg, 'reset')
  adb(
    'shell',
    'am',
    'broadcast',
    '-a',
    'org.nativescript.jolt.FADE_BENCHMARK',
    '-p',
    pkg,
    '--es',
    'mode',
    mode,
  )
  await sleep(1500)
  const activation = adb('shell', 'dumpsys', 'gfxinfo', pkg, 'framestats')
  save(`${id}-activation.txt`, activation)
  save(`${id}-memory.txt`, adb('shell', 'dumpsys', 'meminfo', pkg))
  await sleep(1000)
  if (report().phase !== 'sampling') throw new Error(`Unexpected phase during ${id}`)
  adb('shell', 'dumpsys', 'gfxinfo', pkg, 'reset')
  await sleep(5500)
  const data = report()
  if (data.phase !== 'done' || data.mode !== mode || data.layerAfter !== 0)
    throw new Error(`Incomplete run: ${id}`)
  const steady = adb('shell', 'dumpsys', 'gfxinfo', pkg, 'framestats')
  if (frames(steady).length < 30) throw new Error(`Insufficient displayed frames: ${id}`)
  save(`${id}-steady.txt`, steady)
  save(`${id}-report.json`, data)
  const summary = {
    id,
    mode,
    activation: summarize(activation),
    steady: summarize(steady),
  }
  summaries.push(summary)
  save('summary.json', summaries)
  console.log(
    `${id}: ${summary.steady.samples} frames, median ${summary.steady.frameMs?.median.toFixed(3)} ms, layer restored`,
  )
}
console.log(`Saved native reports and raw gfxinfo to ${output}`)
