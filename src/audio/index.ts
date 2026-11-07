import { Application, File, knownFolders, path } from '@nativescript/core'
import { createAudioCue, type AudioAdapter, type AudioCueOptions } from '../core/audio.js'
export type { AudioCue, AudioPlayback } from '../core/audio.js'
export interface NativeAudioCueOptions extends AudioCueOptions {
  /** Ambient respects the silent switch. Application leaves the audio session to its owner. */
  iosSession?: 'ambient' | 'application'
}

let ambientLeases = 0,
  restoreSession: (() => void) | undefined
function ambientSession() {
  const session = AVAudioSession.sharedInstance()
  if (!ambientLeases) {
    const category = session.category,
      mode = session.mode,
      options = session.categoryOptions
    if (
      category !== AVAudioSessionCategoryAmbient &&
      category !== AVAudioSessionCategorySoloAmbient
    )
      throw new Error(
        'The app owns a non-ambient audio session. Pass iosSession: application and configure its policy explicitly.',
      )
    session.setCategoryError(AVAudioSessionCategoryAmbient)
    const appliedMode = session.mode,
      appliedOptions = session.categoryOptions
    restoreSession = () => {
      if (
        session.category === AVAudioSessionCategoryAmbient &&
        session.mode === appliedMode &&
        session.categoryOptions === appliedOptions
      )
        session.setCategoryModeOptionsError(category, mode, options)
    }
  }
  ambientLeases++
  let released = false
  return () => {
    if (released) return
    released = true
    if (--ambientLeases === 0) {
      const restore = restoreSession
      restoreSession = undefined
      restore?.()
    }
  }
}

type AudioDelegate = NSObject & AVAudioPlayerDelegate
const audioCallbacks = new WeakMap<
  NSObject,
  { complete?: () => void; fail?: (error: unknown) => void }
>()
let AudioDelegateClass: typeof NSObject | undefined
function audioDelegate() {
  if (!AudioDelegateClass) {
    const base = NSObject as typeof NSObject & {
      extend(
        methods: object,
        options: { protocols: unknown[]; name: string },
      ): typeof NSObject
    }
    AudioDelegateClass = base.extend(
      {
        audioPlayerDidFinishPlayingSuccessfully(
          this: NSObject,
          _player: AVAudioPlayer,
          success: boolean,
        ) {
          const callbacks = audioCallbacks.get(this)
          if (success) callbacks?.complete?.()
          else callbacks?.fail?.(new Error('Native audio did not finish successfully.'))
        },
        audioPlayerDecodeErrorDidOccurError(
          this: NSObject,
          _player: AVAudioPlayer,
          error: NSError,
        ) {
          audioCallbacks.get(this)?.fail?.(error)
        },
      },
      { protocols: [AVAudioPlayerDelegate], name: 'JoltAudioCueDelegate' },
    )
  }
  const delegate = AudioDelegateClass.new() as AudioDelegate
  const callbacks: { complete?: () => void; fail?: (error: unknown) => void } = {}
  audioCallbacks.set(delegate, callbacks)
  return { delegate, callbacks }
}

