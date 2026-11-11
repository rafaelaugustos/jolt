public import JoltCore
import SwiftUI

public typealias JoltShadow = JoltCore.JoltShadow
public typealias JoltPerspective = JoltCore.JoltPerspective
public typealias JoltProjection = JoltCore.JoltProjection

private struct JoltPerspectiveKey: EnvironmentKey {
  static let defaultValue: Double? = nil
}
extension EnvironmentValues {
  var joltPerspective: Double? {
    get { self[JoltPerspectiveKey.self] }
    set { self[JoltPerspectiveKey.self] = newValue }
  }
}

extension View {
  /// Declares a perspective for the nearest Jolt views inside this one that rotate on X or Y.
  /// Each projects around the centre of its own frame and hides the distance from its content.
  /// Without a declaration, or with `nil`, rotateX and rotateY are orthographic.
  public func joltPerspective(_ perspective: JoltPerspective?) -> some View {
    environment(\.joltPerspective, perspective?.distance)
  }
}

struct JoltVector<Storage: SIMD & Sendable>: VectorArithmetic, Sendable
where Storage.Scalar == Double {
  var storage: Storage
  static var zero: Self { Self(storage: .zero) }
  static func + (lhs: Self, rhs: Self) -> Self { Self(storage: lhs.storage + rhs.storage) }
  static func - (lhs: Self, rhs: Self) -> Self { Self(storage: lhs.storage - rhs.storage) }
  mutating func scale(by rhs: Double) { storage *= rhs }
  var magnitudeSquared: Double { (storage * storage).sum() }
  func mixed(with other: Self, _ progress: Double) -> Self {
    Self(storage: storage + (other.storage - storage) * progress)
  }
}

/// x, y, scaleX, scaleY, rotate, rotateX, rotateY in the shared composition order.
typealias JoltDepthChannels = JoltVector<SIMD8<Double>>
extension JoltVector where Storage == SIMD8<Double> {
  init(
    x: Double = 0, y: Double = 0, scaleX: Double = 1, scaleY: Double = 1, rotate: Double = 0,
    rotateX: Double = 0, rotateY: Double = 0
  ) {
    self.init(storage: SIMD8(x, y, scaleX, scaleY, rotate, rotateX, rotateY, 0))
  }
  init(_ pose: JoltPose) {
    self.init(
      x: pose.x, y: pose.y, scaleX: pose.scaleX, scaleY: pose.scaleY, rotate: pose.rotate,
      rotateX: pose.rotateX, rotateY: pose.rotateY)
  }
}

/// opacity, radius, x, y of one outer shadow.
typealias JoltShadowChannels = JoltVector<SIMD4<Double>>
extension JoltVector where Storage == SIMD4<Double> {
  init(_ shadow: JoltShadow?) {
    let value = shadow ?? .none
    self.init(storage: SIMD4(value.opacity, value.radius, value.x, value.y))
  }
  var shadow: JoltShadow {
    .clamped(opacity: storage[0], radius: storage[1], x: storage[2], y: storage[3])
  }
}

/// The transform a Jolt view applies: the shared JoltCore projection for the measured size.
struct JoltDepthEffect: GeometryEffect {
  var channels: JoltDepthChannels
  var distance: Double?
  var animatableData: JoltDepthChannels {
    get { channels }
    set { channels = newValue }
  }
  func effectValue(size: CGSize) -> ProjectionTransform {
    let c = channels.storage
    let m = JoltProjection.matrix(
      width: size.width, height: size.height, x: c[0], y: c[1], scaleX: c[2], scaleY: c[3],
      rotate: c[4], rotateX: c[5], rotateY: c[6], distance: distance)
    var transform = ProjectionTransform()
    transform.m11 = m[0]
    transform.m21 = m[1]
    transform.m31 = m[2]
    transform.m12 = m[3]
    transform.m22 = m[4]
    transform.m32 = m[5]
    transform.m13 = m[6]
    transform.m23 = m[7]
    transform.m33 = m[8]
    return transform
  }
}

/// Applies the channels under the nearest declared perspective. A view that `consumes` it hides
/// the distance from its own content, so only the nearest tilting level projects.
struct JoltDepthModifier: ViewModifier {
  let channels: JoltDepthChannels
  var consumes = true
  @Environment(\.joltPerspective) private var distance
  func body(content: Content) -> some View {
    content.environment(\.joltPerspective, consumes ? nil : distance)
      .modifier(JoltDepthEffect(channels: channels, distance: consumes ? distance : nil))
  }
}

