import type { Animation } from './playback.js'

export interface AudioPlayback extends Animation {
  readonly duration: number | undefined
  readonly paused: boolean
  pause(): void
  play(): void
  dispose(): void
}
export interface AudioCueOptions {
  volume?: number
  muted?: boolean
  onError?: (error: unknown) => void
}
export interface AudioCue {
  /** Preparation failures resolve false; they never reject visual timelines. */
  readonly ready: Promise<boolean>
  readonly status: 'loading' | 'ready' | 'failed' | 'disposed'
  readonly duration: number | undefined
  readonly suspended: boolean
  volume: number
  muted: boolean
  /** One voice per cue. A new play replaces the preceding voice; play on a handle resumes. */
  play(): AudioPlayback
  stop(): void
  suspend(): void
  resume(): void
  dispose(): void
}
export interface AudioAdapter {
  load(ready: (duration: number) => void, fail: (error: unknown) => void): void
  start(complete: () => void, fail: (error: unknown) => void): void | Promise<void>
  pause(): void
  stop(): void
  volume(value: number): void
  dispose(): void
}

/** Boundary callbacks only: the audio backend owns its playback clock. */
export function createAudioCue(
  adapter: AudioAdapter,
  options: AudioCueOptions = {},
): AudioCue {
  const validVolume = (value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > 1)
      throw new RangeError('Audio volume must be between 0 and 1.')
    return value
  }
  let volume = validVolume(options.volume ?? 1),
    muted = options.muted ?? false
  if (
    typeof muted !== 'boolean' ||
    (options.onError !== undefined && typeof options.onError !== 'function')
  )
    throw new TypeError('Invalid audio cue options.')
  let status: AudioCue['status'] = 'loading',
    duration: number | undefined
  let suspended = false,
    active:
      | {
          handle: AudioPlayback
          begin(): void
          finish(completed: boolean): void
          resume: boolean
        }
      | undefined
  let readyResolve!: (ready: boolean) => void
  const ready = new Promise<boolean>((resolve) => {
    readyResolve = resolve
  })
  const report = (error: unknown) => {
    try {
      options.onError?.(error)
    } catch {
      /* Visual work remains independent. */
    }
  }
  const attempt = (work: () => void) => {
    try {
      work()
    } catch (error) {
      report(error)
    }
  }
  const applyVolume = () => adapter.volume(muted ? 0 : volume)
  const cue: AudioCue = {
    ready,
    get status() {
      return status
    },
    get duration() {
      return duration
    },
    get suspended() {
      return suspended
    },
    get volume() {
      return volume
    },
    set volume(value) {
      volume = validVolume(value)
      if (status === 'ready') attempt(applyVolume)
    },
    get muted() {
      return muted
    },
    set muted(value) {
      if (typeof value !== 'boolean') throw new TypeError('Audio muted must be boolean.')
      muted = value
      if (status === 'ready') attempt(applyVolume)
    },
    play() {
      active?.handle.stop()
      let resolve!: (completed: boolean) => void
      const finished = new Promise<boolean>((done) => {
        resolve = done
      })
      let settled = false,
        paused = false,
        playing = false,
        generation = 0
      const entry = {
        handle: undefined as unknown as AudioPlayback,
        resume: suspended,
        finish(completed: boolean) {
          if (settled) return
          settled = true
          generation++
          if (active === entry) active = undefined
          playing = false
          resolve(completed)
        },
        begin() {
          if (settled || paused || suspended || status !== 'ready' || playing) return
          const token = ++generation
          const fail = (error: unknown) => {
            if (settled || token !== generation) return
            entry.finish(false)
            attempt(() => adapter.stop())
            report(error)
          }
          try {
            applyVolume()
            playing = true
            const pending = adapter.start(() => {
              if (token === generation) entry.finish(true)
            }, fail)
            if (pending) void pending.catch(fail)
          } catch (error) {
            fail(error)
          }
        },
      }
      const handle: AudioPlayback = {
        finished,
        then: (fulfilled, rejected) => finished.then(fulfilled, rejected),
        get duration() {
          return duration
        },
        get paused() {
          return paused || suspended
        },
        pause() {
          if (settled) return
          entry.resume = false
          if (paused) return
          paused = true
          if (playing) {
            generation++
            playing = false
            try {
              adapter.pause()
            } catch (error) {
              entry.finish(false)
              attempt(() => adapter.stop())
              report(error)
            }
          }
        },
        play() {
          if (!settled) {
            paused = false
            entry.begin()
          }
        },
        stop() {
          if (settled) return
          entry.finish(false)
          if (status === 'ready') attempt(() => adapter.stop())
        },
        dispose() {
          handle.stop()
        },
      }
      entry.handle = handle
      if (status === 'disposed' || status === 'failed') entry.finish(false)
      else {
        active = entry
        entry.begin()
      }
      return handle
    },
    stop() {
      active?.handle.stop()
    },
    suspend() {
      if (status === 'disposed' || suspended) return
      const resume = active && !active.handle.paused
      active?.handle.pause()
      suspended = true
      if (active) active.resume = !!resume
    },
    resume() {
      if (status === 'disposed' || !suspended) return
      suspended = false
      if (active?.resume) {
        active.resume = false
        active.handle.play()
      }
    },
    dispose() {
      if (status === 'disposed') return
      active?.handle.stop()
      status = 'disposed'
      readyResolve(false)
      attempt(() => adapter.dispose())
    },
  }
  const failed = (error: unknown) => {
    if (status === 'disposed' || status === 'failed') return
    status = 'failed'
    report(error)
    active?.finish(false)
    readyResolve(false)
    attempt(() => adapter.dispose())
  }
  try {
    adapter.load((length) => {
      if (status !== 'loading') return
      if (!Number.isFinite(length) || length <= 0) {
        failed(new RangeError('Audio cues require a finite, nonempty clip.'))
        return
      }
      duration = length
      status = 'ready'
      try {
        applyVolume()
        readyResolve(true)
        active?.begin()
      } catch (error) {
        failed(error)
      }
    }, failed)
  } catch (error) {
    failed(error)
  }
  return cue
}
