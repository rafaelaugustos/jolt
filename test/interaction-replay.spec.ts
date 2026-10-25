import springFixture from '../benchmarks/traces/interrupted-spring.json'
import dragFixture from '../benchmarks/traces/cancelled-drag.json'
import { describe, expect, it, vi } from 'vitest'
import { configure } from '../src/config.js'
import { createTrack } from '../src/track.js'
import { resolveTransition } from '../src/transition.js'
import { getDriver } from '../src/driver/index.js'
import {
  parseTrace,
  recordInteraction,
  replayInteraction,
  traceRandom,
  type InteractionTrace,
} from '../src/testing/index.js'
import { motionTraceGraph, ReplayClock, replayWithDriver } from '../src/testing/native.js'
import { createView, driver } from './helpers.js'

function fixture(name = 'interrupted-spring') {
  return parseTrace(name === 'interrupted-spring' ? springFixture : dragFixture)
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const replay = (trace: InteractionTrace) => {
  const view = createView()
  return replayWithDriver(trace, (t) => motionTraceGraph(t.motions, () => view))
}

describe('interaction trace format and recorder', () => {
  it('copies numeric inputs and preserves timestamps, ties and long gaps', () => {
    const source = fixture()
    let time = 2_000_000_000
    const recorder = recordInteraction({ now: () => time, ...source })
    const input = { type: 'target' as const, id: 'card', value: 180 }
    recorder.input(input)
    input.value = 99
    time += 288
    recorder.checkpoint('card', { position: 20, velocity: 0, settled: true })
    const trace = recorder.stop()
    expect(trace.entries).toMatchObject([{ at: 0, input: { value: 180 } }, { at: 288 }])
    expect(() => recorder.input(input)).toThrow(/stopped/)
    trace.entries.length = 0
    expect(recorder.stop().entries).toHaveLength(2)
  })
  it('rejects text/image/native fields instead of quietly retaining them', () => {
    const trace = fixture()
    for (const extra of [
      { text: 'private message' },
      { image: 'private pixels' },
      { native: {} },
    ]) {
      const copy = clone(trace)
      Object.assign((copy.entries[0] as any).input, extra)
      expect(() => parseTrace(copy)).toThrow(/fields/)
    }
  })
  it('rejects unsupported versions, nonmonotonic time, invalid identities and NaN', () => {
    const trace = fixture()
    expect(() => parseTrace({ ...trace, version: 2 })).toThrow(/version/)
    const backwards = clone(trace)
    backwards.entries[3]!.at = 1
    expect(() => parseTrace(backwards)).toThrow()
    const unknown = clone(trace)
    ;(unknown.entries[0] as any).input.id = 'unknown'
    expect(() => parseTrace(unknown)).toThrow(/unknown/)
    const invalid = clone(trace)
    ;(invalid.entries[0] as any).input.value = NaN
    expect(() => parseTrace(invalid)).toThrow(/finite/)
    expect(() =>
      parseTrace({ ...trace, motions: [...trace.motions, ...trace.motions] }),
    ).toThrow(/unique/)
  })
  it('keeps random sources local, seeded and repeatable', () => {
    const a = traceRandom(63),
      b = traceRandom(63),
      c = traceRandom(64)
    const first = Array.from({ length: 12 }, a)
    expect(first).toEqual(Array.from({ length: 12 }, b))
    expect(first).not.toEqual(Array.from({ length: 12 }, c))
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true)
  })
})

