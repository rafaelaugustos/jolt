import { test, expect } from '@playwright/test'
import type {} from './fixture.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/?test')
  await page.evaluate(() => {
    window.rt = lab.createWebRuntime(document, { reducedMotion: 'never' })
    window.target = lab.makeTarget()
  })
})
test.afterEach(async ({ page }) => {
  await page.evaluate(() => rt.dispose())
})

for (const rtl of [false, true])
  for (const execution of ['auto', 'scheduler'] as const) {
    test(`${rtl ? 'RTL' : 'LTR'} ${execution} uses logical positive offsets with idle cleanup`, async ({
      page,
      browserName,
    }) => {
      await page.evaluate(
        ({ rtl, execution }) => {
          window.source = lab.makeSource(rtl)
          window.input = rt.scrollValue(source, { axis: 'x' })
          window.link = rt.scrollLinked(
            source,
            target,
            { x: [0, 200], opacity: [1, 0.5] },
            { range: [0, 1000], axis: 'x', execution },
          )
        },
        { rtl, execution },
      )
      if (execution === 'auto' && browserName === 'chromium')
        expect(await page.evaluate(() => link.execution)).toBe('scroll-timeline')
      for (const offset of [500, 1000, 0, 250]) {
        await page.evaluate(
          ({ offset, rtl }) => {
            source.scrollLeft = offset * (rtl ? -1 : 1)
          },
          { offset, rtl },
        )
        await expect.poll(() => page.evaluate(() => input.get())).toBe(offset)
        await expect
          .poll(() =>
            page.evaluate(() => new DOMMatrix(getComputedStyle(target).transform).e),
          )
          .toBeCloseTo(offset / 5, 1)
        await expect
          .poll(() => page.evaluate(() => Number(getComputedStyle(target).opacity)))
          .toBeCloseTo(1 - offset / 2000, 2)
      }
      await expect
        .poll(() => page.evaluate(() => rt.inspect(document.body).scheduler.pending))
        .toBe(false)
      await page.evaluate(() => {
        link.dispose()
        input.dispose()
      })
      expect(await page.evaluate(() => rt.inspect(document.body).scrollSources)).toBe(0)
    })
  }

test('horizontal document scrolling, derived values and independent vertical source', async ({
  page,
}) => {
  await page.evaluate(() => {
    document.body.style.width = '2400px'
    document.body.style.height = '1800px'
    window.input = rt.scrollValue(document, { axis: 'x' })
    rt.bind(target, { scale: input.to([0, 1000], [1, 2]) })
    window.source = lab.makeSource()
    source.firstElementChild!.setAttribute('style', 'width:1300px;height:800px')
    const vertical = rt.scrollValue(source)
    rt.bind(target, { y: vertical })
    window.scrollTo(500, 100)
    source.scrollTop = 200
  })
  await expect.poll(() => page.evaluate(() => input.get())).toBe(500)
  await expect
    .poll(() => page.evaluate(() => new DOMMatrix(getComputedStyle(target).transform).a))
    .toBeCloseTo(1.5)
  await expect
    .poll(() => page.evaluate(() => new DOMMatrix(getComputedStyle(target).transform).f))
    .toBeCloseTo(200)
})

test('direction changes, geometry refresh and source removal release resources', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.source = lab.makeSource()
    window.input = rt.scrollValue(source, { axis: 'x' })
    rt.bind(target, { x: input })
    source.scrollLeft = 300
  })
  await expect.poll(() => page.evaluate(() => input.get())).toBe(300)
  await page.evaluate(() => {
    source.style.direction = 'rtl'
    source.scrollLeft = -400
  })
  await expect.poll(() => page.evaluate(() => input.get())).toBe(400)
  await page.evaluate(() => {
    ;(source.firstElementChild as HTMLElement).style.width = '500px'
    input.refresh()
  })
  await expect.poll(() => page.evaluate(() => input.get())).toBe(200)
  await page.evaluate(() => source.remove())
  await expect
    .poll(() => page.evaluate(() => rt.inspect(document.body).scrollSources))
    .toBe(0)
})

test('invalid axes and reversed flows reject before taking ownership', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    window.source = lab.makeSource()
    rt.set(target, { x: 77 })
    const errors: boolean[] = []
    for (const options of [{ axis: 'z' }, { other: true }, null]) {
      try {
        rt.scrollValue(source, options as never)
        errors.push(false)
      } catch {
        errors.push(true)
      }
    }
    for (const style of [
      'display:flex;flex-direction:row-reverse',
      'writing-mode:vertical-rl',
    ]) {
      source.style.cssText += ';' + style
      try {
        rt.scrollLinked(source, target, { x: [0, 100] }, { range: [0, 500], axis: 'x' })
        errors.push(false)
      } catch {
        errors.push(true)
      }
    }
    return {
      errors,
      x: new DOMMatrix(getComputedStyle(target).transform).e,
      sources: rt.inspect(document.body).scrollSources,
    }
  })
  expect(result).toEqual({ errors: [true, true, true, true, true], x: 77, sources: 0 })
})
