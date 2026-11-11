import Foundation

public struct JoltGesturePosition: Equatable, Sendable {
  public let x: Double, y: Double, scale: Double, rotate: Double
  public init(x: Double = 0, y: Double = 0, scale: Double = 1, rotate: Double = 0) throws {
    guard [x, y, scale, rotate].allSatisfy({ $0.isFinite && abs($0) <= 1e6 }), scale > 0 else {
      throw JoltError.invalidMotion
    }
    self.x = x
    self.y = y
    self.scale = scale
    self.rotate = rotate
  }
  /// Preserve a viewport focal point while changing scale and rotation. Translation is in viewport points.
  public func transformed(
    scale nextScale: Double, rotate nextAngle: Double,
    focalX: Double = 0, focalY: Double = 0, panX: Double = 0, panY: Double = 0
  ) throws -> Self {
    guard [focalX, focalY, panX, panY].allSatisfy({ $0.isFinite && abs($0) <= 1e6 }) else {
      throw JoltError.invalidMotion
    }
    let ratio = nextScale / scale
    let angle = (nextAngle - rotate) * .pi / 180
    let px = focalX - x
    let py = focalY - y
    return try .init(
      x: focalX - ratio * (cos(angle) * px - sin(angle) * py) + panX,
      y: focalY - ratio * (sin(angle) * px + cos(angle) * py) + panY,
      scale: nextScale, rotate: nextAngle)
  }
}

public struct JoltReorderMove: Equatable, Sendable {
  public let key: String, beforeKey: String?
  public let fromIndex: Int, toIndex: Int
  /// Destination is the final index, after removing the source.
  public static func resolve(_ keys: [String], from: Int, to: Int) -> Self? {
    guard keys.indices.contains(from), keys.indices.contains(to), from != to else { return nil }
    let before = to < from ? to : to + 1
    return .init(
      key: keys[from], beforeKey: keys.indices.contains(before) ? keys[before] : nil,
      fromIndex: from, toIndex: to)
  }
}
/// Extra hit area outside a drop target's frame, per edge, in points (0...1,000).
public struct JoltDropPadding: Equatable, Sendable {
  public static let zero = try! JoltDropPadding(0)
  public static let maximum = 1000.0
  public let top: Double, right: Double, bottom: Double, left: Double
  public init(top: Double = 0, right: Double = 0, bottom: Double = 0, left: Double = 0) throws {
    guard [top, right, bottom, left].allSatisfy({ $0.isFinite && (0...Self.maximum).contains($0) })
    else {
      throw JoltError.invalidMotion
    }
    self.top = top
    self.right = right
    self.bottom = bottom
    self.left = left
  }
  public init(_ all: Double) throws {
    try self.init(top: all, right: all, bottom: all, left: all)
  }
}
public struct JoltDropRect: Equatable, Sendable {
  public let x: Double, y: Double, width: Double, height: Double
  public init(x: Double, y: Double, width: Double, height: Double) throws {
    guard [x, y, width, height].allSatisfy({ $0.isFinite && abs($0) <= 1e6 }), width > 0, height > 0
    else {
      throw JoltError.invalidMotion
    }
    self.x = x
    self.y = y
    self.width = width
    self.height = height
  }
  /// Padding extends the target before either policy, matching the TypeScript `dropHits`.
  public func hits(_ target: Self, overlap: Bool = false, padding: JoltDropPadding = .zero) -> Bool
  {
    let left = target.x - padding.left
    let top = target.y - padding.top
    let right = target.x + target.width + padding.right
    let bottom = target.y + target.height + padding.bottom
    if overlap {
      return min(x + width, right) > max(x, left) && min(y + height, bottom) > max(y, top)
    }
    let px = x + width / 2
    let py = y + height / 2
    return px >= left && px <= right && py >= top && py <= bottom
  }
}