describe('actual engine replay on a controllable driver', () => {
  for (const name of ['interrupted-spring', 'cancelled-drag'])
    it(`replays ${name} against frozen regression checkpoints`, async () => {
      const report = await replay(fixture(name))
      expect(report.errors).toEqual([])
      expect(report.passed).toBe(true)
      expect(report.remainingResources).toBe(0)
      expect(getDriver()).toBe(driver)
    })
  it('preserves nonzero spring velocity on the exact target handoff', async () => {
    const report = await replay(fixture())
    const handoff = report.observations.filter((s) => s.at === 96)
    expect(handoff).toHaveLength(2)
    expect(handoff[0]!.observed.velocity).toBeGreaterThan(100)
    expect(handoff[1]!.observed.position).toBeCloseTo(handoff[0]!.observed.position, 8)
    expect(handoff[1]!.observed.velocity).toBeCloseTo(handoff[0]!.observed.velocity, 1)
  })
  it('fails a deliberate presentation mismatch and includes the original trace and plot', async () => {
    const trace = fixture()
    const checkpoint = trace.entries.find((e) => 'expected' in e)!
    if ('expected' in checkpoint) checkpoint.expected.position += 80
    const report = await replay(trace)
    expect(report.passed).toBe(false)
    expect(report.errors.some((error) => error.includes('position error 80'))).toBe(true)
    expect(report.trace).toEqual(trace)
    expect(report.plot).toContain('<svg')
    expect(report.plot).toContain('polyline')
    expect(report.remainingResources).toBe(0)
  })
  it('advances across a long frame once, without synthesizing intermediate callbacks', () => {
    const clock = new ReplayClock(),
      frames: number[] = []
    const frame = () => {
      frames.push(clock.now())
      clock.frame(frame)
    }
    clock.frame(frame)
    clock.advanceTo(16)
    clock.advanceTo(288)
    expect(frames).toEqual([16, 288])
    clock.dispose()
    expect(clock.resources).toBe(0)
  })
  it('audits leaked subscriptions after disposal and cleans the driver in finally', async () => {
    const report = await replayWithDriver(fixture(), (t) => {
      const graph = motionTraceGraph(t.motions, () => createView())
      return { ...graph, resources: () => 1 }
    })
    expect(report.passed).toBe(false)
    expect(report.remainingResources).toBe(1)
    expect(getDriver()).toBe(driver)
  })
  it('disposes on cancellation, errors and missing checkpoint fixtures', async () => {
    const dispose = vi.fn(),
      resources = vi.fn(() => 0)
    const report = await replayInteraction(fixture(), {
      advanceTo() {},
      signal: { aborted: true },
      create: () => ({
        input() {},
        read: () => ({ position: 0, velocity: 0, settled: false }),
        dispose,
        resources,
      }),
    })
    expect(report.passed).toBe(false)
    expect(dispose).toHaveBeenCalledOnce()
    expect(resources).toHaveBeenCalledOnce()
    const empty = fixture()
    empty.entries = []
    expect((await replay(empty)).passed).toBe(false)
  })
  it('rejects a changed global motion configuration before creating a graph', async () => {
    configure({ timeScale: 0.5 })
    await expect(replay(fixture())).rejects.toThrow(/Configure/)
    expect(getDriver()).toBe(driver)
  })
  it('preserves environment events and fails unsupported routing instead of silently passing', async () => {
    const trace = fixture('cancelled-drag')
    const inputs = [
      { type: 'layout' as const, id: 'card', x: 4, y: 8, width: 300, height: 500 },
      { type: 'keyboard' as const, inset: 280 },
      { type: 'scroll' as const, id: 'card', offset: 42 },
    ]
    trace.entries.unshift(...inputs.map((input) => ({ at: 0, input })))
    expect(parseTrace(JSON.stringify(trace)).entries.slice(0, 3)).toEqual(
      trace.entries.slice(0, 3),
    )
    const unsupported = await replay(trace)
    expect(unsupported.passed).toBe(false)
    expect(unsupported.errors[0]).toContain('no adapter for layout')
    expect(unsupported.remainingResources).toBe(0)
    const received: unknown[] = []
    const report = await replayWithDriver(trace, (t) =>
      motionTraceGraph(t.motions, () => createView(), {
        environment: (event) => {
          received.push(event)
        },
      }),
    )
    expect(report.passed).toBe(true)
    expect(received).toEqual(inputs)
  })
  it('restores the original driver and disposes bindings when native presentation fails', async () => {
    const view = createView()
    const report = await replayWithDriver(
      fixture(),
      (t) => motionTraceGraph(t.motions, () => view),
      {
        native: true,
        present: async () => {
          throw new Error('presentation unavailable')
        },
      },
    )
    expect(report.passed).toBe(false)
    expect(report.errors).toContain('presentation unavailable')
    expect(report.remainingResources).toBe(0)
    expect(getDriver()).toBe(driver)
  })
  it('restores the driver even when an adapter leaks a track and native stop throws', async () => {
    const stop = vi.spyOn(driver, 'stop').mockImplementation(() => {
      throw new Error('native stop failed')
    })
    const run = () =>
      replayWithDriver(
        fixture(),
        () => {
          getDriver().play(
            createView(),
            createTrack('x', [0, 100], resolveTransition({ duration: 500 }, 'x', 2), 0),
            0,
            () => {},
          )
          return {
            input() {
              throw new Error('adapter failed')
            },
            read: () => ({ position: 0, velocity: 0, settled: false }),
            dispose() {
              throw new Error('adapter disposal failed')
            },
            resources: () => 1,
          }
        },
        { native: true, present: async () => {} },
      )
    try {
      await expect(run()).rejects.toThrow('native stop failed')
      expect(getDriver()).toBe(driver)
    } finally {
      stop.mockRestore()
    }
    expect((await replay(fixture())).passed).toBe(true)
  })
})
