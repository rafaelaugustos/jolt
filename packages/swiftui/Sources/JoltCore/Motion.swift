import Foundation

public enum JoltError: Error, Equatable {
  case invalidPose
  case invalidTransition
  case invalidMotion
  case invalidPreset
  case disposed
  case invalidTimeline
}

/// Immutable target values: points, scale factors, degrees and opacity 0...1.
public struct JoltPose: Equatable, Sendable {
  public let x: Double
  public let y: Double
  public let scaleX: Double
  public let scaleY: Double
  public let rotate: Double
  public let opacity: Double
  public static let identity = JoltPose(unchecked: 0, 0, 1, 1, 0, 1)

  public init(
    x: Double = 0, y: Double = 0, scaleX: Double = 1, scaleY: Double = 1, rotate: Double = 0,
    opacity: Double = 1
  ) throws {
    guard [x, y, scaleX, scaleY, rotate, opacity].allSatisfy(\.isFinite), (0...1).contains(opacity)
    else { throw JoltError.invalidPose }
    self.x = x
    self.y = y
    self.scaleX = scaleX
    self.scaleY = scaleY
    self.rotate = rotate
    self.opacity = opacity
  }
  public init(x: Double = 0, y: Double = 0, scale: Double, rotate: Double = 0, opacity: Double = 1)
    throws
  {
    try self.init(x: x, y: y, scaleX: scale, scaleY: scale, rotate: rotate, opacity: opacity)
  }
  public var transform: [Double] { [x, y, scaleX, scaleY, rotate] }
  init(
    unchecked x: Double, _ y: Double, _ scaleX: Double, _ scaleY: Double, _ rotate: Double,
    _ opacity: Double
  ) {
    self.x = x
    self.y = y
    self.scaleX = scaleX
    self.scaleY = scaleY
    self.rotate = rotate
    self.opacity = opacity
  }
}

public enum JoltSpring: String, CaseIterable, Sendable { case smooth, snappy, bouncy }
public enum JoltEase: String, CaseIterable, Sendable {
  case linear, ease, easeIn, easeOut, easeInOut
}

/// Validated finite transition. Execution and interruption belong to the platform adapter.
public struct JoltTransition: Equatable, Sendable {
  public enum Kind: Equatable, Sendable {
    case tween(milliseconds: Double, curve: [Double])
    case spring(mass: Double, stiffness: Double, damping: Double)
  }
  public let kind: Kind
  public static func tween(milliseconds: Double = 300, ease: JoltEase = .easeOut) throws -> Self {
    try cubicBezier(milliseconds: milliseconds, points: Definitions.curve(ease))
  }
  public static func cubicBezier(milliseconds: Double, points: [Double]) throws -> Self {
    guard milliseconds.isFinite, milliseconds >= 0, milliseconds <= 60_000,
      points.count == 4, points.allSatisfy(\.isFinite), (0...1).contains(points[0]),
      (0...1).contains(points[2])
    else { throw JoltError.invalidTransition }
    return Self(kind: .tween(milliseconds: milliseconds, curve: points))
  }
  public static func spring(_ name: JoltSpring) -> Self { Self(kind: Definitions.spring(name)) }
  public static func spring(mass: Double = 1, stiffness: Double, damping: Double) throws -> Self {
    guard [mass, stiffness, damping].allSatisfy(\.isFinite), mass > 0, stiffness > 0, damping > 0
    else { throw JoltError.invalidTransition }
    return Self(kind: .spring(mass: mass, stiffness: stiffness, damping: damping))
  }
}

public enum JoltPreset: String, CaseIterable, Sendable {
  case fadeIn, fadeInUp, fadeInDown, fadeInLeft, fadeInRight, zoomIn, popIn
  case fadeOut, fadeOutUp, fadeOutDown, fadeOutLeft, fadeOutRight, zoomOut
  /// False is the explicit recipe start; true is its endpoint. This does not remove a view.
  public func pose(active: Bool) -> JoltPose {
    var x = 0.0, y = 0.0, scale = 1.0, opacity = 1.0
    for channel in Definitions.channels(self) {
      let value = active ? channel.to : channel.from
      switch channel.property {
      case .x: x = value ?? x
      case .y: y = value ?? y
      case .scale: scale = value ?? scale
      case .opacity: opacity = value ?? opacity
      }
    }
    return JoltPose(unchecked: x, y, scale, scale, 0, opacity)
  }
  public var transformTransition: JoltTransition {
    Definitions.channels(self).first(where: { $0.property != .opacity }).map {
      JoltTransition(kind: $0.kind)
    } ?? .spring(.smooth)
  }
  public var opacityTransition: JoltTransition {
    Definitions.channels(self).first(where: { $0.property == .opacity }).map {
      JoltTransition(kind: $0.kind)
    } ?? .spring(.smooth)
  }
}
