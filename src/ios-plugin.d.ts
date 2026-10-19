declare class JoltImageEffect extends NSObject {
  stopPreservingImage(): void
  static createWithViewDestinationModeOriginXOriginYAmplitudeRadiusDurationSeedListener(
    image: UIImageView,
    destination: UIImage | null,
    mode: number,
    x: number,
    y: number,
    amplitude: number,
    radius: number,
    duration: number,
    seed: number,
    listener: (completed: boolean, progress: number) => void,
  ): JoltImageEffect | null
  readonly progress: number
  readonly paused: boolean
  readonly frames: number
  readonly longestFrame: number
  readonly textureBytes: number
  play(endpoint: number): void
  pause(): void
  resume(): void
  seek(progress: number): void
  finish(endpoint: number): void
  stop(): void
}
declare class JoltPhotoZoom extends NSObject {
  static attachImageViewportMinimumMaximumDoubleTapDismissReducedBackdropChromeOnDismissOnSettled(
    image: UIImageView,
    viewport: UIView,
    minimum: number,
    maximum: number,
    doubleTap: number,
    dismiss: boolean,
    reduced: boolean,
    backdrop: UIView | null,
    chrome: UIView | null,
    onDismiss: (
      x: number,
      y: number,
      scale: number,
      velocity: number,
      progress: number,
    ) => void,
    onSettled: (x: number, y: number, scale: number) => void,
  ): JoltPhotoZoom
  readonly x: number
  readonly y: number
  readonly scale: number
  readonly dismissProgress: number
  readonly dismissPending: boolean
  zoomFocusXFocusYAnimated(scale: number, x: number, y: number, animated: boolean): void
  reset(animated: boolean): void
  requestDismiss(): void
  setReduced(value: boolean): void
  setActive(value: boolean): void
  layout(): void
  stop(): void
}
