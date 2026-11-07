import { expect, test } from '@playwright/test'
import type {} from './fixture.js'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.depth)
})

test('adapter inspection identifies replacement, updates, renderer demand and teardown', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.depth.scope.dispose()
    const runtime = window.depth.runtime,
      scope = runtime.scope()
    const inspector = window.depth.createMotionInspector(document, runtime, {
      development: true,
      capacity: 24,
    })
    const target = { value: 0 },
      property = scope.property(target, {
        name: 'fixture/uniform',
        units: ['ratio'],
        read: (o) => (o as typeof target).value,
        write: (o, value: number) => {
          ;(o as typeof target).value = value
        },
        encode: (v) => [v],
        decode: (v) => v[0]!,
      })
    const activity = scope.renderActivity({ change() {}, redraw() {} })
    inspector.adapters.watch(property, 'material')
    inspector.adapters.activity(activity, 'scene')
    const first = property.animate(1, { duration: 1000 })
    inspector.adapters.label(first, 'hover')
    activity.track(first)
    first.pause()
    first.progress = 0.4
    first.play()
    const second = property.animate(2, { duration: 1000 })
    inspector.adapters.label(second, 'click')
    activity.track(second)
    const during = inspector.read()
    second.pause()
    second.progress = 0.8
    const paused = inspector.read()
    scope.dispose()
    const after = inspector.read()
    inspector.dispose()
    return {
      during,
      paused,
      after,
      first: await first.finished,
      second: await second.finished,
    }
  })
  expect(result.first).toBe(false)
  expect(result.second).toBe(false)
  expect(result.during.adapters.properties[0]!.ownerLabel).toBe('click')
  expect(result.during.adapters.events.find((e) => e.kind === 'replace')).toMatchObject({
    previousLabel: 'hover',
    ownerLabel: 'click',
  })
  expect(result.during.adapters.activities[0]!.active).toBe(true)
  expect(result.paused.adapters.properties[0]!.paused).toBe(true)
  expect(result.paused.adapters.cost.writes).toBeGreaterThan(0)
  expect(result.after.adapters.properties).toHaveLength(0)
  expect(result.after.adapters.activities).toHaveLength(0)
  expect(result.after.diagnostics.resources.propertyResources).toBe(0)
  expect(result.after.diagnostics.resources.renderActivities).toBe(0)
  expect(result.after.diagnostics.resources.frameTasks).toBe(0)
})

test('editing uses existing application handles and borrows diagnostics without claiming motion', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.depth.scope.dispose()
    const runtime = window.depth.runtime,
      target = document.getElementById('source')!
    runtime.release(target)
    const diagnostic = runtime.diagnostics({ development: true })
    const inspector = window.depth.createMotionInspector(document, runtime, {
      development: true,
      diagnostics: diagnostic,
    })
    inspector.watch(target, 'card')
    const animation = runtime.animate(
      target,
      { x: 100 },
      { duration: 1000, ease: 'linear' },
    )
    await animation.ready
    inspector.track(animation, 'move')
    inspector.control('move', 'pause')
    inspector.control('move', 'seek', 0.5)
    const snapshot = inspector.read()
    let edited: object | undefined
    inspector.tune({ duration: 500, bounce: 0.2 }, (value) => {
      edited = value
    })
    const code = window.depth.springCode({
      to: 100,
      spring: { duration: 500, bounce: 0.2 },
    })
    target.remove()
    const removed = inspector.read()
    inspector.dispose()
    const stillActive = !diagnostic.snapshot().disposed
    animation.stop()
    diagnostic.dispose()
    return { snapshot, removed, edited, code, stillActive }
  })
  expect(new Set(result.snapshot.diagnostics.targets.map((t) => t.id))).toContain(
    result.snapshot.targets[0]!.target,
  )
  expect(result.snapshot.playback[0]!.paused).toBe(true)
  expect(result.snapshot.targets[0]!.transform).toContain('50')
  expect(result.edited).toEqual({ type: 'spring', duration: 500, bounce: 0.2 })
  expect(result.code).toContain('runtime.animate(card')
  expect(result.removed.targets).toHaveLength(0)
  expect(result.stillActive).toBe(true)
})

test('bounded public semantic traces replay drag inputs and a large time jump with real browser playback', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.depth.scope.dispose()
    const runtime = window.depth.runtime,
      target = document.getElementById('source')!
    runtime.release(target)
    let at = 0
    const recorder = window.depth.recordInteraction({
      now: () => at,
      seed: 7,
      metadata: {
        platform: 'web',
        os: 'browser',
        model: 'fixture',
        refreshRate: 60,
        density: 1,
        width: 400,
        height: 300,
      },
      settings: { timeScale: 1, reducedMotion: false },
      motions: [
        {
          id: 'card',
          kind: 'drag',
          axis: 'x',
          initial: 0,
          stiffness: 100,
          damping: 20,
          mass: 1,
          min: 0,
          max: 200,
          snap: [0, 200],
        },
      ],
    })
    const gesture = (phase: 'begin' | 'move' | 'end', x: number) =>
      recorder.input({
        type: 'gesture',
        id: 'card',
        phase,
        x,
        y: 0,
        velocityX: 0,
        velocityY: 0,
        pointers: [1],
      })
    gesture('begin', 0)
    at = 100
    gesture('move', 80)
    recorder.checkpoint('card', { position: 80, velocity: 0, settled: false })
    at = 200
    gesture('end', 180)
    at = 5000
    recorder.checkpoint('card', { position: 200, velocity: 0, settled: true })
    const trace = recorder.stop()
    const reports = []
    // This explicit application adapter translates semantic events through public APIs.
    // It deliberately supports only one-pointer x drag and finite spring playback.
    for (let pass = 0; pass < 2; pass++) {
      let now = 0,
        start = 0,
        dragging = false,
        animation: ReturnType<typeof runtime.animate> | undefined
      let disposed = false
      const scope = runtime.scope()
      const report = await window.depth.replayInteraction(trace, {
        advanceTo(time) {
          now = time
          if (animation)
            animation.progress = Math.min(1, (now - start) / animation.duration)
        },
        create() {
          runtime.set(target, { x: 0 })
          return {
            async input(event) {
              if (
                event.type !== 'gesture' ||
                event.id !== 'card' ||
                event.pointers.length !== 1
              )
                throw new Error('Unsupported fixture replay operation')
              if (event.phase === 'begin') {
                dragging = true
                animation?.stop()
              } else if (event.phase === 'move') runtime.set(target, { x: event.x })
              else if (event.phase === 'end') {
                dragging = false
                start = now
                animation = scope.animate(
                  target,
                  { x: 200 },
                  { stiffness: 100, damping: 20, mass: 1 },
                )
                await animation.ready
                animation.pause()
                animation.progress = 0
              } else {
                animation?.stop()
                dragging = false
              }
            },
            read() {
              return {
                position: new DOMMatrix(getComputedStyle(target).transform).m41,
                velocity: 0,
                settled: !dragging && (!animation || animation.progress === 1),
              }
            },
            dispose() {
              scope.dispose()
              runtime.release(target)
              disposed = true
            },
            resources() {
              return disposed ? scope.size : scope.size + 1
            },
          }
        },
      })
      reports.push({
        passed: report.passed,
        observations: report.observations,
        remaining: report.remainingResources,
      })
    }
    return { reports, entries: trace.entries.length }
  })
  expect(result.reports.every((r) => r.passed && r.remaining === 0)).toBe(true)
  expect(result.reports[0]).toEqual(result.reports[1])
  expect(result.entries).toBe(5)
})
