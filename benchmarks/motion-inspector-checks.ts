import { Device, isIOS, type View } from '@nativescript/core'
import {
  animate,
  bind,
  motionValue,
  set,
  stop,
  type PlaybackAnimation,
} from '@rafaelaugusto/jolt'
import {
  createMotionInspector,
  inspectorSpring,
  springCode,
  type MotionInspector,
} from '../dist/inspector/index.js'
import { activeNativeProbes, inspectorCostTime } from '../dist/inspector/probe.js'
import { getDriver } from '../dist/driver/index.js'

export async function runMotionInspectorChecks(
  view: View,
  signal?: { readonly aborted: boolean },
) {
  const started = inspectorCostTime(),
    original = getDriver(),
    before = activeNativeProbes()
  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(
        () =>
          signal?.aborted ? reject(new Error('Inspector check cancelled')) : resolve(),
        ms,
      ),
    )
  function check(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
  }
  const median = (values: number[]) =>
    values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!
  const setup = () => {
    const costs: number[] = []
    for (let i = 0; i < 12; i++) {
      set(view, { x: 0 })
      const at = inspectorCostTime()
      const a = animate(view, { x: 160 }, { type: 'spring', duration: 600, bounce: 0.25 })
      if (i >= 3) costs.push(inspectorCostTime() - at)
      a.stop()
    }
    return median(costs)
  }
  const withoutInspectorMs = setup()
  let inspector: MotionInspector | undefined,
    release: (() => void) | undefined,
    active: PlaybackAnimation | undefined
  try {
    inspector = createMotionInspector({ development: true, capacity: 8, hertz: 60 })
    inspector.watch(view, 'card')
    inspector.select('card')
    check(
      activeNativeProbes() === before + 1,
      'Inspector native sampler was not installed',
    )
    const withInspectorMs = setup()
    set(view, { x: 0 })
    inspector.select('card')
    active = animate(view, { x: 180 }, { duration: 800, ease: 'linear', delay: 120 })
    inspector.label(active, 'Delayed entrance')
    const delay = inspector.read()
    check(
      delay.properties.some((p) => p.delay === 120 && p.label === 'Delayed entrance'),
      'Delayed owner/timing missing',
    )
    await wait(220)
    inspector.read()
    const old = active
    active = animate(view, { x: 20 }, { type: 'spring', duration: 600, bounce: 0.25 })
    inspector.label(active, 'Return')
    check((await old.finished) === false, 'Inspector changed interruption semantics')
    await wait(500)
    const replaced = inspector.read()
    check(
      replaced.events.some(
        (e) =>
          e.kind === 'replace' &&
          e.previousLabel === 'Delayed entrance' &&
          e.label === 'Return',
      ),
      'Interruption owner transition missing',
    )
    check(
      replaced.samples.some((s) => s.observed !== null && s.observed > 0),
      'No native observations',
    )
    check(
      replaced.samples.length <= 8 && replaced.overhead.dropped > 0,
      'Native ring buffer did not bound/drop old samples',
    )
    // Buffer overflow deliberately waits without draining. A busy device can finish
    // that animation before JS resumes; scrub a fresh owner synchronously instead.
    active.stop()
    active = animate(
      view,
      { x: [0, 180] },
      { type: 'spring', duration: 1200, bounce: 0.25 },
    )
    inspector.label(active, 'Scrub preview')
    inspector.control(active, 'seek', 0.35)
    await wait(80)
    const held = inspector.read()
    check(
      active.paused && held.properties.some((p) => p.paused && p.velocity === 0),
      'Scrub did not hold the selected animation',
    )
    const value = held.samples.at(-1)?.observed
    check(value !== null && value !== undefined, 'Missing held native sample')
    const expected = held.samples.at(-1)?.expected
    check(
      expected !== null && expected !== undefined && Math.abs(value - expected) < 2,
      'Held native curve diverged',
    )
    let negativeControl = false
    try {
      check(
        Math.abs(value! - ((expected ?? 0) + 80)) < 2,
        'Injected inspector position mismatch',
      )
    } catch {
      negativeControl = true
    }
    check(negativeControl, 'Inspector negative control was missed')
    inspector.control(active, 'play')
    active.stop()
    const source = motionValue(0.3)
    release = bind(view, { x: source.to([0, 1], [0, 180]) })
    inspector.label(source, 'Progress')
    const graph = inspector.read().bindings
    check(
      graph[0]?.source.label === 'Progress' && graph[0]?.source.mappings.length === 1,
      'Binding dependency graph missing',
    )
    release()
    release = undefined
    active = animate(view, { x: [0, 120] }, { duration: 600 })
    const layer = animate(view, { x: [0, 20] }, { duration: 600, layer: 'press' })
    const owners = inspector.read().properties.filter((p) => p.property === 'x')
    check(
      owners.length === 2 && new Set(owners.map((p) => p.owner)).size === 2,
      'Layer owners were conflated',
    )
    layer.stop()
    active.stop()
    const settings = { duration: 650, bounce: 0.35 },
      code = springCode({ to: 180, spring: settings })
    const copied = JSON.parse(code.slice(code.indexOf('{\n'), code.lastIndexOf(')')))
    check(
      copied.duration === inspectorSpring(settings).duration && copied.velocity === 0,
      'Copied settings changed',
    )
    active = animate(view, { x: [0, 180] }, copied)
    await wait(80)
    const report = inspector.read()
    inspector.dispose()
    inspector = undefined
    check(
      getDriver() === original && activeNativeProbes() === before,
      'Inspector leaked a sampler or driver hook',
    )
    check(!active.paused, 'Disposal changed playback')
    active.stop()
    return {
      status: 'passed',
      platform: isIOS ? 'ios' : 'android',
      os: Device.osVersion,
      kind: 'motion-inspector',
      withoutInspectorSetupMs: withoutInspectorMs,
      withInspectorSetupMs: withInspectorMs,
      overhead: report.overhead,
      nativeSamples: replaced.samples,
      owners: owners.map((p) => ({ owner: p.owner, layer: p.layer })),
      events: replaced.events,
      bindings: graph,
      negativeControl,
      remainingProbes: activeNativeProbes() - before,
      durationMs: inspectorCostTime() - started,
    }
  } finally {
    release?.()
    inspector?.dispose()
    active?.stop()
    stop(view)
    set(view, { x: 0 })
  }
}
