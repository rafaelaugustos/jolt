declare namespace org.rafaelaugusto.jolt {
  class PhotoZoom {
    constructor(
      image: android.widget.ImageView,
      viewport: android.view.View,
      bitmapWidth: number,
      bitmapHeight: number,
      minimum: number,
      maximum: number,
      doubleTap: number,
      dismiss: boolean,
      reduced: boolean,
      backdrop: android.view.View | null,
      chrome: android.view.View | null,
      previousTouch: android.view.View.OnTouchListener | null,
      previousImageTouch: android.view.View.OnTouchListener | null,
      listener: PhotoZoom.Listener,
    )
    getX(): number
    getY(): number
    getScale(): number
    getDismissProgress(): number
    isDismissPending(): boolean
    zoom(scale: number, x: number, y: number, animated: boolean): void
    reset(animated: boolean): void
    requestDismiss(): void
    setReduced(value: boolean): void
    setActive(value: boolean): void
    stop(): void
  }
  namespace PhotoZoom {
    class Listener {
      constructor(implementation: {
        onDismiss(
          x: number,
          y: number,
          scale: number,
          velocity: number,
          progress: number,
        ): void
        onSettled(x: number, y: number, scale: number): void
      })
    }
  }
  class ImageEffect {
    constructor(
      image: android.widget.ImageView,
      source: android.graphics.Bitmap | null,
      destination: android.graphics.Bitmap | null,
      geometry: androidNative.Array<number>,
      mode: number,
      x: number,
      y: number,
      amplitude: number,
      radius: number,
      duration: number,
      seed: number,
      previousTouch: android.view.View.OnTouchListener | null,
      listener: ImageEffect.Listener,
    )
    isSupported(): boolean
    getFailureReason(): string
    getProgress(): number
    getFrames(): number
    getTextureBytes(): number
    getLongestFrameNanos(): number
    play(endpoint: number): void
    pause(): void
    resume(): void
    seek(progress: number): void
    finish(endpoint: number): void
    stop(): void
    stopPreservingImage(): void
  }
  namespace ImageEffect {
    class Listener {
      constructor(implementation: { onEnd(completed: boolean, progress: number): void })
    }
  }
  class KeyboardFollower {
    constructor(
      view: android.view.View,
      offset: number,
      listener: KeyboardFollower.Listener,
    )
    attach(): void
    detach(): void
  }
  namespace KeyboardFollower {
    class Listener {
      constructor(implementation: {
        onStart(): void
        onSettled(translation: number): void
      })
    }
  }
  class KeyboardObserver {
    constructor(root: android.view.View, listener: KeyboardObserver.Listener)
    attach(): void
    detach(): void
    height(): number
  }
  namespace KeyboardObserver {
    class Listener {
      constructor(implementation: {
        onChange(height: number, duration: number, curve: ArrayLike<number> | null): void
      })
    }
  }
  class TextReveal {
    constructor(
      view: android.widget.TextView,
      byWord: boolean,
      duration: number,
      stagger: number,
      delay: number,
      offset: number,
      callback: TextReveal.Callback,
    )
    isSupported(): boolean
    start(): void
    cancel(): void
  }
  namespace TextReveal {
    class Callback {
      constructor(implementation: { onEnd(finished: boolean): void })
    }
  }
  class NumberRoll {
    constructor(
      view: android.widget.TextView,
      starts: androidNative.Array<number>,
      ends: androidNative.Array<number>,
      previous: androidNative.Array<string>,
      direction: number,
      times: androidNative.Array<number>,
      values: androidNative.Array<number>,
      duration: number,
      delay: number,
      stagger: number,
      shift: number,
      fade: number,
      tabular: boolean,
      callback: NumberRoll.Callback,
    )
    isSupported(): boolean
    start(): void
    cancel(): void
  }
  namespace NumberRoll {
    class Callback {
      constructor(implementation: { onEnd(finished: boolean): void })
    }
  }
}
