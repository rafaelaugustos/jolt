declare namespace org.rafaelaugusto.jolt {
  class KeyframeFactory {
    static create(
      view: android.view.View,
      property: android.util.Property<android.view.View, java.lang.Float>,
      times: readonly number[],
      values: readonly number[],
      unit: number,
    ): android.animation.ObjectAnimator
  }
  class ShapeLayer extends android.graphics.drawable.Drawable {
    constructor(options: string)
    static liveCount(): number
    static activeCount(): number
    paint(
      commands: string,
      points: native.Array<number>,
      start: number,
      end: number,
    ): void
    values(): native.Array<number>
    geometryBounds(): native.Array<number>
    play(
      commands: string,
      from: native.Array<number>,
      to: native.Array<number>,
      times: native.Array<number>,
      samples: native.Array<number>,
      duration: number,
      delay: number,
      repeats: number,
      reverse: boolean,
    ): void
    control(time: number, paused: boolean): void
    isPlaying(): boolean
    cancel(): void
    dispose(): void
  }
  class SensorSource {
    constructor(
      context: android.content.Context,
      kind: string,
      options: string,
      listener: SensorSource.Listener,
    )
    static activeCount(): number
    static sourceCount(): number
    connect(node: LiveSpring, index: number): void
    setEnabled(active: boolean, paused: boolean): void
    snapshot(): string
    recenter(): void
    replay(trace: string): void
    dispose(): void
  }
  namespace SensorSource {
    class Listener {
      constructor(implementation: { changed(): void })
    }
  }

  class ScrollHeader {
    constructor(
      list: android.widget.ListView,
      node: LiveSpring,
      title: android.view.View,
      toolbarTitle: android.view.View,
      toolbar: android.view.View,
      diagnostic: android.view.View | null,
      options: string,
      listener: ScrollHeader.Listener,
    )
    static activeCount(): number
    configure(options: string): void
    snapshot(): string
    scroll(offset: number, animated: boolean): void
    setEnabled(value: boolean): void
    dispose(): void
  }
  namespace ScrollHeader {
    class Listener {
      constructor(implementation: { changed(): void })
    }
  }
  class MotionProbe {
    static start(view: android.view.View, capacity: number, hertz: number): MotionProbe
    static activeCount(): number
    drain(): string
    dispose(): void
  }
  class ReorderSurface extends org.nativescript.widgets.GridLayout {
    constructor(context: android.content.Context)
  }
  class ReorderHandle extends android.widget.Button {
    constructor(context: android.content.Context)
    setMoveListener(listener: ReorderHandle.MoveListener | null): void
  }
  namespace ReorderHandle {
    class MoveListener {
      constructor(implementation: { move(direction: number): void })
    }
  }
  class ReorderSession {
    constructor(
      surface: ReorderSurface,
      list: android.widget.ListView,
      options: string,
      listener: ReorderSession.Listener,
    )
    isActive(): boolean
    registerHandle(view: android.view.View): void
    setEnabled(enabled: boolean): void
    setReducedMotion(reduced: boolean): void
    cancel(): void
    dispose(): void
  }
  namespace ReorderSession {
    class Listener {
      constructor(implementation: {
        onState(state: number, index: number, toIndex: number): void
      })
    }
  }
  class GestureSurface extends org.nativescript.widgets.GridLayout {
    constructor(context: android.content.Context)
    hasSession(): boolean
  }
  class GestureSession {
    static supportsContactEvents(): boolean
    static supportsScrollReplay(): boolean
    replayScroll(phase: number, delta: number, velocity: number): void
    replayScrollOffset(offset: number): void
    constructor(
      surface: GestureSurface,
      scroll: android.view.View | null,
      x: LiveSpring,
      y: LiveSpring,
      scale: LiveSpring,
      rotation: LiveSpring,
      options: string,
      listener: GestureSession.Listener,
    )
    isActive(): boolean
    cancel(): void
    setEnabled(value: boolean): void
    settle(x: number, y: number, scale: number, rotation: number, animated: boolean): void
    updateBounds(left: number, right: number, top: number, bottom: number): void
    dispose(): void
  }
  namespace GestureSession {
    class Listener {
      constructor(implementation: {
        onState(state: number, velocityX: number, velocityY: number): void
      })
    }
  }
  class LiveSpring {
    constructor(
      initial: number,
      stiffness: number,
      damping: number,
      mass: number,
      restDelta: number,
      restSpeed: number,
      reduced: boolean,
    )
    static activeCount(): number
    static nodeCount(): number
    static sync(view: android.view.View): void
    getPosition(): number
    getVelocity(): number
    isMoving(): boolean
    follow(source: LiveSpring, mappings: string): void
    updateInput(snapshot: string): void
    setInputs(rest: number, snapshots: string): void
    setTarget(value: number): void
    setReduced(value: boolean): void
    setPaused(value: boolean): void
    bind(view: android.view.View, property: string, mappings: string): LiveSpring.Binding
    dispose(): void
  }
  namespace LiveSpring {
    class Binding {
      getValue(): number
      setLayers(inputs: string): void
      cancel(): void
    }
  }
  class ParticleEmitter {
    constructor(
      target: android.view.View,
      overlay: boolean,
      colors: native.Array<number>,
      shape: number,
      source: number,
      rate: number,
      lifetimeMs: number,
      size: number,
      velocity: number,
      velocityRange: number,
      angle: number,
      spread: number,
      gravity: number,
      spin: number,
      spinRange: number,
      fade: boolean,
      durationMs: number,
      listener: ParticleEmitter.Listener,
    )
    start(): void
    refresh(cornerPixels: number): void
    stop(): void
    static getActiveCount(): number
    isStopped(): boolean
    getLiveCount(): number
    getPeakCount(): number
    getCapacity(): number
    getEmittedCount(): number
    getSkippedCount(): number
    getFrameCount(): number
    getDrawCount(): number
    getWorkNanos(): number
    getDrawNanos(): number
    getDensity(): number
    getTimeSeconds(): number
    isObserving(): boolean
    getOriginInWindow(): native.Array<number>
    getParticle(index: number): native.Array<number>
    getFrameIntervals(): native.Array<number>
    getBounds(): android.graphics.Rect
  }
  namespace ParticleEmitter {
    class Listener {
      constructor(implementation: { onEnd(): void })
    }
  }
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

declare namespace org.rafaelaugusto.jolt {
  class SharedLayoutFlight extends android.view.View {
    holdPage(page: android.view.View, maxPixels: number): boolean
    fade(duration: number, listener: SharedLayoutFlight.Listener): void
    static captureNavigationImage(
      view: android.view.View,
      radius: number,
      maxPixels: number,
    ): SharedLayoutFlight | null
    static captureClippedNavigationImage(
      view: android.view.View,
      radius: number,
      maxPixels: number,
    ): SharedLayoutFlight | null
    prepareNavigationImage(
      view: android.view.View,
      radius: number,
      maxPixels: number,
    ): string | null
    static capture(
      view: android.view.View,
      image: boolean,
      radius: number,
      maxPixels: number,
    ): SharedLayoutFlight | null
    static activeCount(): number
    pixels(): number
    state(): string
    prepare(
      view: android.view.View,
      image: boolean,
      radius: number,
      maxPixels: number,
    ): string | null
    freeze(maxPixels: number): boolean
    play(configuration: string, listener: SharedLayoutFlight.Listener): void
    dispose(): void
  }
  namespace SharedLayoutFlight {
    class Listener {
      constructor(implementation: { onEnd(completed: boolean): void })
    }
  }
}

declare namespace org.rafaelaugusto.jolt {
  class PredictiveBackSession {
    setSharedScene(scene: SharedNavigationScene): void
    static attach(
      view: android.view.View,
      options: string,
      listener: PredictiveBackSession.Listener,
    ): PredictiveBackSession | null
    static callbackCount(): number
    static activeCount(): number
    static progressEventCount(): number
    getProgress(): number
    setInputEnabled(enabled: boolean): void
    setMotion(reduced: boolean, timeScale: number): void
    handleOnBackPressed(): void
    completeCommit(accepted: boolean): void
    cancel(): void
    dispose(): void
  }
  namespace PredictiveBackSession {
    class Listener {
      constructor(implementation: {
        onState(state: number, progress: number, velocity: number, edge: number): void
      })
    }
  }
}

declare namespace org.rafaelaugusto.jolt {
  class SharedNavigationScene {
    getFailureReason(): string
    pixels(): number
    static capture(
      source: android.view.View,
      page: android.view.View,
      image: boolean,
      radius: number,
      budget: number,
    ): SharedNavigationScene | null
    static retainedCount(): number
    static activeCount(): number
    static retainedPixelCount(): number
    bind(view: android.view.View, radius: number): void
    validSource(): boolean
    isAnimating(): boolean
    dispose(): void
  }
}

declare namespace org.rafaelaugusto.jolt {
  class CircleWorld {
    constructor(container: android.view.View, options: string)
    static worldCount(): number
    static activeCount(): number
    connect(view: android.view.View, index: number): void
    setEnabled(active: boolean): void
    resize(width: number, height: number): void
    impulse(index: number, x: number, y: number): void
    attach(index: number, options: string): void
    snapTo(index: number, target: number): void
    reset(): void
    supportsPointerSpring(): boolean
    snapshot(): string
    dispose(): void
  }
}

declare namespace org.rafaelaugusto.jolt {
  class BlurEffect extends java.lang.Object {
    constructor(view: android.view.View, radius: number)
    static liveCount(): number
    static activeCount(): number
    paint(amount: number): void
    play(program: string): void
    control(time: number, paused: boolean): void
    resize(): void
    snapshot(): string
    dispose(): void
  }
}
