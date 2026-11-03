import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('collects completed and cancelled tracks while their public handles stay reachable', () => {
  const script = fileURLToPath(
    new URL('../benchmarks/playback-retention.mjs', import.meta.url),
  )
  const report = JSON.parse(
    execFileSync(process.execPath, [script], { encoding: 'utf8', timeout: 30000 }),
  )
  expect(
    report.rounds.map((round) => ({
      handles: round.handles,
      liveTracks: round.liveTracks,
    })),
  ).toEqual([
    { handles: 250, liveTracks: 0 },
    { handles: 500, liveTracks: 0 },
    { handles: 750, liveTracks: 0 },
    { handles: 1000, liveTracks: 0 },
  ])
}, 30000)
