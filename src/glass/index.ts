import { Color, GridLayout, View, isIOS, type ViewBase } from '@nativescript/core'
import { parseColor, type ColorValue } from '../color.js'

export type GlassBackend = 'liquid-glass' | 'blur' | 'none'
export type GlassStyle = 'regular' | 'clear'
export type GlassFallback = 'blur' | 'none'
export type GlassRadius = number | 'capsule'

/** Runtime capability, including the NativeScript metadata built into the app. */
export function supportsLiquidGlass(): boolean {
  return (
    isIOS &&
    parseInt(UIDevice.currentDevice.systemVersion, 10) >= 26 &&
    typeof UIGlassEffect !== 'undefined' &&
    typeof UIGlassContainerEffect !== 'undefined'
  )
}
function bounded(value: number | string, name: string, maximum: number) {
  const number = typeof value === 'string' && value.trim() ? Number(value) : value
  if (
    typeof number !== 'number' ||
    !Number.isFinite(number) ||
    number < 0 ||
    number > maximum
  )
    throw new RangeError(`${name} must be within 0..${maximum}.`)
  return number
}

/** Shared native child routing. UIKit effect content belongs inside contentView. */
abstract class GlassLayout extends GridLayout {
  private materialUnloaded = false
  protected abstract configureMaterial(): void
  protected get materialView(): UIVisualEffectView | undefined {
    return isIOS && !this.materialUnloaded
      ? (this.nativeViewProtected as UIVisualEffectView | undefined)
      : undefined
  }
  override createNativeView() {
    return isIOS
      ? UIVisualEffectView.alloc().initWithEffect(null)
      : super.createNativeView()
  }
  override initNativeView() {
    super.initNativeView()
    this.configureMaterial()
  }
  override onLoaded() {
    this.materialUnloaded = false
    super.onLoaded()
    this.configureMaterial()
  }
  override onUnloaded() {
    this.materialUnloaded = true
    if (isIOS && this.nativeViewProtected)
      (this.nativeViewProtected as UIVisualEffectView).effect = null
    super.onUnloaded()
  }
  override disposeNativeView() {
    this.materialUnloaded = true
    if (isIOS && this.nativeViewProtected)
      (this.nativeViewProtected as UIVisualEffectView).effect = null
    super.disposeNativeView()
  }
  override _addViewToNativeVisualTree(child: ViewBase, atIndex?: number): boolean {
    if (!isIOS) return super._addViewToNativeVisualTree(child, atIndex)
    View.prototype._addViewToNativeVisualTree.call(this, child, atIndex)
    const parent = (this.nativeViewProtected as UIVisualEffectView | undefined)
      ?.contentView
    const native = child.nativeViewProtected as UIView | undefined
    if (!parent || !native) return false
    const index = Math.max(
      0,
      Math.min(atIndex ?? parent.subviews.count, parent.subviews.count),
    )
    parent.insertSubviewAtIndex(native, index)
    const shadow = (native as UIView & { outerShadowContainerLayer?: CALayer })
      .outerShadowContainerLayer
    if (shadow && !shadow.superlayer)
      parent.layer.insertSublayerBelow(shadow, native.layer)
    return true
  }
  override _removeViewFromNativeVisualTree(child: ViewBase) {
    if (!isIOS) {
      super._removeViewFromNativeVisualTree(child)
      return
    }
    View.prototype._removeViewFromNativeVisualTree.call(this, child)
    const native = child.nativeViewProtected as
      (UIView & { outerShadowContainerLayer?: CALayer }) | undefined
    native?.outerShadowContainerLayer?.removeFromSuperlayer()
    native?.removeFromSuperview()
  }
}

