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
public enum JoltPathSegment: Sendable {
  case line(to: JoltPoint)
  case quadratic(control: JoltPoint, to: JoltPoint)
  case cubic(control1: JoltPoint, control2: JoltPoint, to: JoltPoint)
}
private struct PathVector: Sendable {
  let x: Double, y: Double
  init(_ point: JoltPoint) {
    x = point.x
    y = point.y
  }
  init(_ x: Double, _ y: Double) {
    self.x = x
    self.y = y
  }
  func distance(to b: Self) -> Double { hypot(b.x - x, b.y - y) }
  func mix(_ b: Self, _ t: Double) -> Self { .init(x + (b.x - x) * t, y + (b.y - y) * t) }
}
private struct PathCurve: Sendable {
  let points: [PathVector]
  private func evaluate(_ points: [PathVector], _ t: Double) -> PathVector {
    var row = points
    while row.count > 1 { row = (1..<row.count).map { row[$0 - 1].mix(row[$0], t) } }
    return row[0]
  }
  func point(_ t: Double) -> PathVector { evaluate(points, t) }
  func tangent(_ t: Double) -> PathVector {
    let n = Double(points.count - 1)
    return evaluate(
      (1..<points.count).map {
        .init((points[$0].x - points[$0 - 1].x) * n, (points[$0].y - points[$0 - 1].y) * n)
      }, t)
  }
  func heading(_ t: Double, fallback: PathVector) -> Double {
    var v = tangent(t)
    if hypot(v.x, v.y) < 1e-9 {
      let a = point(max(0, t - 1e-5))
      let b = point(min(1, t + 1e-5))
      v = .init(b.x - a.x, b.y - a.y)
      if hypot(v.x, v.y) < 1e-9 { v = fallback }
    }
    return atan2(v.y, v.x) * 180 / Double.pi
  }
}
private struct PathVertex: Sendable {
  let point: PathVector
  let segment: Int, t: Double, distance: Double
  var heading: Double
}
private func pathUnwrap(_ angle: Double, _ reference: Double) -> Double {
  angle + 360 * floor((reference - angle) / 360 + 0.5)
}
/// Bounded local paths sampled by arc length, with analytic tangent orientation.
/// Supports typed lines, quadratic and cubic curves; no SVG parser or arbitrary morphing.
public struct JoltPath: Sendable {
  /// The bounded adaptive polyline used to approximate arc length and position.
  public let points: [JoltPoint]
  public let length: Double
  private let curves: [PathCurve]
  private let vertices: [PathVertex]
  public init(_ points: [JoltPoint]) throws {
    guard (2...1024).contains(points.count) else { throw JoltError.invalidMotion }
    try self.init(from: points[0], segments: points.dropFirst().map { .line(to: $0) })
  }
  public init(from start: JoltPoint, segments: [JoltPathSegment]) throws {
    guard (1...1024).contains(segments.count) else { throw JoltError.invalidMotion }
    var current = start
    var curves: [PathCurve] = []
    for segment in segments {
      let points: [JoltPoint]
      switch segment {
      case .line(let to):
        points = [current, to]
        current = to
      case .quadratic(let control, let to):
        points = [current, control, to]
        current = to
      case .cubic(let control1, let control2, let to):
        points = [current, control1, control2, to]
        current = to
      }
      curves.append(.init(points: points.map(PathVector.init)))
    }
    var vertices: [PathVertex] = [
      .init(point: .init(start), segment: 0, t: 0, distance: 0, heading: 0)
    ]
    func append(_ point: PathVector, _ index: Int, _ t: Double) throws {
      let last = vertices.last!
      let distance = last.point.distance(to: point)
      guard distance > 0 else { return }
      guard vertices.count < 8192 else { throw JoltError.invalidMotion }
      _ = try JoltPoint(point.x, point.y)
      let direction = PathVector(point.x - last.point.x, point.y - last.point.y)
      let start = curves[index].heading(last.segment == index ? last.t : 0, fallback: direction)
      if vertices.count == 1 { vertices[0].heading = start }
      let angle = pathUnwrap(
        curves[index].heading(t, fallback: direction), pathUnwrap(start, last.heading))
      vertices.append(
        .init(
          point: point, segment: index, t: t, distance: last.distance + distance, heading: angle))
    }
    for (index, curve) in curves.enumerated() {
      func flatten(_ t0: Double, _ t1: Double, _ a: PathVector, _ b: PathVector, _ depth: Int)
        throws
      {
        let span = t1 - t0
        let q1 = curve.point(t0 + span * 0.25)
        let mid = curve.point(t0 + span * 0.5)
        let q3 = curve.point(t0 + span * 0.75)
        let poly =
          a.distance(to: q1) + q1.distance(to: mid) + mid.distance(to: q3) + q3.distance(to: b)
        let chord = a.distance(to: b)
        let deviation = max(
          q1.distance(to: a.mix(b, 0.25)), mid.distance(to: a.mix(b, 0.5)),
          q3.distance(to: a.mix(b, 0.75)))
        let directions = [t0, t0 + span * 0.25, t0 + span * 0.5, t0 + span * 0.75, t1].map(
          curve.tangent)
        let turn = (1..<directions.count).contains { i in
          let a = directions[i - 1]
          let b = directions[i]
          return hypot(a.x, a.y) > 1e-12 && hypot(b.x, b.y) > 1e-12
            && abs(atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)) > Double.pi / 8
        }
        if poly - chord <= 0.025 && deviation <= 0.025 && (!turn || depth >= 18) {
          try append(b, index, t1)
          return
        }
        guard depth < 18 else { throw JoltError.invalidMotion }
        try flatten(t0, (t0 + t1) / 2, a, mid, depth + 1)
        try flatten((t0 + t1) / 2, t1, mid, b, depth + 1)
      }
      try flatten(0, 1, curve.point(0), curve.point(1), 0)
    }
    self.curves = curves
    self.vertices = vertices
    self.points = try vertices.map { try JoltPoint($0.point.x, $0.point.y) }
    length = vertices.last!.distance
  }
  public func sample(_ progress: Double) throws -> JoltPose {
    guard progress.isFinite else { throw JoltError.invalidMotion }
    guard length > 0 else { return try .init(x: points[0].x, y: points[0].y) }
    let position = min(1, max(0, progress)) * length
    var low = 1
    var high = vertices.count - 1
    while low < high {
      let middle = (low + high) / 2
      if vertices[middle].distance <= position { low = middle + 1 } else { high = middle }
    }
    let a = vertices[low - 1]
    let b = vertices[low]
    let fraction = min(1, max(0, (position - a.distance) / (b.distance - a.distance)))
    let point = a.point.mix(b.point, fraction)
    let t0 = a.segment == b.segment ? a.t : 0
    let t = t0 + (b.t - t0) * fraction
    let angle = curves[b.segment].heading(
      t, fallback: .init(b.point.x - a.point.x, b.point.y - a.point.y))
    return try .init(x: point.x, y: point.y, rotate: pathUnwrap(angle, b.heading))
  }
}
