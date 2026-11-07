import { describe, expect, it, vi } from 'vitest'
import { createAudioCue, type AudioAdapter } from '../src/core/audio.js'

function backend() {
  let ready!: (ms: number) => void, fail!: (error: unknown) => void
  const completions: (() => void)[] = [],
    failures: ((error: unknown) => void)[] = []
  const adapter: AudioAdapter = {
    load: vi.fn((loaded, rejected) => {
      ready = loaded
      fail = rejected
    }),
    start: vi.fn((complete, rejected) => {
      completions.push(complete)
      failures.push(rejected)
    }),
    pause: vi.fn(),
    stop: vi.fn(),
    volume: vi.fn(),
    dispose: vi.fn(),
  }
  return {
    adapter,
    ready: (ms = 800) => ready(ms),
    fail: (error: unknown) => fail(error),
    completions,
    failures,
  }
}
describe('optional audio cue ownership', () => {
  it('preloads once, replaces a voice, ignores late completion and replays only on a new request', async () => {
    const b = backend(),
      cue = createAudioCue(b.adapter)
    const first = cue.play()
    expect(b.adapter.start).not.toHaveBeenCalled()
    b.ready()
    expect(await cue.ready).toBe(true)
    expect(first.duration).toBe(800)
    const second = cue.play()
    expect(await first.finished).toBe(false)
    b.completions[0]!()
    let settled = false
    void second.finished.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    b.completions[1]!()
    expect(await second.finished).toBe(true)
    second.play()
    second.pause()
    expect(b.adapter.start).toHaveBeenCalledTimes(2)
    const replay = cue.play()
    expect(b.adapter.start).toHaveBeenCalledTimes(3)
    cue.dispose()
    expect(await replay.finished).toBe(false)
    cue.dispose()
    expect(b.adapter.dispose).toHaveBeenCalledTimes(1)
  })
  it('mute changes volume while pause and background preserve the same voice', async () => {
    const b = backend(),
      cue = createAudioCue(b.adapter, { volume: 0.6 })
    b.ready()
    const voice = cue.play()
    cue.muted = true
    cue.volume = 0.4
    expect(b.adapter.volume).toHaveBeenLastCalledWith(0)
    cue.muted = false
    expect(b.adapter.volume).toHaveBeenLastCalledWith(0.4)
    expect(b.adapter.start).toHaveBeenCalledTimes(1)
    cue.suspend()
    expect(voice.paused).toBe(true)
    b.completions[0]!() // queued native completion from before the pause
    cue.resume()
    expect(b.adapter.start).toHaveBeenCalledTimes(2)
    voice.pause()
    cue.suspend()
    cue.resume()
    expect(voice.paused).toBe(true)
    expect(b.adapter.start).toHaveBeenCalledTimes(2)
    voice.play()
    b.completions[2]!()
    expect(await voice.finished).toBe(true)
    cue.dispose()
  })
  it('a request made while suspended waits, while manual pause prevents automatic resume', async () => {
    const b = backend(),
      cue = createAudioCue(b.adapter)
    cue.suspend()
    const voice = cue.play()
    b.ready()
    expect(b.adapter.start).not.toHaveBeenCalled()
    cue.resume()
    expect(b.adapter.start).toHaveBeenCalledTimes(1)
    cue.suspend()
    voice.pause()
    cue.resume()
    expect(b.adapter.start).toHaveBeenCalledTimes(1)
    cue.stop()
    expect(await voice.finished).toBe(false)
  })
  it('preparation failure, cancellation during loading and disposal never start late', async () => {
    const a = backend(),
      errors = vi.fn(),
      cue = createAudioCue(a.adapter, { onError: errors })
    const voice = cue.play()
    a.fail(new Error('missing file'))
    expect(await cue.ready).toBe(false)
    expect(await voice.finished).toBe(false)
    expect(await cue.play().finished).toBe(false)
    a.ready()
    expect(a.adapter.start).not.toHaveBeenCalled()
    expect(errors).toHaveBeenCalledTimes(1)
    const b = backend(),
      disposed = createAudioCue(b.adapter),
      pending = disposed.play()
    disposed.dispose()
    b.ready()
    expect(await disposed.ready).toBe(false)
    expect(await pending.finished).toBe(false)
    expect(b.adapter.start).not.toHaveBeenCalled()
  })
  it('blocked playback resolves false and a later user-initiated retry can succeed', async () => {
    const b = backend(),
      errors = vi.fn(),
      cue = createAudioCue(b.adapter, { onError: errors })
    b.ready()
    vi.mocked(b.adapter.start).mockImplementationOnce(() =>
      Promise.reject(new Error('NotAllowedError')),
    )
    expect(await cue.play().finished).toBe(false)
    const next = cue.play()
    b.completions[0]!()
    expect(await next.finished).toBe(true)
    expect(errors).toHaveBeenCalledTimes(1)
    cue.dispose()
  })
  it('rejects invalid volume and protects the visual caller from error callbacks', async () => {
    const b = backend()
    expect(() => createAudioCue(b.adapter, { volume: 2 })).toThrow()
    expect(b.adapter.load).not.toHaveBeenCalled()
    const cue = createAudioCue(b.adapter, {
      onError() {
        throw new Error('application')
      },
    })
    b.ready(0)
    expect(await cue.ready).toBe(false)
    expect(() => {
      cue.volume = -1
    }).toThrow()
    cue.dispose()
  })
  it('a failed pause terminates the voice before a reentrant error callback starts another', async () => {
    const b = backend()
    let replacement: ReturnType<ReturnType<typeof createAudioCue>['play']> | undefined
    const cue = createAudioCue(b.adapter, {
      onError() {
        replacement = cue.play()
      },
    })
    b.ready()
    const voice = cue.play()
    vi.mocked(b.adapter.pause).mockImplementationOnce(() => {
      throw new Error('device lost')
    })
    voice.pause()
    expect(await voice.finished).toBe(false)
    expect(b.adapter.stop).toHaveBeenCalledTimes(1)
    b.completions[0]!()
    b.completions[1]!()
    expect(await replacement!.finished).toBe(true)
    cue.dispose()
  })
})
