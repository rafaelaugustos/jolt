import Foundation

public enum JoltRigChannel: String, CaseIterable, Sendable { case x, y, scaleX, scaleY, rotate }
public struct JoltRigTransform: Sendable {
  public let values: [JoltRigChannel: Double]
  public init(_ values: [JoltRigChannel: Double] = [:]) throws {
    guard values.values.allSatisfy({ $0.isFinite && abs($0) <= 1e6 }),
      [values[.scaleX], values[.scaleY]].compactMap({ $0 }).allSatisfy({ abs($0) <= 100 })
    else { throw JoltError.invalidMotion }
    self.values = values
  }
  public func value(_ channel: JoltRigChannel) -> Double {
    values[channel] ?? (channel == .scaleX || channel == .scaleY ? 1 : 0)
  }
}
public struct JoltRigPart: Sendable {
  public let parent: String?
  public let width: Double, height: Double, pivotX: Double, pivotY: Double
  public let rest: JoltRigTransform, rotation: ClosedRange<Double>?
  public init(
    parent: String? = nil, width: Double, height: Double, pivotX: Double = 0.5,
    pivotY: Double = 0.5, rest: JoltRigTransform = try! .init(),
    rotation: ClosedRange<Double>? = nil
  ) throws {
    guard [width, height, pivotX, pivotY].allSatisfy(\.isFinite), width > 0, height > 0,
      width <= 10_000, height <= 10_000, abs(pivotX) <= 10, abs(pivotY) <= 10
    else { throw JoltError.invalidMotion }
    if let rotation {
      guard rotation.lowerBound.isFinite, rotation.upperBound.isFinite,
        abs(rotation.lowerBound) <= 1e6, abs(rotation.upperBound) <= 1e6
      else { throw JoltError.invalidMotion }
    }
    self.parent = parent
    self.width = width
    self.height = height
    self.pivotX = pivotX
    self.pivotY = pivotY
    self.rest = rest
    self.rotation = rotation
  }
}
public struct JoltRigSocket: Sendable {
  public let part: String, x: Double, y: Double, relative: Bool
  public init(part: String, x: Double, y: Double, relative: Bool = false) throws {
    guard [x, y].allSatisfy({ $0.isFinite && abs($0) <= 1e6 }) else {
      throw JoltError.invalidMotion
    }
    self.part = part
    self.x = x
    self.y = y
    self.relative = relative
  }
}
public struct JoltRigLayer: Sendable {
  public let pose: String, weight: Double
  public init(_ pose: String, weight: Double = 1) {
    self.pose = pose
    self.weight = weight
  }
}
public struct JoltAffine: Equatable, Sendable {
  public let a: Double, b: Double, c: Double, d: Double, tx: Double, ty: Double
  public static let identity = Self(a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0)
  public func concatenating(_ n: Self) throws -> Self {
    let result = Self(
      a: a * n.a + c * n.b, b: b * n.a + d * n.b, c: a * n.c + c * n.d, d: b * n.c + d * n.d,
      tx: a * n.tx + c * n.ty + tx, ty: b * n.tx + d * n.ty + ty)
    guard
      [result.a, result.b, result.c, result.d, result.tx, result.ty].allSatisfy({
        $0.isFinite && abs($0) <= 1e12
      })
    else { throw JoltError.invalidMotion }
    return result
  }
  public func point(x: Double, y: Double) throws -> JoltPoint {
    try .init(a * x + c * y + tx, b * x + d * y + ty)
  }
}
public struct JoltRigDefinition: Sendable {
  public let parts: [String: JoltRigPart], poses: [String: [String: JoltRigTransform]],
    sockets: [String: JoltRigSocket]
  public let order: [String]
  public init(
    parts: [String: JoltRigPart], poses: [String: [String: JoltRigTransform]],
    sockets: [String: JoltRigSocket] = [:]
  ) throws {
    guard (1...64).contains(parts.count), poses.count <= 128, sockets.count <= 256,
      [Array(parts.keys), Array(poses.keys), Array(sockets.keys)].flatMap({ $0 }).allSatisfy({
        !$0.isEmpty && $0.count <= 128
      })
    else { throw JoltError.invalidMotion }
    var order: [String] = []
    var visiting = Set<String>()
    var visited = Set<String>()
    func visit(_ name: String) throws {
      guard let part = parts[name], !visiting.contains(name) else { throw JoltError.invalidMotion }
      if visited.contains(name) { return }
      visiting.insert(name)
      if let parent = part.parent { try visit(parent) }
      visiting.remove(name)
      visited.insert(name)
      order.append(name)
    }
    for name in parts.keys.sorted() { try visit(name) }
    guard poses.values.allSatisfy({ $0.keys.allSatisfy({ parts[$0] != nil }) }),
      sockets.values.allSatisfy({ parts[$0.part] != nil })
    else { throw JoltError.invalidMotion }
    self.parts = parts
    self.poses = poses
    self.sockets = sockets
    self.order = order
    _ = try matrices(parts.mapValues { $0.rest })
  }
  public func destination(_ layers: [JoltRigLayer], current: [String: JoltRigTransform]) throws
    -> [String: JoltRigTransform]
  {
    guard layers.count <= 128,
      layers.allSatisfy({
        $0.weight.isFinite && $0.weight >= 0 && $0.weight <= 1e6 && poses[$0.pose] != nil
      })
    else { throw JoltError.invalidMotion }
    var result: [String: JoltRigTransform] = [:]
    for name in order {
      let part = parts[name]!
      var values: [JoltRigChannel: Double] = [:]
      for channel in JoltRigChannel.allCases {
        let rest = part.rest.value(channel)
        let old = current[name]?.value(channel) ?? rest
        var total = 0.0
        var offset = 0.0
        for layer in layers {
          if let value = poses[layer.pose]?[name]?.values[channel] {
            total += layer.weight
            offset +=
              (channel == .rotate && part.rotation == nil
                ? Self.shortest(value - rest) : value - rest) * layer.weight
          }
        }
        var value = rest + offset / max(1, total)
        if channel == .rotate {
          if let limits = part.rotation {
            value = min(limits.upperBound, max(limits.lowerBound, value))
          } else {
            value = old + Self.shortest(value - old)
          }
        }
        values[channel] = value
      }
      result[name] = try .init(values)
    }
    _ = try matrices(result)
    return result
  }
  public static func shortest(_ degrees: Double) -> Double {
    let value = (degrees + 180).truncatingRemainder(dividingBy: 360)
    return (value < 0 ? value + 360 : value) - 180
  }
  public func matrices(_ transforms: [String: JoltRigTransform]) throws -> [String: JoltAffine] {
    var result: [String: JoltAffine] = [:]
    for name in order {
      let part = parts[name]!
      let transform = transforms[name] ?? part.rest
      var rotation = transform.value(.rotate)
      if let range = part.rotation {
        rotation = min(range.upperBound, max(range.lowerBound, rotation))
      }
      let angle = rotation * Double.pi / 180
      let sx = transform.value(.scaleX)
      let sy = transform.value(.scaleY)
      let a = cos(angle) * sx
      let b = sin(angle) * sx
      let c = -sin(angle) * sy
      let d = cos(angle) * sy
      let px = part.pivotX * part.width
      let py = part.pivotY * part.height
      let local = JoltAffine(
        a: a, b: b, c: c, d: d, tx: transform.value(.x) + px - a * px - c * py,
        ty: transform.value(.y) + py - b * px - d * py)
      result[name] = try (part.parent.flatMap { result[$0] } ?? .identity).concatenating(local)
    }
    return result
  }
  public func point(_ socket: String, transforms: [String: JoltRigTransform]) throws -> JoltPoint {
    guard let socket = sockets[socket], let part = parts[socket.part],
      let matrix = try matrices(transforms)[socket.part]
    else { throw JoltError.invalidMotion }
    return try matrix.point(
      x: socket.x * (socket.relative ? part.width : 1),
      y: socket.y * (socket.relative ? part.height : 1))
  }
}
