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
  class GradientLayer extends android.graphics.drawable.Drawable {
    constructor(type: number)
    setCorner(radius: number): void
    paint(
      colors: native.Array<number>,
      stops: native.Array<number>,
      angle: number,
      x: number,
      y: number,
      radius: number,
    ): void
    play(
      times: native.Array<number>,
      colors: native.Array<number>,
      stops: native.Array<number>,
      geometry: native.Array<number>,
      duration: number,
      delay: number,
      repeat: number,
      reverse: boolean,
      listener: GradientLayer.Listener,
    ): void
    control(elapsed: number, paused: boolean): void
    isPlaying(): boolean
    getGeometry(): native.Array<number>
    getCorner(): number
    getStops(): native.Array<number>
    getColors(): native.Array<number>
    getSampleCount(): number
    dispose(): void
    cancel(): void
  }
  namespace GradientLayer {
    class Listener {
      constructor(implementation: { onEnd(finished: boolean): void })
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
  class KeyboardFrame {
    constructor(root: android.view.View, listener: KeyboardFrame.Listener)
    attach(): void
    detach(): void
    height(): number
  }
  namespace KeyboardFrame {
    class Listener {
      constructor(implementation: { onChange(height: number): void })
    }
  }
  class KeyboardFrameFollower {
    constructor(
      view: android.view.View,
      offset: number,
      listener: KeyboardFrameFollower.Listener,
    )
    attach(): void
    detach(): void
  }
  namespace KeyboardFrameFollower {
    class Listener {
      constructor(implementation: {
        onMove(from: number, to: number, keyboard: number): void
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

declare namespace org.rafaelaugusto.jolt {
  class PropertySink extends java.lang.Object {
    static scalar(target: any, getter: string, setter: string): PropertySink
    getDimensions(): number
    isAlive(): boolean
    isCompiled(): boolean
    read(): native.Array<number>
    write(values: native.Array<number>): void
    dispose(): void
  }
  class MapLibrePropertySink extends PropertySink {
    constructor(target: any, camera: boolean)
  }
  class PropertyPlayer extends java.lang.Object {
    constructor(
      sink: PropertySink,
      times: native.Array<number>,
      values: native.Array<number>,
      finalValue: native.Array<number>,
      duration: number,
      delay: number,
      repeat: number,
      reverse: boolean,
      listener: PropertyPlayer.Listener,
    )
    static activeCount(): number
    getFrames(): number
    control(time: number, paused: boolean): void
    cancel(): void
  }
  namespace PropertyPlayer {
    class Listener extends java.lang.Object {
      constructor(implementation: { onEnd(completed: boolean): void })
    }
  }
}
