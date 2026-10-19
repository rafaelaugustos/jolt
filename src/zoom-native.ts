import { Utils, isIOS, type Image, type View } from '@nativescript/core'

export interface ZoomSnapshot {
  x: number
  y: number
  scale: number
  progress: number
  pending: boolean
}
export interface ZoomDriver {
  readonly native: object
  readonly state: ZoomSnapshot
  zoom(scale: number, x: number, y: number, animated: boolean): void
  reset(animated: boolean): void
  requestDismiss(): void
  setReduced(value: boolean): void
  setActive(value: boolean): void
  layout(): void
  stop(): void
}
export interface ZoomSettings {
  minimum: number
  maximum: number
  doubleTap: number
  dismiss: boolean
  reduced: boolean
  backdrop?: View
  chrome?: View
}

export function createZoomDriver(
  image: Image,
  viewport: View,
  options: ZoomSettings,
  dismiss: (
    x: number,
    y: number,
    scale: number,
    velocity: number,
    progress: number,
  ) => void,
  settled: (x: number, y: number, scale: number) => void,
): ZoomDriver {
  const { minimum, maximum, doubleTap, reduced, backdrop, chrome } = options
  if (isIOS) {
    const native =
      JoltPhotoZoom.attachImageViewportMinimumMaximumDoubleTapDismissReducedBackdropChromeOnDismissOnSettled(
        image.nativeViewProtected,
        viewport.nativeViewProtected,
        minimum,
        maximum,
        doubleTap,
        options.dismiss,
        reduced,
        backdrop?.nativeViewProtected ?? null,
        chrome?.nativeViewProtected ?? null,
        dismiss,
        settled,
      )
    return {
      native,
      get state() {
        return {
          x: native.x,
          y: native.y,
          scale: native.scale,
          progress: native.dismissProgress,
          pending: native.dismissPending,
        }
      },
      zoom: (s, x, y, a) => native.zoomFocusXFocusYAnimated(s, x, y, a),
      reset: (a) => native.reset(a),
      requestDismiss: () => native.requestDismiss(),
      setReduced: (r) => native.setReduced(r),
      setActive: (a) => native.setActive(a),
      layout: () => native.layout(),
      stop: () => native.stop(),
    }
  }
  const density = Utils.layout.getDisplayDensity()
  const source = image.imageSource!
  const angle = Math.abs((source.rotationAngle ?? 0) % 180)
  const swapped = angle > 45 && angle < 135
  const native = new org.rafaelaugusto.jolt.PhotoZoom(
    image.nativeViewProtected,
    viewport.nativeViewProtected,
    swapped ? source.height : source.width,
    swapped ? source.width : source.height,
    minimum,
    maximum,
    doubleTap,
    options.dismiss,
    reduced,
    backdrop?.nativeViewProtected ?? null,
    chrome?.nativeViewProtected ?? null,
    (viewport as View & { touchListener?: android.view.View.OnTouchListener })
      .touchListener ?? null,
    (image as View & { touchListener?: android.view.View.OnTouchListener })
      .touchListener ?? null,
    new org.rafaelaugusto.jolt.PhotoZoom.Listener({
      onDismiss: dismiss,
      onSettled: settled,
    }),
  )
  return {
    native,
    get state() {
      return {
        x: native.getX(),
        y: native.getY(),
        scale: native.getScale(),
        progress: native.getDismissProgress(),
        pending: native.isDismissPending(),
      }
    },
    zoom: (s, x, y, a) => native.zoom(s, x * density, y * density, a),
    reset: (a) => native.reset(a),
    requestDismiss: () => native.requestDismiss(),
    setReduced: (r) => native.setReduced(r),
    setActive: (a) => native.setActive(a),
    layout: () => {},
    stop: () => native.stop(),
  }
}
