import { Application, Image, isIOS } from '@nativescript/core'
import { tintColorProperty } from '@nativescript/core/ui/image'
import { toView } from './animate.js'
import { liquidGrid } from './liquid-grid.js'
import type { Target } from './types.js'
import { reducedMotion } from './config.js'
import { ownImage } from './image-owner.js'

export interface LiquidOptions {
  /** Amount of internal deformation, from 0 to 1. Defaults to 0.7. */
  intensity?: number
  /** Milliseconds per seamless cycle. Defaults to 8000. */
  duration?: number
}

export interface LiquidEffect {
  /** Freeze the current deformation. */
  pause(): void
  /** Continue from the paused deformation. */
  resume(): void
  /** Remove the effect and restore the image. Idempotent. */
  stop(): void
}

const running = new WeakMap<Image, LiquidEffect>()
const key = 'jolt:liquid'
const columns = 24
const rows = 24
const steps = 64
const noop = () => {}

/** Deforms a raster image with native iOS texture warps. Android leaves it unchanged. */
export function liquid(target: Target, options: LiquidOptions = {}): LiquidEffect {
  const settings = {
    intensity: options.intensity ?? 0.7,
    duration: options.duration ?? 8000,
  }
  if (
    !Number.isFinite(settings.intensity) ||
    settings.intensity < 0 ||
    settings.intensity > 1
  )
    throw new RangeError('Liquid intensity must be between zero and one.')
  if (!Number.isFinite(settings.duration) || settings.duration <= 0)
    throw new RangeError('Liquid duration must be a positive finite number.')
  const image = toView(target)
  if (!(image instanceof Image)) throw new TypeError('Expected a NativeScript Image.')
  running.get(image)?.stop()
  if (!isIOS || settings.intensity === 0) return { pause: noop, resume: noop, stop: noop }
  return new Liquid(image, settings)
}

class Liquid implements LiquidEffect {
  private releaseOwnership: (() => void) | undefined
  private stopped = false
  private queued = false
  private pausedByUser = false
  private active = UIApplication.sharedApplication.applicationState === 0 // UIApplicationStateActive
  private native: UIImageView | undefined
  private original: UIImage | undefined
  private source: Image['imageSource'] | undefined
  private renderer: SKView | undefined
  private scene: SKScene | undefined
  private sprite: SKSpriteNode | undefined
  private observers: [
    string,
    ReturnType<typeof Application.ios.addNotificationObserver>,
  ][] = []

  constructor(
    private readonly image: Image,
    private readonly settings: Required<LiquidOptions>,
  ) {
    this.releaseOwnership = ownImage(image, this.stop)
    running.set(image, this)
    for (const event of ['loaded', 'layoutChanged', 'imageSourceChange', 'stretchChange'])
      image.on(event, this.schedule)
    image.on('unloaded', this.unloaded)
    image.style.on('visibilityChange', this.schedule)
    image.style.on('tintColorChange', this.schedule)
    this.observe(UIAccessibilityReduceMotionStatusDidChangeNotification, this.schedule)
    this.observe(UIApplicationWillResignActiveNotification, this.suspend)
    this.observe(UIApplicationDidBecomeActiveNotification, this.activate)
    this.schedule()
  }