/** GridLayout whose direct GlassView children share the native iOS 26 glass renderer. */
export class GlassContainer extends GlassLayout {
  private spacing = 16
  /** Distance in DIPs at which nearby native glass elements begin to blend. */
  get glassSpacing(): number {
    return this.spacing
  }
  set glassSpacing(value: number | string) {
    this.spacing = bounded(value, 'glassSpacing', 200)
    this.configureMaterial()
  }
  get glassBackend(): GlassBackend {
    return supportsLiquidGlass() ? 'liquid-glass' : 'none'
  }
  protected configureMaterial() {
    const view = this.materialView
    if (!view) return
    if (supportsLiquidGlass()) {
      const effect = UIGlassContainerEffect.new()
      effect.spacing = this.spacing
      view.effect = effect
    } else view.effect = null
  }
}

/** A regular NativeScript GridLayout with native glass behind its content. */
export class GlassView extends GlassLayout {
  private materialStyle: GlassStyle = 'regular'
  private fallback: GlassFallback = 'blur'
  private radius: GlassRadius = 'capsule'
  private tint?: number
  private interactive = false
  get glassStyle() {
    return this.materialStyle
  }
  set glassStyle(value: GlassStyle) {
    if (!['regular', 'clear'].includes(value))
      throw new TypeError('glassStyle must be regular or clear.')
    this.materialStyle = value
    this.configureMaterial()
  }
  get glassFallback() {
    return this.fallback
  }
  set glassFallback(value: GlassFallback) {
    if (!['blur', 'none'].includes(value))
      throw new TypeError('glassFallback must be blur or none.')
    this.fallback = value
    this.configureMaterial()
  }
  get glassRadius(): GlassRadius {
    return this.radius
  }
  set glassRadius(value: GlassRadius | string) {
    this.radius = value === 'capsule' ? value : bounded(value, 'glassRadius', 1000)
    this.configureMaterial()
  }
  get glassTint(): number | undefined {
    return this.tint
  }
  set glassTint(value: ColorValue | undefined | null) {
    this.tint = value == null ? undefined : parseColor(value)
    this.configureMaterial()
  }
  get glassInteractive(): boolean {
    return this.interactive
  }
  set glassInteractive(value: boolean | string) {
    if (![true, false, 'true', 'false'].includes(value))
      throw new TypeError('glassInteractive must be boolean.')
    this.interactive = value === true || value === 'true'
    this.configureMaterial()
  }
  get glassBackend(): GlassBackend {
    return supportsLiquidGlass()
      ? 'liquid-glass'
      : isIOS && this.fallback === 'blur'
        ? 'blur'
        : 'none'
  }
  protected configureMaterial() {
    const view = this.materialView
    if (!view) return
    if (supportsLiquidGlass()) {
      const effect = UIGlassEffect.effectWithStyle(
        this.materialStyle === 'clear' ? 1 /* clear */ : 0 /* regular */,
      )
      effect.interactive = this.interactive
      effect.tintColor = this.tint === undefined ? null : new Color(this.tint).ios
      view.effect = effect
      view.cornerConfiguration =
        this.radius === 'capsule'
          ? UICornerConfiguration.capsuleConfiguration()
          : UICornerConfiguration.configurationWithUniformRadius(
              UICornerRadius.fixedRadius(this.radius),
            )
    } else {
      view.effect =
        this.fallback === 'blur'
          ? UIBlurEffect.effectWithStyle(6 /* system material */)
          : null
      this.updateFallbackCorners()
    }
  }
  private updateFallbackCorners() {
    if (!isIOS || supportsLiquidGlass() || !this.nativeViewProtected) return
    const view = this.nativeViewProtected as UIVisualEffectView
    view.layer.cornerRadius =
      this.radius === 'capsule'
        ? Math.min(view.bounds.size.width, view.bounds.size.height) / 2
        : this.radius
    view.clipsToBounds = true
  }
  override _redrawNativeBackground(value: any) {
    super._redrawNativeBackground(value)
    // Core redraws CSS corners after onLayout; restore the material's own shape.
    this.updateFallbackCorners()
  }
  override onLayout(left: number, top: number, right: number, bottom: number) {
    super.onLayout(left, top, right, bottom)
    this.updateFallbackCorners()
  }
}
