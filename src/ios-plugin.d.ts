declare class JoltReorderHandle extends UIButton {
  onMove: ((direction: number) => void) | null
}
declare class JoltReorderSession extends NSObject {
  static attachOptionsOnState(
    list: UITableView,
    options: string,
    callback: (state: number, index: number, toIndex: number) => void,
  ): JoltReorderSession
  readonly active: boolean
  registerHandle(view: UIView): void
  setEnabled(enabled: boolean): void
  setReducedMotion(reduced: boolean): void
  cancel(): void
  dispose(): void
}
declare class JoltGestureSession extends NSObject {
  static supportsContactEvents(): boolean
  static attachScrollXYScaleRotationOptionsOnState(
    surface: UIView,
    scroll: UIScrollView | null,
    x: JoltLiveSpring,
    y: JoltLiveSpring,
    scale: JoltLiveSpring,
    rotation: JoltLiveSpring,
    options: string,
    onState: (state: number, velocityX: number, velocityY: number) => void,
  ): JoltGestureSession
  readonly active: boolean
  cancel(): void
  refreshScrollDelegate(): void
  setEnabled(value: boolean): void
  settleXYScaleRotationAnimated(
    x: number,
    y: number,
    scale: number,
    rotation: number,
    animated: boolean,
  ): void
  updateLeftRightTopBottom(left: number, right: number, top: number, bottom: number): void
  dispose(): void
}
declare class JoltLiveSpring extends NSObject {
  static createStiffnessDampingMassRestDeltaRestSpeedReduced(
    initial: number,
    stiffness: number,
    damping: number,
    mass: number,
    restDelta: number,
    restSpeed: number,
    reduced: boolean,
  ): JoltLiveSpring
  static activeCount(): number
  static nodeCount(): number
  static sync(view: UIView): void
  readonly position: number
  readonly velocity: number
  readonly moving: boolean
  followMappings(source: JoltLiveSpring, mappings: string): void
  updateInput(snapshot: string): void
  setTarget(value: number): void
  setReduced(value: boolean): void
  setPaused(value: boolean): void
  bindPropertyMappings(
    view: UIView,
    property: string,
    mappings: string,
  ): JoltLiveSpringBinding
  dispose(): void
}
declare class JoltLiveSpringBinding extends NSObject {
  readonly value: number
  setLayers(inputs: string): void
  cancel(): void
}
declare class JoltInteractiveAnimation extends NSObject {
  static startViewLayersKeyPathValuesTimesDurationDelayRepeatReverseFinalValueStartedAtCompletion(
    view: UIView,
    layers: NSArray<CALayer>,
    keyPath: string,
    values: NSArray<number>,
    times: NSArray<number>,
    duration: number,
    delay: number,
    repeat: number,
    reverse: boolean,
    finalValue: number,
    startedAt: number,
    completion: (completed: boolean) => void,
  ): JoltInteractiveAnimation
  static syncViewExcluding(view: UIView, keyPath: string | null): void
  static valueForViewKeyPath(view: UIView, keyPath: string): number | null
  static activeCount(): number
  readonly elapsed: number
  controlPaused(elapsed: number, paused: boolean): void
  cancel(): void
}
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

declare class JoltPropertySink extends NSObject {
  static scalarTargetKeyPath(target: NSObject, keyPath: string): JoltPropertySink
  readonly dimensions: number
  readonly alive: boolean
  readonly compiled: boolean
  read(): NSArray<number>
  write(values: NSArray<number>): void
  dispose(): void
}
declare class JoltPropertyPlayer extends NSObject {
  static startSinkTimesValuesFinalValueDurationDelayRepeatReverseCompletion(
    sink: JoltPropertySink,
    times: NSArray<number>,
    values: NSArray<number>,
    finalValue: NSArray<number>,
    duration: number,
    delay: number,
    repeat: number,
    reverse: boolean,
    completion: (completed: boolean) => void,
  ): JoltPropertyPlayer
  readonly elapsed: number
  readonly frames: number
  static activeCount(): number
  controlPaused(time: number, paused: boolean): void
  cancel(): void
}
declare class JoltReferenceProperties extends NSObject {
  static sceneFieldOfView(camera: NSObject): JoltPropertySink
  static sceneCameraSinkCount(): number
  static sceneCameraWriteCount(): number
  static mapCoordinate(target: NSObject): JoltPropertySink
  static mapCamera(target: NSObject): JoltPropertySink
  static scenePose(target: NSObject): JoltPropertySink
  static sceneLightIntensity(target: NSObject): JoltPropertySink
  static sceneLightColor(target: NSObject): JoltPropertySink
  static sceneMaterialTransparency(target: NSObject): JoltPropertySink
  static sceneMaterialDiffuse(target: NSObject): JoltPropertySink
  static sceneMaterialEmission(target: NSObject): JoltPropertySink
  static sceneAppearanceSinkCount(): number
  static sceneAppearanceWriteCount(): number
}

declare class JoltSceneShaderProperties extends NSObject {
  static environmentError(
    scene: NSObject,
    error: interop.Reference<NSError>,
  ): JoltPropertySink | null
  static uniformNameConfigurationError(
    target: NSObject,
    name: string,
    configuration: string,
    error: interop.Reference<NSError>,
  ): JoltPropertySink | null
  static sinkCount(): number
  static writeCount(): number
}
