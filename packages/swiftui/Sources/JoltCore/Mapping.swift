import Foundation

/// Piecewise linear mapping. Descending inputs are reversed; an interior knot uses its left slope.
public struct JoltNumericMap: Sendable {
  private let inputs: [Double], outputs: [Double], slopes: [Double]
  public let clamp: Bool
  public init(_ inputs: [Double], _ outputs: [Double], clamp: Bool = true) throws {
    guard (2...1024).contains(inputs.count), inputs.count == outputs.count,
      (inputs + outputs).allSatisfy(\.isFinite)
    else { throw JoltError.invalidMotion }
    let reverse = inputs.last! < inputs[0]
    let x = reverse ? Array(inputs.reversed()) : inputs
    let y = reverse ? Array(outputs.reversed()) : outputs
    var slopes: [Double] = []
    for index in 1..<x.count {
      let span = x[index] - x[index - 1]
      let slope = (y[index] - y[index - 1]) / span
      guard span > 0, span.isFinite, slope.isFinite else { throw JoltError.invalidMotion }
      slopes.append(slope)
    }
    self.inputs = x
    self.outputs = y
    self.slopes = slopes
    self.clamp = clamp
  }
  public func sample(_ value: Double) throws -> (value: Double, slope: Double) {
    guard value.isFinite else { throw JoltError.invalidMotion }
    if clamp {
      if value <= inputs[0] { return (outputs[0], 0) }
      if value >= inputs.last! { return (outputs.last!, 0) }
    }
    var index = 0
    while index < slopes.count - 1 && value > inputs[index + 1] { index += 1 }
    let result = outputs[index] + (value - inputs[index]) * slopes[index]
    guard result.isFinite else { throw JoltError.invalidMotion }
    return (result, slopes[index])
  }
}

/// sRGB ARGB bytes. Interpolation is premultiplied OKLab, clipped to the sRGB output gamut.
public struct JoltColor: Equatable, Sendable {
  public let argb: UInt32
  public init(argb: UInt32) { self.argb = argb }
  public var alpha: Double { Double(argb >> 24) / 255 }
  public var red: Double { Double((argb >> 16) & 255) / 255 }
  public var green: Double { Double((argb >> 8) & 255) / 255 }
  public var blue: Double { Double(argb & 255) / 255 }
  private var lab: [Double] {
    func linear(_ c: Double) -> Double { c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4) }
    let r = linear(red)
    let g = linear(green)
    let b = linear(blue)
    let l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    let m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    let s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ]
  }
  public func mixed(to: JoltColor, progress: Double) throws -> JoltColor {
    guard progress.isFinite else { throw JoltError.invalidMotion }
    let p = min(1, max(0, progress))
    if p == 0 { return self }
    if p == 1 { return to }
    let alpha = alpha + (to.alpha - alpha) * p
    if alpha <= 0 { return .init(argb: 0) }
    let a = lab
    let b = to.lab
    let channels = (0..<3).map { (a[$0] * self.alpha * (1 - p) + b[$0] * to.alpha * p) / alpha }
    let L = channels[0]
    let A = channels[1]
    let B = channels[2]
    let l = pow(L + 0.3963377774 * A + 0.2158037573 * B, 3)
    let m = pow(L - 0.1055613458 * A - 0.0638541728 * B, 3)
    let s = pow(L - 0.0894841775 * A - 1.291485548 * B, 3)
    func byte(_ v: Double) -> UInt32 {
      let encoded = v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055
      return UInt32((min(1, max(0, encoded)) * 255).rounded())
    }
    return .init(
      argb: UInt32((alpha * 255).rounded()) << 24 | byte(
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) << 16 | byte(
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) << 8
        | byte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s))
  }
}

/// Exponential velocity retention per millisecond; velocity is points per second.
public struct JoltDecayMotion: Sendable {
  public let from: Double, to: Double, duration: Double
  private let velocity: Double, rate: Double, distance: Double
  private let bounds: ClosedRange<Double>?
  public init(
    from: Double, velocity: Double, friction: Double = 0.998, precision: Double = 0.001,
    bounds: ClosedRange<Double>? = nil
  ) throws {
    guard [from, velocity, friction, precision].allSatisfy(\.isFinite), abs(from) <= 1e12,
      abs(velocity) <= 1e12,
      friction > 0, friction < 1, precision > 0
    else { throw JoltError.invalidMotion }
    if let bounds {
      guard bounds.lowerBound.isFinite, bounds.upperBound.isFinite, bounds.contains(from) else {
        throw JoltError.invalidMotion
      }
    }
    let rate = -log(friction)
    let distance = velocity / (1000 * rate)
    let target = from + distance
    var duration =
      velocity == 0
      ? 0
      : ceil(
        max(
          0,
          max(log(abs(distance) / precision) / rate, log(abs(velocity) / (precision * 10)) / rate)))
    let to = bounds.map { min($0.upperBound, max($0.lowerBound, target)) } ?? target
    if to != target, distance != 0 {
      duration = min(duration, -log1p(-(to - from) / distance) / rate)
    }
    guard target.isFinite, duration.isFinite, duration <= 60_000, abs(to) <= 1e12 else {
      throw JoltError.invalidMotion
    }
    self.from = from
    self.to = to
    self.velocity = velocity
    self.rate = rate
    self.distance = distance
    self.duration = max(0, duration)
    self.bounds = bounds
  }
  public func sample(at milliseconds: Double) -> JoltScalarSample {
    let time = milliseconds.isFinite ? max(0, milliseconds) : duration
    if time >= duration { return .init(position: to, velocity: 0, completed: true) }
    let raw = from - distance * expm1(-rate * time)
    let position = bounds.map { min($0.upperBound, max($0.lowerBound, raw)) } ?? raw
    return .init(position: position, velocity: velocity * exp(-rate * time), completed: false)
  }
}