/** Preload a bundled/local one-shot. Native playback owns the clock; no JS frame polling. */
export function audioCue(file: string, options: NativeAudioCueOptions = {}) {
  if (typeof file !== 'string' || !file || /^(?:https?|content|data):/i.test(file))
    throw new TypeError('Audio cues require a bundled or absolute local file path.')
  if (
    options.iosSession !== undefined &&
    !['ambient', 'application'].includes(options.iosSession)
  )
    throw new TypeError('Invalid iOS audio session policy.')
  const resolved = file.startsWith('~/')
    ? path.join(knownFolders.currentApp().path, file.slice(2))
    : file
  if (!resolved.startsWith('/'))
    throw new TypeError('Audio files use ~/app-relative or absolute paths.')
  let disposePlatform = () => {},
    off = () => {}
  let player: AVAudioPlayer | undefined,
    androidPlayer: android.media.MediaPlayer | undefined
  let delegate: ReturnType<typeof audioDelegate> | undefined
  let ended = false,
    released = false
  let fail: ((error: unknown) => void) | undefined
  const adapter: AudioAdapter = {
    load(ready, rejected) {
      fail = rejected
      if (!File.exists(resolved)) throw new Error(`Audio file is unavailable: ${file}`)
      if (__IOS__) {
        if (options.iosSession !== 'application') disposePlatform = ambientSession()
        player = AVAudioPlayer.alloc().initWithContentsOfURLError(
          NSURL.fileURLWithPath(resolved),
        )
        if (!player || !player.prepareToPlay())
          throw new Error('Audio preparation failed.')
        delegate = audioDelegate()
        delegate.callbacks.fail = (error) => fail?.(error)
        player.delegate = delegate.delegate
        ready(player.duration * 1000)
      } else {
        androidPlayer = new android.media.MediaPlayer()
        androidPlayer.setAudioAttributes(
          new android.media.AudioAttributes.Builder()
            .setUsage(android.media.AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        androidPlayer.setOnPreparedListener(
          new android.media.MediaPlayer.OnPreparedListener({
            onPrepared: (p) => ready(p.getDuration()),
          }),
        )
        androidPlayer.setOnErrorListener(
          new android.media.MediaPlayer.OnErrorListener({
            onError: (_p, what, extra) => {
              fail?.(new Error(`Android audio error ${what}/${extra}`))
              return true
            },
          }),
        )
        androidPlayer.setDataSource(resolved)
        androidPlayer.prepareAsync()
      }
    },
    start(complete, rejected) {
      fail = rejected
      if (__IOS__) {
        if (ended) player!.currentTime = 0
        delegate!.callbacks.complete = () => {
          ended = true
          complete()
        }
        ended = false
        if (!player!.play()) throw new Error('Native audio output could not start.')
      } else {
        if (ended) androidPlayer!.seekTo(0)
        ended = false
        androidPlayer!.setOnCompletionListener(
          new android.media.MediaPlayer.OnCompletionListener({
            onCompletion: () => {
              ended = true
              complete()
            },
          }),
        )
        androidPlayer!.start()
      }
    },
    pause() {
      if (__IOS__) player?.pause()
      else androidPlayer?.pause()
    },
    stop() {
      ended = false
      if (__IOS__) {
        player?.stop()
        if (player) player.currentTime = 0
        if (delegate) delegate.callbacks.complete = undefined
      } else if (androidPlayer) {
        androidPlayer.setOnCompletionListener(null!)
        if (androidPlayer.isPlaying()) androidPlayer.pause()
        androidPlayer.seekTo(0)
      }
    },
    volume(value) {
      if (__IOS__) {
        if (player) player.volume = value
      } else androidPlayer?.setVolume(value, value)
    },
    dispose() {
      if (released) return
      released = true
      off()
      fail = undefined
      if (__IOS__) {
        player?.stop()
        if (player) player.delegate = null
        delegate = undefined
        player = undefined
        disposePlatform()
      } else if (androidPlayer) {
        androidPlayer.setOnPreparedListener(null!)
        androidPlayer.setOnCompletionListener(null!)
        androidPlayer.setOnErrorListener(null!)
        androidPlayer.release()
        androidPlayer = undefined
      }
    },
  }
  const cue = createAudioCue(adapter, options)
  if (cue.status === 'failed') return cue
  let held = false
  const suspend = () => {
    if (!cue.suspended) {
      held = true
      cue.suspend()
    }
  }
  const resume = () => {
    if (held) {
      held = false
      cue.resume()
    }
  }
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  const observer = __IOS__
    ? Application.ios.addNotificationObserver(
        AVAudioSessionInterruptionNotification,
        () => cue.stop(),
      )
    : undefined
  off = () => {
    Application.off(Application.suspendEvent, suspend)
    Application.off(Application.resumeEvent, resume)
    if (__IOS__ && observer)
      Application.ios.removeNotificationObserver(
        observer,
        AVAudioSessionInterruptionNotification,
      )
  }
  return cue
}
