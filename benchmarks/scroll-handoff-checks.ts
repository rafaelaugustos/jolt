import {
  GridLayout,
  Label,
  ScrollView,
  knownFolders,
  type LayoutBase,
} from '@nativescript/core'
import { bind } from '@rafaelaugusto/jolt'
import { GestureSurface, gestures } from '@rafaelaugusto/jolt/gestures'
import { parseTrace, scrollHandoffTraceGraph } from '@rafaelaugusto/jolt/testing'
import {
  nativeScrollHandoffTraceGraph,
  replayWithDriver,
  nativeTracePosition,
} from '@rafaelaugusto/jolt/testing/native'
import fixture from './traces/scroll-sheet-handoff.json'

export async function runScrollHandoffChecks(
  host: LayoutBase,
  runId: string,
  signal?: { readonly aborted: boolean },
) {
  const start = Date.now(),
    container = new GridLayout(),
    surface = new GestureSurface(),
    scroll = new ScrollView(),
    content = new Label()
  container.height = 380
  surface.height = 200
  surface.verticalAlignment = 'top'
  scroll.height = 200
  content.height = 600
  content.text = 'Scroll handoff fixture'
  scroll.content = content
  surface.addChild(scroll)
  container.addChild(surface)
  host.addChild(container)
  const reports = []
  try {
    const deadline = Date.now() + 1500
    while ((!surface.isLoaded || scroll.scrollableHeight < 399) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 16))
    for (const native of [false, true]) {
      const report = await replayWithDriver(
        parseTrace(fixture),
        (trace) =>
          native
            ? nativeScrollHandoffTraceGraph(trace.motions, surface, scroll)
            : scrollHandoffTraceGraph(trace.motions),
        { native, signal },
      )
      reports.push({ native, report })
      if (!report.passed) {
        knownFolders
          .documents()
          .getFile('jolt-replay-failure.json')
          .writeTextSync(
            JSON.stringify(
              { runId, name: 'scroll-sheet-handoff', native, ...report },
              null,
              2,
            ),
          )
        knownFolders
          .documents()
          .getFile('jolt-replay-failure.svg')
          .writeTextSync(report.plot)
        throw new Error(
          `Scroll handoff (${native ? 'native' : 'engine'}): ${report.errors.join('; ')}`,
        )
      }
    }
    const negative = parseTrace(fixture)
    const sample = negative.entries.find(
      (e) => 'expected' in e && e.at === 32 && e.id === 'scroll',
    )!
    if ('expected' in sample) sample.expected.position = 80
    const rejected = await replayWithDriver(
      negative,
      (trace) => nativeScrollHandoffTraceGraph(trace.motions, surface, scroll),
      { native: true, signal },
    )
    if (
      rejected.passed ||
      rejected.remainingResources !== 0 ||
      !rejected.observations.some((o) => o.id === 'scroll' && o.positionError > 70)
    )
      throw new Error('Scroll handoff negative control failed to detect the wrong owner.')
    // Rejection must not replace an existing owner's native session or presentation.
    const owner = gestures(surface, {
      pan: { axis: 'y', bounds: { top: 0, bottom: 160 } },
      scrollView: scroll,
      initial: { y: 24 },
    })
    const unbind = bind(surface, { y: owner.y })
    let ownershipRejected = false
    try {
      try {
        nativeScrollHandoffTraceGraph(parseTrace(fixture).motions, surface, scroll)
      } catch (error) {
        ownershipRejected = String(error).includes('unowned')
      }
      if (!ownershipRejected)
        throw new Error('Replay replaced an existing gesture owner.')
      owner.jumpTo({ y: 40 })
      await new Promise((resolve) => setTimeout(resolve, 50))
      if (Math.abs(nativeTracePosition(surface, 'y') - 40) > 1)
        throw new Error('Rejected replay changed the existing owner.')
    } finally {
      unbind()
      owner.dispose()
    }
    if (!surface.isUserInteractionEnabled || !scroll.isUserInteractionEnabled)
      throw new Error('Replay did not restore touch input.')
    return {
      ownershipRejected,
      reports,
      negativeControl: {
        passed: !rejected.passed,
        errors: rejected.errors,
        remainingResources: rejected.remainingResources,
      },
      durationMs: Date.now() - start,
    }
  } finally {
    host.removeChild(container)
  }
}
