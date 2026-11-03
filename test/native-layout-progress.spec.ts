import { afterEach, expect, it, vi } from 'vitest'
import { waitForLayoutProgress } from '../benchmarks/native-layout-progress'

afterEach(() => vi.useRealTimers())

it('waits for native progress when the first layout frame starts late', async () => {
  vi.useFakeTimers()
  const started = Date.now()
  const read = () => {
    const elapsed = Date.now() - started
    return elapsed < 200 ? 70 : elapsed < 320 ? 78.6666666667 : 86
  }
  const result = waitForLayoutProgress(read, 80, 145, 'Flex column')
  await vi.advanceTimersByTimeAsync(280)
  expect(read()).toBeLessThan(80) // The former fixed-delay assertion failed here.
  await vi.advanceTimersByTimeAsync(40)
  await expect(result).resolves.toEqual({ value: 86, elapsedMs: 320 })
})

it('fails a stalled layout instead of accepting a late frame indefinitely', async () => {
  vi.useFakeTimers()
  const result = expect(
    waitForLayoutProgress(() => 78.6666666667, 80, 145, 'Flex column'),
  ).rejects.toThrow('Flex column layout stalled')
  await vi.advanceTimersByTimeAsync(3024)
  await result
})

it('rejects a jump to the final size without observing intermediate layout', async () => {
  vi.useFakeTimers()
  const started = Date.now()
  const result = expect(
    waitForLayoutProgress(
      () => (Date.now() === started ? 70 : 150),
      80,
      145,
      'Flex column',
    ),
  ).rejects.toThrow('missed intermediate layout: 150')
  await vi.advanceTimersByTimeAsync(16)
  await result
})

it('does not accept progress arriving beyond the observation deadline', async () => {
  vi.useFakeTimers()
  const started = Date.now()
  const result = expect(
    waitForLayoutProgress(
      () => (Date.now() - started < 3000 ? 70 : 86),
      80,
      145,
      'Flex column',
    ),
  ).rejects.toThrow('within 3000ms')
  await vi.advanceTimersByTimeAsync(3024)
  await result
})

it('rejects invalid native measurements', async () => {
  await expect(waitForLayoutProgress(() => NaN, 80, 145, 'Flex column')).rejects.toThrow(
    'missed intermediate layout: NaN',
  )
})
