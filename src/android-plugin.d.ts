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
}
