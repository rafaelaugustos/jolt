import { test, expect, type Page } from '@playwright/test'
import type {} from './fixture.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/?test')
  await page.evaluate(() => {
    window.rt = lab.createWebRuntime(document, { reducedMotion: 'never' })
    window.target = lab.makeTarget()
    window.source = lab.makeSource()
    source.style.overflowAnchor = 'none'
    source.innerHTML =
      '<div id="before" style="height:400px"></div><section id="anchor" style="height:200px"></section><div style="height:1200px"></div>'
  })
})
test.afterEach(async ({ page }) => {
  await page.evaluate(() => rt.dispose())
})
const x = (page: Page) =>
  page.evaluate(() => new DOMMatrix(getComputedStyle(target).transform).e)
const near = async (page: Page, n: number) =>
  expect.poll(async () => Math.abs((await x(page)) - n)).toBeLessThan(0.1)

for (const execution of ['auto', 'scheduler'] as const) {
  test(`element range follows layout without replacing its link (${execution})`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.evaluate((execution) => {
      window.linked = rt.scrollLinked(
        source,
        target,
        { x: [0, 100] },
        {
          range: { element: document.querySelector<HTMLElement>('#anchor')! },
          execution,
        },
      )
      source.scrollTop = 400
    }, execution)
    await near(page, 50)
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('#before')!.style.height = '600px'
    })
    await near(page, 0)
    await page.evaluate(() => {
      source.scrollTop = 600
    })
    await near(page, 50)
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('#anchor')!.style.height = '400px'
    })
    await near(page, 100 / 3)
    await page.evaluate(() => {
      source.style.height = '400px'
    })
    await near(page, 50)
    await page.evaluate(() => {
      const inserted = document.createElement('div')
      inserted.style.height = '200px'
      source.prepend(inserted)
    })
    await near(page, 25)
    await page.evaluate(() => {
      window.value = rt.motionValue(0.7)
      rt.bind(target, { opacity: value })
      document.querySelector<HTMLElement>('#before')!.style.height = '400px'
    })
    await near(page, 50)
    expect(
      await page.evaluate(() => Number(getComputedStyle(target).opacity)),
    ).toBeCloseTo(0.7)
    await expect.poll(() => page.evaluate(() => rt.scheduler.pending)).toBe(false)
    const frames = await page.evaluate(() => rt.scheduler.frames)
    await page.waitForTimeout(120)
    expect(await page.evaluate(() => rt.scheduler.frames)).toBe(frames)
    await page.evaluate(() => linked.dispose())
    expect(await page.evaluate(() => linked.execution)).toBe('released')
    await page.evaluate(() => {
      source.style.height = '250px'
      value.set(0.6)
    })
    await near(page, 50)
    await expect
      .poll(() => page.evaluate(() => Number(getComputedStyle(target).opacity)))
      .toBeCloseTo(0.6)
    expect(errors).toEqual([])
  })
}

test('document ranges preserve negative entry offsets and custom alignments', async ({
  page,
}) => {
  await page.evaluate(() => {
    document.body.innerHTML = ''
    document.body.style.cssText = 'padding:0;margin:0'
    const anchor = document.createElement('section')
    anchor.style.height = '200px'
    document.body.append(anchor)
    window.target = lab.makeTarget()
    const spacer = document.createElement('div')
    spacer.style.height = '2000px'
    document.body.append(spacer)
    window.linked = rt.scrollLinked(
      document,
      target,
      { x: [0, 100] },
      { range: { element: anchor } },
    )
  })
  await near(page, (740 / 940) * 100)
  await page.evaluate(() => {
    linked.dispose()
    window.linked = rt.scrollLinked(
      document,
      target,
      { x: [0, 100] },
      {
        range: {
          element: document.querySelector('section')!,
          start: 'start start',
          end: 'end start',
        },
      },
    )
    window.scrollTo(0, 100)
  })
  await near(page, 50)
})

test('horizontal RTL alignments use the source reading direction', async ({ page }) => {
  await page.evaluate(() => {
    source.style.cssText =
      'width:300px;height:200px;overflow:auto;display:flex;direction:rtl;overflow-anchor:none'
    for (const child of source.children)
      (child as HTMLElement).style.cssText = 'flex:0 0 400px;height:100px'
    window.linked = rt.scrollLinked(
      source,
      target,
      { x: [0, 100] },
      { axis: 'x', range: { element: document.querySelector<HTMLElement>('#anchor')! } },
    )
    source.scrollLeft = -450
  })
  await near(page, 50)
})

test('invalid anchors fail before claiming motion resources', async ({ page }) => {
  const rejected = await page.evaluate(() => {
    const anchor = document.querySelector<HTMLElement>('#anchor')!
    const attempt = (element: HTMLElement, start?: string) => {
      try {
        rt.scrollLinked(
          source,
          target,
          { x: [0, 100] },
          { range: { element, start } as never },
        )
        return false
      } catch {
        return true
      }
    }
    const results = [attempt(target), attempt(anchor, 'bad edge')]
    anchor.style.position = 'sticky'
    results.push(attempt(anchor))
    anchor.style.position = ''
    anchor.style.transform = 'translateX(10px)'
    results.push(attempt(anchor))
    return { results, values: rt.inspect(target).values, tasks: rt.scheduler.size }
  })
  expect(rejected.results).toEqual([true, true, true, true])
  expect(rejected.values).toBe(0)
  expect(rejected.tasks).toBe(0)
})

test('surface diagnostics identify element and changed values, with geometry guidance', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    target.id = 'responsive-card'
    rt.set(target, { x: 20 })
    target.style.width = '180px'
    try {
      rt.set(target, { x: 30 })
      return null
    } catch (error) {
      const e = error as Error & {
        element: string
        changes: { property: string; previous: string; current: string }[]
      }
      return { name: e.name, message: e.message, element: e.element, changes: e.changes }
    }
  })
  expect(result?.name).toBe('WebSurfaceConflictError')
  expect(result?.element).toBe('button#responsive-card')
  expect(result?.changes).toContainEqual({
    property: 'width',
    previous: '100px',
    current: '180px',
  })
  expect(result?.changes).toContainEqual({
    property: 'transform-origin',
    previous: '50px 30px',
    current: '90px 30px',
  })
  expect(result?.message).toContain('observeGeometry')
  await page.evaluate(() => {
    rt.refresh(target)
    rt.set(target, { x: 30 })
  })
  await near(page, 30)
})

test('detaching the layout anchor releases its observers and reports the contract failure', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.evaluate(() => {
    const anchor = document.querySelector<HTMLElement>('#anchor')!
    window.linked = rt.scrollLinked(
      source,
      target,
      { x: [0, 100] },
      { range: { element: anchor } },
    )
    anchor.remove()
  })
  await expect.poll(() => page.evaluate(() => linked.execution)).toBe('released')
  await expect.poll(() => page.evaluate(() => rt.scheduler.pending)).toBe(false)
  expect(await page.evaluate(() => rt.inspect(target).values)).toBe(0)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toContain('remain mounted')
})

test('CSS custom-property layout shifts refresh a stable-sized anchor', async ({
  page,
}) => {
  await page.evaluate(() => {
    const anchor = document.querySelector<HTMLElement>('#anchor')!
    anchor.style.cssText += ';position:relative;top:var(--section-offset, 0px)'
    window.linked = rt.scrollLinked(
      source,
      target,
      { x: [0, 100] },
      { range: { element: anchor } },
    )
    source.scrollTop = 400
  })
  await near(page, 50)
  await page.evaluate(() => source.style.setProperty('--section-offset', '100px'))
  await near(page, 25)
})
