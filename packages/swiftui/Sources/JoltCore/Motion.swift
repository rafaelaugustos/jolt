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
  public static let identity = try! JoltPose()

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
    try cubicBezier(milliseconds: milliseconds, points: Definitions.shared.curves[ease.rawValue]!)
  }
  public static func cubicBezier(milliseconds: Double, points: [Double]) throws -> Self {
    guard milliseconds.isFinite, milliseconds >= 0, milliseconds <= 60_000,
      points.count == 4, points.allSatisfy(\.isFinite), (0...1).contains(points[0]),
      (0...1).contains(points[2])
    else { throw JoltError.invalidTransition }
    return Self(kind: .tween(milliseconds: milliseconds, curve: points))
  }
  public static func spring(_ name: JoltSpring) -> Self {
    Definitions.shared.springs[name.rawValue]!.value
  }
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
    var values: [String: Double] = ["x": 0, "y": 0, "scale": 1, "opacity": 1]
    for channel in Definitions.shared.presets[rawValue]! {
      values[channel.property] = active ? channel.to : channel.from ?? values[channel.property]!
    }
    return try! JoltPose(
      x: values["x"]!, y: values["y"]!, scale: values["scale"]!, opacity: values["opacity"]!)
  }
  public var transformTransition: JoltTransition {
    Definitions.shared.presets[rawValue]!.first(where: { $0.property != "opacity" })?.transition
      .value ?? .spring(.smooth)
  }
  public var opacityTransition: JoltTransition {
    Definitions.shared.presets[rawValue]!.first(where: { $0.property == "opacity" })!.transition
      .value
  }
}

struct Definitions: Decodable, Sendable {
  let schema: Int
  let curves: [String: [Double]]
  let springs: [String: TransitionDefinition]
  let presets: [String: [Channel]]
  static let shared: Definitions = {
    let url = Bundle.module.url(forResource: "definitions", withExtension: "json")!
    return try! JSONDecoder().decode(Definitions.self, from: Data(contentsOf: url))
  }()
  struct Channel: Decodable, Sendable {
    let property: String
    let from: Double?
    let to: Double
    let transition: TransitionDefinition
  }
  struct TransitionDefinition: Decodable, Sendable {
    let kind: String
    let milliseconds: Double?
    let curve: [Double]?
    let stiffness: Double?
    let damping: Double?
    let mass: Double?
    var value: JoltTransition {
      if kind == "spring" {
        return try! .spring(mass: mass!, stiffness: stiffness!, damping: damping!)
      }
      return try! .cubicBezier(milliseconds: milliseconds!, points: curve!)
    }
  }
}
