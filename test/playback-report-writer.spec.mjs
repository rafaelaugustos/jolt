import { afterEach, expect, it, vi } from 'vitest'
import { PlaybackReportWriter } from '../demo/src/playback-report-writer'

function fixture() {
  const worker = {
    onmessage: undefined,
    onerror: undefined,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  }
  const writer = new PlaybackReportWriter(() => worker, 100)
  const reply = (data) => worker.onmessage?.({ data })
  return { worker, writer, reply }
}
afterEach(() => vi.useRealTimers())

it('waits for startup, permits one write and ignores acknowledgements from older requests', async () => {
  const { worker, writer, reply } = fixture()
  reply({ type: 'ready', threadId: 42 })
  expect(await writer.ready).toMatchObject({ threadId: 42 })
  const first = writer.send({ type: 'start', header: {} })
  await Promise.resolve()
  await expect(writer.replay()).rejects.toThrow('previous')
  const id = worker.postMessage.mock.calls[0][0].id
  reply({ type: 'saved', id: id + 9 })
  reply({ type: 'saved', id, threadId: 42 })
  await expect(first).resolves.toMatchObject({ id, threadId: 42 })
  writer.dispose()
  writer.dispose()
  expect(worker.terminate).toHaveBeenCalledOnce()
  await expect(writer.replay()).rejects.toThrow('closed')
})

it('rejects cancellation during startup and an in-flight write', async () => {
  const starting = fixture()
  const ready = expect(starting.writer.ready).rejects.toThrow('disposed')
  starting.writer.dispose()
  await ready
  expect(starting.worker.terminate).toHaveBeenCalledOnce()
  const running = fixture()
  running.reply({ type: 'ready', threadId: 42 })
  const request = running.writer.replay()
  await Promise.resolve()
  const rejected = expect(request).rejects.toThrow('disposed')
  running.writer.dispose()
  await rejected
})

it('propagates worker failures and terminates the runtime', async () => {
  const { worker, writer, reply } = fixture()
  reply({ type: 'ready', threadId: 42 })
  const request = writer.replay()
  await Promise.resolve()
  const rejected = expect(request).rejects.toThrow('disk full')
  reply({ type: 'error', id: worker.postMessage.mock.calls[0][0].id, error: 'disk full' })
  await rejected
  expect(worker.terminate).toHaveBeenCalledOnce()
})

it('bounds startup and write waits', async () => {
  vi.useFakeTimers()
  const first = fixture()
  const missing = expect(first.writer.ready).rejects.toThrow('startup timed out')
  await vi.advanceTimersByTimeAsync(101)
  await missing
  const second = fixture()
  second.reply({ type: 'ready', threadId: 42 })
  const request = expect(second.writer.replay()).rejects.toThrow('write timed out')
  await vi.advanceTimersByTimeAsync(10001)
  await request
  expect(second.worker.terminate).toHaveBeenCalledOnce()
})
