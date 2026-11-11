import Foundation

/// One outer shadow with a fixed colour. Points; `radius` is half the Web's CSS blur distance.
public struct JoltShadow: Equatable, Sendable {
  public let opacity: Double
  public let radius: Double
  public let x: Double
  public let y: Double
  /// Transparent, without blur or offset. A pose without a shadow interpolates from this.
  public static let none = JoltShadow(unchecked: 0, 0, 0, 0)

  public init(opacity: Double, radius: Double, x: Double = 0, y: Double = 0) throws {
    guard [opacity, radius, x, y].allSatisfy({ $0.isFinite && abs($0) <= 1e12 }),
      (0...1).contains(opacity), radius >= 0
    else { throw JoltError.invalidPose }
    self.init(unchecked: opacity, radius, x, y)
  }
  /// Sampled channels, clamped like the shared decoration channels: opacity 0...1, radius >= 0.
  public static func clamped(opacity: Double, radius: Double, x: Double, y: Double) -> JoltShadow {
    func finite(_ value: Double) -> Double { value.isFinite ? min(1e12, max(-1e12, value)) : 0 }
    return JoltShadow(
      unchecked: min(1, max(0, finite(opacity))), max(0, finite(radius)), finite(x), finite(y))
  }
  init(unchecked opacity: Double, _ radius: Double, _ x: Double, _ y: Double) {
    self.opacity = opacity
    self.radius = radius
    self.x = x
    self.y = y
  }
}

/// A perspective distance in points, 1...100000: the eye's distance from the plane of the view.
/// `init(distance:)` validates a computed value; a literal such as `600` is checked at runtime.
public struct JoltPerspective: Equatable, Sendable, ExpressibleByIntegerLiteral,
  ExpressibleByFloatLiteral
{
  public let distance: Double
  public static let range: ClosedRange<Double> = 1...100_000

  public init(distance: Double) throws {
    guard distance.isFinite, Self.range.contains(distance) else { throw JoltError.invalidPose }
    self.distance = distance
  }
  /// A literal outside 1...100000 is a programming error.
  public init(integerLiteral value: Int) { self.init(literal: Double(value)) }
  public init(floatLiteral value: Double) { self.init(literal: value) }
  private init(literal: Double) {
    precondition(literal.isFinite && Self.range.contains(literal), "Perspective is 1...100000 pt")
    distance = literal
  }
}

/// The projection Jolt applies to a view: scale, rotateX, rotateY, rotate, then translation, around
/// the centre of the view's untransformed frame, seen from `perspective` points in front of it.
public enum JoltProjection {
  /// Row-major 3×3 matrix in view-local points (origin top-left, y down):
  /// `[x', y', w'] = M · [x, y, 1]`, screen point `(x'/w', y'/w')`. Orthographic without perspective.
  public static func matrix(
    width: Double, height: Double, pose: JoltPose, perspective: JoltPerspective?
  ) -> [Double] {
    matrix(
      width: width, height: height, x: pose.x, y: pose.y, scaleX: pose.scaleX,
      scaleY: pose.scaleY, rotate: pose.rotate, rotateX: pose.rotateX, rotateY: pose.rotateY,
      distance: perspective?.distance)
  }
  /// Projected corners: top-left, top-right, bottom-right, bottom-left. Throws when a corner
  /// reaches or passes the viewer, where CSS clips the surface instead.
  public static func corners(
    width: Double, height: Double, pose: JoltPose, perspective: JoltPerspective?
  ) throws -> [JoltPoint] {
    guard width.isFinite, height.isFinite, width >= 0, height >= 0 else {
      throw JoltError.invalidPose
    }
    let m = matrix(width: width, height: height, pose: pose, perspective: perspective)
    return try [(0, 0), (width, 0), (width, height), (0, height)].map { x, y in
      let w = m[6] * x + m[7] * y + m[8]
      guard w.isFinite, w > 1e-9 else { throw JoltError.invalidPose }
      return try JoltPoint((m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w)
    }
  }
  package static func matrix(
    width: Double, height: Double, x: Double, y: Double, scaleX: Double, scaleY: Double,
    rotate: Double, rotateX: Double, rotateY: Double, distance: Double?
  ) -> [Double] {
    let radians = Double.pi / 180
    let (sa, ca) = (sin(rotateX * radians), cos(rotateX * radians))
    let (sb, cb) = (sin(rotateY * radians), cos(rotateY * radians))
    let (sr, cr) = (sin(rotate * radians), cos(rotate * radians))
    let a = scaleX * cb * cr
    let b = scaleY * (sa * sb * cr - ca * sr)
    let c = scaleX * cb * sr
    let d = scaleY * (sa * sb * sr + ca * cr)
    let depth = distance.map { 1 / $0 } ?? 0
    let p = scaleX * sb * depth
    let q = -scaleY * sa * cb * depth
    let cx = width / 2
    let cy = height / 2
    let w = 1 - p * cx - q * cy
    return [
      a + cx * p, b + cx * q, x + cx * w - a * cx - b * cy,
      c + cy * p, d + cy * q, y + cy * w - c * cx - d * cy,
      p, q, w,
    ]
  }
}
