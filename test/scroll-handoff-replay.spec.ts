import { describe, it, expect } from 'vitest'
import { observeScrollHandoffInputs } from '../src/testing/handoff-recorder.js'
import { ScrollView } from './shims/core.js'
import fixture from '../benchmarks/traces/scroll-sheet-handoff.json'
import {
  parseTrace,
  replayInteraction,
  scrollHandoffTraceGraph,
} from '../src/testing/index.js'

const replay = (value: unknown) =>
  replayInteraction(parseTrace(value), {
    advanceTo() {},
    create: (trace) => scrollHandoffTraceGraph(trace.motions),
  })
describe('scroll to sheet replay contract', () => {
  it('consumes scroll first when pulling down, reverses through the seam, rebases contacts and cancels', async () => {
    const report = await replay(fixture)
    expect(report.errors).toEqual([])
    expect(report.passed).toBe(true)
    expect(report.remainingResources).toBe(0)
    expect(
      report.observations.find((o) => o.at === 32 && o.id === 'sheet')?.observed,
    ).toEqual({ position: 20, velocity: 250, settled: false })
    expect(
      report.observations.find((o) => o.at === 384 && o.id === 'sheet')?.observed
        .position,
    ).toBe(0)
    expect(
      report.observations.find((o) => o.at === 432 && o.id === 'sheet')?.observed
        .position,
    ).toBe(10)
  })
  it('detects a wrong ownership checkpoint rather than accepting current output as a baseline', async () => {
    const trace = parseTrace(fixture)
    const checkpoint = trace.entries.find(
      (e) => 'expected' in e && e.at === 32 && e.id === 'scroll',
    )!
    if ('expected' in checkpoint) checkpoint.expected.position = 80
    const report = await replay(trace)
    expect(report.passed).toBe(false)
    expect(report.errors).toHaveLength(1)
    expect(report.errors[0]).toContain('scroll at 32 ms: position error 80')
    expect(report.remainingResources).toBe(0)
  })
  it('rejects unsupported layouts and keyboard routing with deterministic cleanup', async () => {
    const trace = parseTrace(fixture)
    trace.entries.unshift({ at: 0, input: { type: 'keyboard', inset: 280 } })
    const report = await replay(trace)
    expect(report.errors[0]).toContain('no adapter for keyboard')
    expect(report.remainingResources).toBe(0)
  })
  it('requires distinct bounded vertical motions without an implicit snap animation', () => {
    const trace = parseTrace(fixture)
    trace.motions[0]!.snap = [0, 160]
    expect(() => scrollHandoffTraceGraph(trace.motions)).toThrow(/no snap/)
    expect(() =>
      scrollHandoffTraceGraph(parseTrace(fixture).motions, {
        sheet: 'sheet',
        scroll: 'sheet',
      }),
    ).toThrow()
  })
  it('ignores an old contact after suspension until a new begin arrives', () => {
    const graph = scrollHandoffTraceGraph(parseTrace(fixture).motions)
    const pan = (phase: 'begin' | 'move', y: number) =>
      graph.input({
        type: 'gesture',
        id: 'sheet',
        phase,
        x: 0,
        y,
        velocityX: 0,
        velocityY: 200,
        pointers: [0],
      })
    pan('begin', 0)
    pan('move', 100)
    graph.input({ type: 'lifecycle', state: 'suspend' })
    pan('move', 1000)
    graph.input({ type: 'lifecycle', state: 'resume' })
    pan('move', 1000)
    expect(graph.read('sheet')).toEqual({ position: 20, velocity: 0, settled: true })
    pan('begin', 1000)
    pan('move', 1010)
    expect(graph.read('sheet').position).toBe(30)
    graph.dispose()
    expect(graph.resources()).toBe(0)
  })
})

describe('raw handoff contact capture', () => {
  it('keeps membership changes in one contact, emits only numeric state and detaches once', () => {
    const scroll = new ScrollView(),
      inputs: any[] = []
    let time = 0
    const detach = observeScrollHandoffInputs(
      scroll as never,
      { input: (event) => inputs.push(event) },
      () => ++time,
    )
    const emit = (action: string, points: { y: number; phase: number }[]) =>
      scroll.notify({
        eventName: 'touch',
        object: scroll,
        action,
        getAllPointers: () =>
          points.map((p) => ({
            ios: {
              phase: p.phase,
              locationInView: () => ({ x: 0, y: p.y }),
              privateContent: 'must not escape',
            },
          })),
      } as never)
    emit('down', [{ y: 10, phase: 0 }])
    emit('down', [
      { y: 10, phase: 2 },
      { y: 30, phase: 0 },
    ])
    emit('up', [
      { y: 10, phase: 2 },
      { y: 30, phase: 3 },
    ])
    emit('up', [{ y: 10, phase: 3 }])
    expect(
      inputs.map((e) => (e.type === 'gesture' ? [e.phase, e.pointers.length] : e.type)),
    ).toEqual(['scroll', ['begin', 1], ['move', 2], ['move', 1], ['end', 0]])
    expect(JSON.stringify(inputs)).not.toContain('privateContent')
    detach()
    detach()
    emit('down', [{ y: 10, phase: 0 }])
    expect(inputs).toHaveLength(5)
    expect(scroll.listenerCount('touch')).toBe(0)
  })
})
