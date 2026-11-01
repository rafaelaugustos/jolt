import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { samplingCases } from '../curve-sampling-cases.js'
import type { AnimateOptions } from '../../src/web/types.js'
import type {} from './fixture.js'

test('renders the existing native compiler baseline in real DOM targets', async ({
  page,
}) => {
  await page.goto('/')
  // These inputs and pre-extraction native observations are also consumed by
  // test/portable-core.spec.ts. Do not regenerate the baseline from Web output.
  const baseline = JSON.parse(
    readFileSync(
      new URL('../../test/fixtures/portable-motion-baseline.json', import.meta.url),
      'utf8',
    ),
  )
  const cases = samplingCases
    .filter(
      (c) =>
        !c.velocity &&
        (!('ease' in c.transition) || typeof c.transition.ease !== 'function'),
    )
    .map((c) => ({
      ...c,
      expected: baseline.cases[c.name] as { end: number; probes: number[][] },
    }))
  const results = await page.evaluate((cases) => {
    const runtime = lab.createWebRuntime(document, { reducedMotion: 'never' })
    return cases.map((c) => {
      const target = lab.makeTarget()
      const h = runtime.animate(
        target,
        { [c.property]: c.frames },
        c.transition as AnimateOptions,
      )
      h.pause()
      const errors = c.expected.probes
        .filter((p) => p[0]! >= 0 && p[0]! <= h.duration)
        .map(([time, position]) => {
          h.progress = time! / h.duration
          const css = getComputedStyle(target),
            m = new DOMMatrix(css.transform)
          const actual =
            c.property === 'opacity'
              ? Number(css.opacity)
              : c.property === 'scaleX'
                ? m.a
                : c.property === 'rotate'
                  ? (Math.atan2(m.b, m.a) * 180) / Math.PI
                  : m.e
          const expected =
            c.property === 'opacity' ? Math.max(0, Math.min(1, position!)) : position!
          return c.property === 'rotate'
            ? Math.abs(((actual - expected + 540) % 360) - 180)
            : Math.abs(actual - expected)
        })
      runtime.release(target)
      target.remove()
      return {
        name: c.name,
        property: c.property,
        duration: h.duration,
        expectedDuration: c.expected.end,
        error: Math.max(...errors),
      }
    })
  }, cases)
  expect(results).toHaveLength(11)
  for (const r of results) {
    expect(r.duration, r.name).toBeCloseTo(r.expectedDuration, 5)
    const tolerance =
      r.property === 'opacity'
        ? 0.0021
        : r.property === 'scaleX'
          ? 0.0011
          : r.property === 'rotate'
            ? 0.11
            : 0.3
    expect(r.error, r.name).toBeLessThan(tolerance)
  }
})
