declare namespace org.rafaelaugusto.jolt {
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
