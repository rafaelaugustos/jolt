import Foundation

public enum JoltLoaderStyle: String, CaseIterable, Sendable { case dots, bars, ring }

/// One copy of a loader: its centre in the loader's square, size, rotation around the square's
/// centre (degrees, clockwise) and animated scale and opacity.
public struct JoltLoaderItem: Equatable, Sendable {
  public let x: Double, y: Double, width: Double, height: Double, rotate: Double
  public let scaleX: Double, scaleY: Double, opacity: Double
}

/// A circle in a view's local points.
public struct JoltRevealCircle: Equatable, Sendable {
  public let x: Double, y: Double, radius: Double
  public init(x: Double, y: Double, radius: Double) throws {
    guard [x, y, radius].allSatisfy({ $0.isFinite && abs($0) <= 1_000_000 }), radius >= 0 else {
      throw JoltError.invalidMotion
    }
    self.x = x
    self.y = y
    self.radius = radius
  }
  init(unchecked x: Double, _ y: Double, _ radius: Double) {
    self.x = x
    self.y = y
    self.radius = radius
  }
  /// Linear interpolation of centre and radius; the radius never goes below zero.
  public func mixed(to other: JoltRevealCircle, progress: Double) -> JoltRevealCircle {
    .init(
      unchecked: x + (other.x - x) * progress, y + (other.y - y) * progress,
      max(0, radius + (other.radius - radius) * progress))
  }
}

/// Unit start and end points of a CSS linear gradient: `angle` degrees clockwise from "to top",
/// so 180 runs top to bottom and 90 left to right. The line crosses the centre and is long
/// enough for the corners to receive the first and last colours. Bands stay square to the
/// angle in points, on boxes of any shape.
public struct JoltGradientLine: Equatable, Sendable {
  public let startX: Double, startY: Double, endX: Double, endY: Double
  public init(angle: Double, width: Double, height: Double) throws {
    guard angle.isFinite, width.isFinite, height.isFinite, width >= 0, height >= 0 else {
      throw JoltError.invalidMotion
    }
    let radians = angle.truncatingRemainder(dividingBy: 360) * Double.pi / 180
    let w = max(1e-9, width)
    let h = max(1e-9, height)
    let dx = sin(radians)
    let dy = -cos(radians)
    let half = (abs(w * dx) + abs(h * dy)) / 2
    startX = 0.5 - dx * half / w
    startY = 0.5 - dy * half / h
    endX = 0.5 + dx * half / w
    endY = 0.5 + dy * half / h
  }
}

/// Shared loading-effect definitions (src/core/loading.ts) and their platform-independent math.
public enum JoltEffects {
  public static let shimmerDuration = LoadingDefinitions.shimmerDuration
  /// CSS degrees of the shimmer band.
  public static let shimmerAngle = LoadingDefinitions.shimmerAngle
  /// Band stops in 0...1 and the white opacity at each one.
  public static let shimmerStops = LoadingDefinitions.shimmerStops
  public static let shimmerOpacity = LoadingDefinitions.shimmerOpacity
  public static let loaderStyle = LoadingDefinitions.loaderStyle
  public static let loaderColor = JoltColor(argb: LoadingDefinitions.loaderColor)
  public static let loaderSize = LoadingDefinitions.loaderSize
  public static let loaderDuration = LoadingDefinitions.loaderDuration
  public static let revealDuration = LoadingDefinitions.revealDuration
  public static let revealEase = LoadingDefinitions.revealEase
  /// The longest accepted cycle or reveal, in milliseconds.
  public static let maximumDuration = 60_000.0
  /// The largest accepted loader side, in points.
  public static let maximumLoaderSize = 16_384.0

  static func validCycle(_ duration: Double) -> Bool {
    duration.isFinite && duration > 0 && duration <= maximumDuration
  }

