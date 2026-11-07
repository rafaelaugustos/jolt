import { createAudioCue, type AudioAdapter, type AudioCueOptions } from '../core/audio.js'
export type { AudioCue, AudioPlayback, AudioCueOptions } from '../core/audio.js'

/** Optional browser audio entry. Call play from a user gesture after ready resolves. */
export function audioCue(
  document: Document,
  source: string,
  options: AudioCueOptions = {},
) {
  if (!document?.defaultView) throw new TypeError('Audio needs a live document.')
  const url = new URL(source, document.baseURI)
  if (
    !['http:', 'https:', 'blob:'].includes(url.protocol) ||
    url.origin !== document.location.origin
  )
    throw new TypeError('Audio cues require a same-origin asset URL or local blob URL.')
  const audio = document.createElement('audio')
  audio.preload = 'auto'
  let ended = false,
    disposed = false,
    fail: ((error: unknown) => void) | undefined
  const failure = () => fail?.(audio.error ?? new Error('Audio playback failed.'))
  const adapter: AudioAdapter = {
    load(ready, rejected) {
      fail = rejected
      audio.oncanplaythrough = () => ready(audio.duration * 1000)
      audio.onerror = failure
      audio.src = url.href
      audio.load()
    },
    start(complete, rejected) {
      fail = rejected
      if (ended) {
        audio.currentTime = 0
        ended = false
      }
      audio.onended = () => {
        ended = true
        complete()
      }
      return audio.play()
    },
    pause() {
      audio.pause()
    },
    stop() {
      audio.pause()
      audio.onended = null
      if (audio.readyState) audio.currentTime = 0
      ended = false
    },
    volume(value) {
      audio.volume = value
    },
    dispose() {
      if (disposed) return
      disposed = true
      audio.onended = audio.onerror = audio.oncanplaythrough = null
      fail = undefined
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      document.removeEventListener('visibilitychange', visibility)
    },
  }
  const cue = createAudioCue(adapter, options)
  let held = false
  function visibility() {
    if (document.hidden && !cue.suspended) {
      held = true
      cue.suspend()
    } else if (!document.hidden && held) {
      held = false
      cue.resume()
    }
  }
  if (cue.status !== 'failed') document.addEventListener('visibilitychange', visibility)
  visibility()
  return cue
}
