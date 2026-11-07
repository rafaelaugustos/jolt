import { describe, expect, it } from 'vitest'
import {
  adapterEvent,
  adapterMeasure,
  createAdapterInspector,
  registerAdapterInspection,
} from '../src/core/adapter-inspection.js'

describe('explicit adapter diagnostics', () => {
  it('does no timing work unless watched, bounds numeric history and reports unavailable costs', () => {
    const property = {},
      target = {},
      first = {},
      second = {}
    let ticks = 0,
      alive = true
    registerAdapterInspection(property, {
      name: 'fixture/uniform',
      units: ['ratio'],
      platform: 'web',
      target,
      read: () => ({ alive, values: [0.5], owner: second, binding: false }),
    })
    expect(adapterMeasure(property, 'prepare')).toBeUndefined()
    const inspector = createAdapterInspector({
      development: true,
      capacity: 8,
      now: () => ticks++,
    })
    inspector.watch(property, 'material')
    inspector.label(first, 'hover')
    inspector.label(second, 'click')
    adapterEvent(property, 'start', first)
    adapterEvent(property, 'replace', second, first)
    const measured = adapterMeasure(property, 'prepare')!
    measured(122)
    let snapshot = inspector.read()
    expect(snapshot.properties[0]).toMatchObject({
      observation: 'adapter-read',
      values: [0.5],
      ownerLabel: 'click',
    })
    expect(snapshot.events.find((e) => e.kind === 'replace')).toMatchObject({
      ownerLabel: 'click',
      previousLabel: 'hover',
    })
    expect(snapshot.cost.preparedComponents).toBe(122)
    expect(snapshot.unavailable).toEqual([
      'gpuTime',
      'nativeSamplingTime',
      'allocatedBytes',
    ])
    for (let i = 0; i < 20; i++) adapterEvent(property, 'write')
    snapshot = inspector.read()
    expect(snapshot.events).toHaveLength(8)
    expect(snapshot.cost.droppedEvents).toBe(15)
    alive = false
    expect(inspector.read().properties).toHaveLength(0)
    expect(adapterMeasure(property, 'prepare')).toBeUndefined()
    inspector.dispose()
    inspector.dispose()
  })
  it('disposal unregisters resources, leaves playback ownership alone and rejects unsupported introspection', () => {
    const property = {},
      target = {}
    registerAdapterInspection(property, {
      name: 'fixture/native',
      units: ['DIP'],
      platform: 'android',
      target,
      read: () => ({ alive: true, values: null, binding: true }),
    })
    const inspector = createAdapterInspector({ development: true, now: () => 0 })
    expect(() => inspector.watch({}, 'unsupported')).toThrow(/expose/)
    inspector.watch(property, 'native')
    expect(inspector.read().properties[0]!.observation).toBe('unavailable')
    adapterEvent(property, 'dispose')
    expect(inspector.read().properties).toHaveLength(0)
    expect(inspector.read().events.at(-1)!.kind).toBe('dispose')
    inspector.dispose()
    expect(() => inspector.watch(property, 'again')).toThrow(/disposed/)
  })
})