  /// Every copy of a loader in a `size` square. Without `elapsed`, the static pose shown under
  /// reduced motion. Copy `i` runs `i × duration / stagger` milliseconds behind the first.
  public static func loaderItems(
    _ style: JoltLoaderStyle, size: Double, elapsed: Double? = nil,
    duration: Double = loaderDuration
  ) throws -> [JoltLoaderItem] {
    guard size.isFinite, size >= 0, size <= maximumLoaderSize, validCycle(duration),
      elapsed?.isFinite ?? true
    else { throw JoltError.invalidMotion }
    let kind = LoadingDefinitions.loader(style)
    let width = size * kind.width
    let height = size * kind.height
    let orbit = size / 2 - height / 2
    return (0..<kind.count).map { index in
      var value: Double?
      if let elapsed {
        let shifted = elapsed - Double(index) * duration / kind.stagger
        let local = shifted.truncatingRemainder(dividingBy: duration)
        value = keyframe(kind, (local < 0 ? local + duration : local) / duration)
      }
      let scale = kind.property == .opacity ? 1 : value ?? 1
      let angle = style == .ring ? 360 / Double(kind.count) * Double(index) : 0
      let radians = angle * Double.pi / 180
      let x =
        style == .ring
        ? size / 2 + orbit * sin(radians)
        : width / 2 + Double(index) * (size - width) / Double(kind.count - 1)
      return JoltLoaderItem(
        x: x, y: style == .ring ? size / 2 - orbit * cos(radians) : size / 2, width: width,
        height: height, rotate: angle, scaleX: kind.property == .scale ? scale : 1,
        scaleY: scale, opacity: kind.property == .opacity ? value ?? kind.rest : kind.rest)
    }
  }
  private static func keyframe(_ kind: LoadingDefinitions.LoaderKind, _ phase: Double) -> Double {
    for index in 1..<kind.times.count where phase <= kind.times[index] {
      let span = kind.times[index] - kind.times[index - 1]
      let t = span > 0 ? (phase - kind.times[index - 1]) / span : 1
      return kind.values[index - 1] + (kind.values[index] - kind.values[index - 1]) * t
    }
    return kind.values[kind.values.count - 1]
  }

  /// Horizontal offset of the shimmer band in widths of the view: -1 at the start of a sweep,
  /// 1 at its end, linear in between.
  public static func shimmerOffset(elapsed: Double, duration: Double = shimmerDuration) throws
    -> Double
  {
    guard elapsed.isFinite, validCycle(duration) else { throw JoltError.invalidMotion }
    let from = LoadingDefinitions.shimmerTravel[0]
    let to = LoadingDefinitions.shimmerTravel[1]
    let local = elapsed.truncatingRemainder(dividingBy: duration)
    return from + (to - from) * ((local < 0 ? local + duration : local) / duration)
  }

  /// The radius that reaches the farthest corner of a `width` × `height` box from `x`, `y`.
  public static func revealRadius(width: Double, height: Double, x: Double, y: Double) throws
    -> Double
  {
    guard [width, height, x, y].allSatisfy({ $0.isFinite && abs($0) <= 1_000_000 }), width >= 0,
      height >= 0
    else { throw JoltError.invalidMotion }
    return max(
      hypot(x, y), hypot(width - x, y), hypot(x, height - y), hypot(width - x, height - y))
  }

  /// The circle of a reveal (`opening`) or conceal at eased `progress`. It ends centred at `x`,
  /// `y` with the farthest-corner radius or zero, and starts from `start` (an interrupted circle)
  /// or from that centre with zero or the farthest-corner radius.
  public static func revealCircle(
    width: Double, height: Double, x: Double, y: Double, opening: Bool,
    from start: JoltRevealCircle? = nil, progress: Double
  ) throws -> JoltRevealCircle {
    guard progress.isFinite else { throw JoltError.invalidMotion }
    let far = try revealRadius(width: width, height: height, x: x, y: y)
    let destination = JoltRevealCircle(unchecked: x, y, opening ? far : 0)
    let origin = start ?? JoltRevealCircle(unchecked: x, y, opening ? 0 : far)
    return origin.mixed(to: destination, progress: progress)
  }

  /// Clamps stops to 0...1 and keeps them in order without reordering colours, like the
  /// portable gradient projection used while stops animate or follow values.
  public static func projectedStops(_ stops: [Double]) -> [Double] {
    var result = stops.map { $0.isFinite ? min(1, max(0, $0)) : 0 }
    for index in result.indices.dropFirst() {
      result[index] = max(result[index - 1], result[index])
    }
    return result
  }
}
