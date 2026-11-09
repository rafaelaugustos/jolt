import Foundation

public struct JoltPoint: Equatable, Sendable {
  public let x: Double, y: Double
  public init(_ x: Double, _ y: Double) throws {
    guard [x, y].allSatisfy({ $0.isFinite && abs($0) <= 1_000_000 }) else {
      throw JoltError.invalidMotion
    }
    self.x = x
    self.y = y
  }
}
/// A bounded polyline in local points, sampled by arc length. No SVG parser or arbitrary path morphing.
public struct JoltPath: Sendable {
  public let points: [JoltPoint]
  public let length: Double
  private let distances: [Double], headings: [Double]
  public init(_ points: [JoltPoint]) throws {
    guard (2...1024).contains(points.count) else { throw JoltError.invalidMotion }
    var kept = [points[0]]
    var distances = [0.0]
    var headings: [Double] = []
    var total = 0.0
    for point in points.dropFirst() {
      let previous = kept.last!
      let dx = point.x - previous.x
      let dy = point.y - previous.y
      let segment = hypot(dx, dy)
      if segment == 0 { continue }
      var angle = atan2(dy, dx) * 180 / Double.pi
      if let last = headings.last { angle += 360 * floor((last - angle) / 360 + 0.5) }
      total += segment
      kept.append(point)
      distances.append(total)
      headings.append(angle)
    }
    self.points = kept
    self.distances = distances
    self.headings = headings
    self.length = total
  }
  public func sample(_ progress: Double) throws -> JoltPose {
    guard progress.isFinite else { throw JoltError.invalidMotion }
    guard length > 0 else { return try .init(x: points[0].x, y: points[0].y) }
    let position = min(1, max(0, progress)) * length
    var i = 0
    while i < points.count - 2 && position >= distances[i + 1] { i += 1 }
    let p = (position - distances[i]) / (distances[i + 1] - distances[i])
    let a = points[i]
    let b = points[i + 1]
    return try .init(x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, rotate: headings[i])
  }
}
