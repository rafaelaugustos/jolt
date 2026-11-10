import { test, expect } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  await page.goto('/tools')
  await page.waitForFunction(() => (window as any).tools)
})
test('default context composes feedback and motion, releases one owner independently', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const t = (window as any).tools,
      n = document.createElement('button')
    document.body.append(n)
    const motion = t.animate(n, [{ x: 80 }, { duration: 0 }]),
      feedback = t.press(n, { scale: 0.9 })
    await motion.current.finished
    feedback.destroy()
    const next = motion.update([{ x: 110 }, { duration: 0 }])
    await next.finished
    const x = new DOMMatrixReadOnly(getComputedStyle(n).transform).m41
    motion.destroy()
    motion.destroy()
    n.remove()
    return x
  })
  expect(result).toBeCloseTo(110)
})
test('invalid replacement preserves active motion, mutable inputs apply and equal input does not restart', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const t = (window as any).tools,
      n = document.createElement('button')
    document.body.append(n)
    const value = [{ x: 100 }, { duration: 600 }],
      owner = t.createActions({ runtime: t.runtime }).animate(n, value)
    const first = owner.current
    const equal = owner.update([{ x: 100 }, { duration: 600 }]) === first
    let invalid = false
    try {
      owner.update([{ x: NaN }, { duration: 600 }])
    } catch {
      invalid = true
    }
    const preserved = owner.current === first
    value[0].x = 40
    const next = owner.update(value)
    await next.finished
    const x = new DOMMatrixReadOnly(getComputedStyle(n).transform).m41
    owner.destroy()
    n.remove()
    return { equal, invalid, preserved, x }
  })
  expect(result).toMatchObject({ equal: true, invalid: true, preserved: true })
  expect(result.x).toBeCloseTo(40)
})
test('detached trees apply only the latest declaration after actual connection and preserve manual pause', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const t = (window as any).tools,
      n = document.createElement('button')
    const owner = t
      .createActions({ runtime: t.runtime })
      .animate(n, [{ x: 100 }, { duration: 600 }])
    owner.update([{ x: 45 }, { duration: 600 }])
    const absent = !owner.current
    document.body.append(n)
    await new Promise((r) => setTimeout(r, 0))
    const original = owner.current
    original.pause()
    n.remove()
    await new Promise((r) => setTimeout(r, 0))
    document.body.append(n)
    await new Promise((r) => setTimeout(r, 0))
    const paused = owner.current.paused
    owner.current.play()
    await owner.current.finished
    const x = new DOMMatrixReadOnly(getComputedStyle(n).transform).m41
    owner.destroy()
    n.remove()
    return { absent, paused, x }
  })
  expect(result.absent).toBe(true)
  expect(result.paused).toBe(true)
  expect(result.x).toBeCloseTo(45)
})
