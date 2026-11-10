import Foundation

/// Points, a fraction of available height in (0,1], or measured content including the handle.
public enum JoltSheetSnap: Hashable, Sendable {
  case points(Double)
  case fraction(Double)
  case content
}
public struct JoltSheetStop: Equatable, Sendable {
  public let point: JoltSheetSnap
  public let height: Double
  public let y: Double
}
/// The adapter supplies overlap in the host's coordinate space, after any parent keyboard avoidance.
public struct JoltSheetGeometry: Equatable, Sendable {
  public let height: Double, closedY: Double, top: Double, bottomExtension: Double
  public let stops: [JoltSheetStop]
  public static func validate(_ points: [JoltSheetSnap]) throws {
    guard (1...32).contains(points.count), Set(points).count == points.count else {
      throw JoltError.invalidMotion
    }
    for point in points {
      switch point {
      case .content: break
      case .points(let value):
        guard value.isFinite, value > 0, value <= 1_000_000 else { throw JoltError.invalidMotion }
      case .fraction(let value):
        guard value.isFinite, value > 0, value <= 1 else { throw JoltError.invalidMotion }
      }
    }
  }
  public init(
    _ points: [JoltSheetSnap], hostHeight: Double, contentHeight: Double,
    safeTop: Double = 0, safeBottom: Double = 0, keyboardOverlap: Double = 0,
    extendable: Bool = true
  ) throws {
    try Self.validate(points)
    guard hostHeight.isFinite, hostHeight > 0, hostHeight <= 1_000_000,
      [contentHeight, safeTop, safeBottom, keyboardOverlap].allSatisfy({
        $0.isFinite && $0 >= 0 && $0 <= 1_000_000
      })
    else { throw JoltError.invalidMotion }
    top = safeTop
    let overlap = min(hostHeight, keyboardOverlap)
    bottomExtension = extendable ? max(0, safeBottom - overlap) : 0
    let usable = max(1, hostHeight - top - max(safeBottom, overlap))
    height = usable
    closedY = max(height, hostHeight - top)
    stops = points.map { point in
      let desired: Double
      switch point {
      case .points(let value): desired = value
      case .fraction(let value): desired = value * usable
      case .content: desired = contentHeight
      }
      let visible = max(1, min(usable, desired))
      return .init(point: point, height: visible, y: usable - visible)
    }
  }
  /// The 200 ms projection selects a stop; the actual release velocity drives settlement.
  public func release(at y: Double, velocity: Double, dismissible: Bool) throws -> JoltSheetStop? {
    guard y.isFinite, velocity.isFinite else { throw JoltError.invalidMotion }
    let projected = y + max(-4000, min(4000, velocity)) * 0.2
    var distance = dismissible ? abs(projected - closedY) : Double.infinity
    var result: JoltSheetStop?
    for stop in stops {
      let next = abs(projected - stop.y)
      if next <= distance {
        distance = next
        result = stop
      }
    }
    return result
  }
}
