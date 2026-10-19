import { Utils, isAndroid, isIOS, type Image, type ImageSource } from '@nativescript/core'

export interface ImageEffectSettings {
  mode: number
  x: number
  y: number
  amplitude: number
  radius: number
  duration: number
  seed: number
  to?: ImageSource
}

export interface ImageRenderer {
  readonly backend: 'metal' | 'agsl'
  readonly progress: number
  readonly frames: number
  readonly textureBytes: number
  readonly longestFrameMs: number
  play(endpoint: number): void
  pause(): void
  resume(): void
  seek(progress: number): void
  finish(endpoint: number): void
  stop(preserveImage?: boolean): void
}

export function createImageRenderer(
  image: Image,
  settings: ImageEffectSettings,
  ended: (completed: boolean, progress: number) => void,
): ImageRenderer | undefined {
  const { mode, x, y, amplitude, radius, duration, seed, to } = settings
  if (isIOS && typeof JoltImageEffect !== 'undefined') {
    const native =
      JoltImageEffect.createWithViewDestinationModeOriginXOriginYAmplitudeRadiusDurationSeedListener(
        image.nativeViewProtected,
        to?.ios ?? null,
        mode,
        x,
        y,
        amplitude,
        radius,
        duration,
        seed,
        ended,
      )
    if (!native) return undefined
    return {
      backend: 'metal',
      get progress() {
        return native.progress
      },
      get frames() {
        return native.frames
      },
      get textureBytes() {
        return native.textureBytes
      },
      get longestFrameMs() {
        return native.longestFrame * 1000
      },
      play: (p) => native.play(p),
      pause: () => native.pause(),
      resume: () => native.resume(),
      seek: (p) => native.seek(p),
      finish: (p) => native.finish(p),
      stop: (preserveImage) =>
        preserveImage ? native.stopPreservingImage() : native.stop(),
    }
  }
  if (isAndroid && android.os.Build.VERSION.SDK_INT >= 33) {
    const density = Utils.layout.getDisplayDensity()
    const background = image.nativeViewProtected.getBackground()
    // NativeScript draws bitmap pixels itself: ImageView.getImageMatrix() does
    // not describe its stretch, EXIF rotation or inner border clipping.
    const geometry = Array.create('float', 6)
    geometry[0] = image.imageSource?.rotationAngle ?? 0
    geometry[1] = to?.rotationAngle ?? 0
    const corners = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft']
    corners.forEach((corner, i) => {
      geometry[i + 2] = background?.[`getBorder${corner}Radius`]?.() ?? 0
    })
    const native = new org.rafaelaugusto.jolt.ImageEffect(
      image.nativeViewProtected,
      image.imageSource?.android ?? null,
      to?.android ?? null,
      geometry,
      mode,
      x * density,
      y * density,
      amplitude * density,
      radius * density,
      duration,
      seed,
      (image as Image & { touchListener?: android.view.View.OnTouchListener })
        .touchListener ?? null,
      new org.rafaelaugusto.jolt.ImageEffect.Listener({ onEnd: ended }),
    )
    if (!native.isSupported()) {
      const reason = native.getFailureReason()
      native.stop()
      throw new Error(reason)
    }
    return {
      backend: 'agsl',
      get progress() {
        return native.getProgress()
      },
      get frames() {
        return native.getFrames()
      },
      get textureBytes() {
        return native.getTextureBytes()
      },
      get longestFrameMs() {
        return native.getLongestFrameNanos() / 1e6
      },
      play: (p) => native.play(p),
      pause: () => native.pause(),
      resume: () => native.resume(),
      seek: (p) => native.seek(p),
      finish: (p) => native.finish(p),
      stop: (preserveImage) =>
        preserveImage ? native.stopPreservingImage() : native.stop(),
    }
  }
  return undefined
}