  pause = () => {
    this.pausedByUser = true
    if (this.renderer) this.renderer.paused = true
  }
  resume = () => {
    if (this.stopped) return
    this.pausedByUser = false
    this.schedule()
  }
  stop = () => {
    if (this.stopped) return
    this.stopped = true
    this.releaseOwnership?.()
    for (const event of ['loaded', 'layoutChanged', 'imageSourceChange', 'stretchChange'])
      this.image.off(event, this.schedule)
    this.image.off('unloaded', this.unloaded)
    this.image.style.off('visibilityChange', this.schedule)
    this.image.style.off('tintColorChange', this.schedule)
    for (const [name, observer] of this.observers)
      Application.ios.removeNotificationObserver(observer, name)
    this.observers = []
    if (running.get(this.image) === this) running.delete(this.image)
    this.remove()
  }
  private observe(name: string, callback: () => void) {
    this.observers.push([name, Application.ios.addNotificationObserver(name, callback)])
  }
  private suspend = () => {
    this.active = false
    if (this.renderer) this.renderer.paused = true
  }
  private activate = () => {
    this.active = true
    this.schedule()
  }
  private unloaded = () => this.remove()
  private schedule = () => {
    if (this.stopped || this.queued) return
    this.queued = true
    void Promise.resolve().then(() => {
      this.queued = false
      if (this.stopped) return
      try {
        this.update()
      } catch (error) {
        this.stop()
        throw error
      }
    })
  }
  private update() {
    if (
      !this.image.isLoaded ||
      this.image.visibility !== 'visible' ||
      this.image.tintColor ||
      reducedMotion()
    )
      return this.remove()
    const native = this.image.nativeViewProtected as UIImageView | undefined
    if (!(native instanceof UIImageView) || !native.window) return this.remove()
    if (
      this.native &&
      (this.native !== native ||
        native.image !== null ||
        this.image.imageSource !== this.source)
    )
      this.remove()
    const source = this.original ?? native.image
    if (
      !source?.CGImage ||
      source.images?.count ||
      source.renderingMode === 2 /* AlwaysTemplate */
    )
      return this.remove()
    if (source.size.width * source.size.height * source.scale ** 2 > 16_777_216)
      return this.remove()
    const bounds = native.bounds
    if (
      bounds.size.width <= 0 ||
      bounds.size.height <= 0 ||
      source.size.width <= 0 ||
      source.size.height <= 0
    )
      return this.remove()
    if (!this.renderer) {
      // A paused SKView cannot draw its first frame. Keep the original visible
      // until rendering can start, including source changes while paused.
      if (this.pausedByUser || !this.active) return
      this.create(native, source)
    }
    const renderer = this.renderer!
    renderer.frame = CGRectMake(
      bounds.origin.x,
      bounds.origin.y,
      bounds.size.width,
      bounds.size.height,
    )
    this.scene!.size = CGSizeMake(bounds.size.width, bounds.size.height)
    const iw = source.size.width
    const ih = source.size.height
    const { width, height } = bounds.size
    const stretch = this.image.stretch
    const scale =
      stretch === 'aspectFill'
        ? Math.max(width / iw, height / ih)
        : Math.min(width / iw, height / ih)
    this.sprite!.size = CGSizeMake(
      stretch === 'fill' ? width : stretch === 'none' ? iw : iw * scale,
      stretch === 'fill' ? height : stretch === 'none' ? ih : ih * scale,
    )
    this.sprite!.position = CGPointMake(width / 2, height / 2)
    renderer.paused = this.pausedByUser || !this.active
  }
  private create(native: UIImageView, source: UIImage) {
    const renderer = SKView.alloc().initWithFrame(native.bounds)
    this.renderer = renderer
    this.native = native
    this.original = source
    this.source = this.image.imageSource
    renderer.opaque = false
    renderer.backgroundColor = UIColor.clearColor
    renderer.allowsTransparency = true
    renderer.asynchronous = true
    renderer.userInteractionEnabled = false
    renderer.accessibilityElementsHidden = true
    renderer.clipsToBounds = true
    renderer.preferredFramesPerSecond = Math.min(
      120,
      native.window?.screen?.maximumFramesPerSecond ?? 60,
    )
    renderer.paused = true
    const scene = SKScene.sceneWithSize(native.bounds.size)
    this.scene = scene
    scene.backgroundColor = UIColor.clearColor
    scene.scaleMode = 3 // SKSceneScaleModeResizeFill
    const texture = SKTexture.textureWithImage(source)
    const sprite = SKSpriteNode.spriteNodeWithTexture(texture)
    this.sprite = sprite
    const warps: SKWarpGeometryGrid[] = []
    const times: number[] = []
    for (let step = 0; step <= steps; step++) {
      const positions = liquidGrid(
        columns,
        rows,
        step === steps ? 0 : step / steps,
        this.settings.intensity,
      )
      warps.push(
        SKWarpGeometryGrid.gridWithColumnsRowsSourcePositionsDestPositions(
          columns,
          rows,
          null,
          positions,
        ),
      )
      times.push(((step / steps) * this.settings.duration) / 1000)
    }
    const loop = SKAction.animateWithWarpsTimes(warps, times)
    if (!loop) throw new Error('Unable to create the liquid warp action.')
    sprite.warpGeometry = SKWarpGeometryGrid.gridWithColumnsRows(columns, rows)
    const entrance = SKAction.warpToDuration(
      warps[0]!,
      Math.min(0.35, this.settings.duration / 10000),
    )
    if (!entrance) throw new Error('Unable to create the liquid entrance.')
    sprite.runActionWithKey(
      SKAction.sequence([entrance, SKAction.repeatActionForever(loop)]),
      key,
    )
    scene.addChild(sprite)
    renderer.presentScene(scene)
    native.addSubview(renderer)
    native.image = null
  }
  private remove() {
    const { renderer, sprite, native, original } = this
    if (renderer) {
      renderer.paused = true
      sprite?.removeAllActions()
      sprite?.removeFromParent()
      renderer.presentScene(null)
      renderer.removeFromSuperview()
    }
    if (
      native &&
      native.image === null &&
      original &&
      this.image.imageSource === this.source
    ) {
      native.image = original
      // Core couldn't turn the suppressed UIImage into a template while it was
      // hidden. Reapply its public native setter when a tint takes over.
      if (this.image.tintColor)
        (this.image as unknown as Record<symbol, (value: unknown) => void>)[
          tintColorProperty.setNative
        ]!(this.image.tintColor)
    }
    this.renderer = this.scene = this.sprite = this.native = this.original = undefined
    this.source = undefined
  }
}
