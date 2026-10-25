import { knownFolders, type View } from '@nativescript/core'
import { parseTrace, type ReplayReport } from '@rafaelaugusto/jolt/testing'
import { motionTraceGraph, replayWithDriver } from '@rafaelaugusto/jolt/testing/native'
import spring from './traces/interrupted-spring.json'
import cancelled from './traces/cancelled-drag.json'

/** Bounded correctness checks; no waiting for real-time spring settling or OS gestures. */
export async function runInteractionReplayChecks(
  view: View,
  runId: string,
  signal?: { readonly aborted: boolean },
) {
  const reports: { name: string; native: boolean; report: ReplayReport }[] = []
  for (const [name, source] of [
    ['interrupted-spring', spring],
    ['cancelled-drag', cancelled],
  ] as const) {
    for (const native of [false, true]) {
      const trace = parseTrace(source)
      const report = await replayWithDriver(
        trace,
        (t) => motionTraceGraph(t.motions, () => view, { native }),
        { native, signal },
      )
      reports.push({ name, native, report })
      if (!report.passed) {
        knownFolders
          .documents()
          .getFile('jolt-replay-failure.json')
          .writeTextSync(JSON.stringify({ runId, name, native, ...report }, null, 2))
        knownFolders
          .documents()
          .getFile('jolt-replay-failure.svg')
          .writeTextSync(report.plot)
        throw new Error(
          `Interaction replay ${name} (${native ? 'native' : 'engine'}): ${report.errors.join('; ')}`,
        )
      }
    }
  }
  // A deliberately wrong checkpoint must fail in native presentation, not merely in the engine.
  const negative = parseTrace(spring)
  const sample = negative.entries.find((entry) => 'expected' in entry)!
  if ('expected' in sample) sample.expected.position += 80
  const rejected = await replayWithDriver(
    negative,
    (t) => motionTraceGraph(t.motions, () => view, { native: true }),
    { native: true, signal },
  )
  if (
    rejected.passed ||
    rejected.remainingResources !== 0 ||
    !rejected.observations.some((sample) => sample.positionError > 70)
  )
    throw new Error(
      'Interaction replay negative control did not detect native presentation mismatch.',
    )
  return {
    reports,
    negativeControl: {
      passed: !rejected.passed,
      errors: rejected.errors,
      remainingResources: rejected.remainingResources,
    },
  }
}