/// One outer shadow drawn with the content, inside the view's transform like the Web's box-shadow.
struct JoltShadowEffect: ViewModifier, Animatable {
  var channels: JoltShadowChannels
  let color: Color
  nonisolated var animatableData: JoltShadowChannels {
    get { channels }
    set { channels = newValue }
  }
  func body(content: Content) -> some View {
    let shadow = channels.shadow
    content.shadow(
      color: color.opacity(shadow.opacity), radius: shadow.radius, x: shadow.x, y: shadow.y)
  }
}

@MainActor enum JoltUnbound {
  static let value = try! JoltMotionValue(0)
}

private struct ShadowBinding: ViewModifier {
  let rest: JoltShadow
  let color: Color
  @ObservedObject var opacity: JoltMotionValue
  @ObservedObject var radius: JoltMotionValue
  @ObservedObject var x: JoltMotionValue
  @ObservedObject var y: JoltMotionValue
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  private func channel(_ value: JoltMotionValue, _ fallback: Double) -> Double {
    value === JoltUnbound.value ? fallback : reduced || appReduced ? value.target : value.value
  }
  var shadow: JoltShadow {
    .clamped(
      opacity: channel(opacity, rest.opacity), radius: channel(radius, rest.radius),
      x: channel(x, rest.x), y: channel(y, rest.y))
  }
  func body(content: Content) -> some View {
    let shadow = shadow
    content.shadow(
      color: color.opacity(shadow.opacity), radius: shadow.radius, x: shadow.x, y: shadow.y
    ).transaction { $0.animation = nil }
  }
}

private struct BoundTransform: ViewModifier {
  @ObservedObject var x: JoltMotionValue
  @ObservedObject var y: JoltMotionValue
  @ObservedObject var scale: JoltMotionValue
  @ObservedObject var scaleX: JoltMotionValue
  @ObservedObject var scaleY: JoltMotionValue
  @ObservedObject var rotate: JoltMotionValue
  @ObservedObject var rotateX: JoltMotionValue
  @ObservedObject var rotateY: JoltMotionValue
  @ObservedObject var opacity: JoltMotionValue
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  init(_ bindings: [JoltValueProperty: JoltMotionValue]) {
    func value(_ property: JoltValueProperty) -> JoltMotionValue {
      bindings[property] ?? JoltUnbound.value
    }
    x = value(.x)
    y = value(.y)
    scale = value(.scale)
    scaleX = value(.scaleX)
    scaleY = value(.scaleY)
    rotate = value(.rotate)
    rotateX = value(.rotateX)
    rotateY = value(.rotateY)
    opacity = value(.opacity)
  }
  private func channel(_ value: JoltMotionValue, _ fallback: Double) -> Double {
    value === JoltUnbound.value ? fallback : reduced || appReduced ? value.target : value.value
  }
  var channels: JoltDepthChannels {
    let factor = channel(scale, 1)
    return .init(
      x: channel(x, 0), y: channel(y, 0), scaleX: factor * channel(scaleX, 1),
      scaleY: factor * channel(scaleY, 1), rotate: channel(rotate, 0),
      rotateX: channel(rotateX, 0), rotateY: channel(rotateY, 0))
  }
  func body(content: Content) -> some View {
    let alpha = opacity === JoltUnbound.value ? 1 : min(1, max(0, opacity.value))
    content.modifier(JoltDepthModifier(channels: channels)).opacity(alpha)
      .transaction { $0.animation = nil }
  }
}

extension View {
  /// Bind several sampled values to one view. Transform channels compose in the shared order
  /// (scale, rotateX, rotateY, rotate, translation) with one projection; `scale` multiplies
  /// `scaleX`/`scaleY`. Bind both 3D axes here: separate depth bindings flatten each other.
  public func joltBind(_ bindings: [JoltValueProperty: JoltMotionValue]) -> some View {
    modifier(BoundTransform(bindings))
  }
  /// One outer shadow with a fixed colour. Each bound channel replaces the declared rest value
  /// and is clamped like the shared decoration channels; an unbound channel shows the rest value.
  /// Reduce Motion shows the bound targets. Put it inside the view's Jolt transform.
  public func joltShadow(
    _ rest: JoltShadow, color: Color = .black, opacity: JoltMotionValue? = nil,
    radius: JoltMotionValue? = nil, x: JoltMotionValue? = nil, y: JoltMotionValue? = nil
  ) -> some View {
    modifier(
      ShadowBinding(
        rest: rest, color: color, opacity: opacity ?? JoltUnbound.value,
        radius: radius ?? JoltUnbound.value, x: x ?? JoltUnbound.value, y: y ?? JoltUnbound.value
      ))
  }
}
