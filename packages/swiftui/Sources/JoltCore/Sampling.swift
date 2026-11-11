import Foundation

/// A pure scalar trajectory. Time is milliseconds; velocity is units per second.
/// Uses the same equations, settlement threshold and 10 s cap as the portable core.
public struct JoltScalarMotion: Sendable {
  public let from: Double
  public let to: Double
  public let initialVelocity: Double
  public let transition: JoltTransition
  public let duration: Double

  public init(
    from: Double, to: Double, velocity: Double = 0, transition: JoltTransition = .spring(.smooth),
    precision: Double = 0.001
  ) throws {
    guard [from, to, velocity, precision].allSatisfy(\.isFinite), precision > 0,
      abs(from) <= 1e12, abs(to) <= 1e12, abs(velocity) <= 1e12
    else { throw JoltError.invalidMotion }
    self.from = from
    self.to = to
    self.initialVelocity = velocity
    self.transition = transition
    switch transition.kind {
    case .tween(let milliseconds, _): duration = milliseconds
    case .spring(let mass, let stiffness, let damping):
      let omega = sqrt(stiffness / mass)
      let ratio = damping / (2 * sqrt(stiffness * mass))
      guard omega.isFinite, ratio.isFinite, omega > 0, ratio > 0 else {
        throw JoltError.invalidMotion
      }
      var time = 0.0
      while time < 10_000 {
        let sample = Self.spring(
          time: time, from: from, to: to, velocity: velocity, mass: mass, stiffness: stiffness,
          damping: damping)
        guard sample.position.isFinite, sample.velocity.isFinite else {
          throw JoltError.invalidMotion
        }
        if abs(sample.position - to) <= precision && abs(sample.velocity) <= precision * 10 {
          break
        }
        time += 1000 / 120
      }
      duration = ceil(time)
    }
  }
  public func sample(at milliseconds: Double) -> JoltScalarSample {
    let time = milliseconds.isFinite ? max(0, milliseconds) : 0
    if time >= duration { return .init(position: to, velocity: 0, completed: true) }
    switch transition.kind {
    case .tween(let duration, let curve):
      let progress = time / duration
      let position = from + (to - from) * Self.bezier(progress, curve)
      let dt = 0.01
      let velocity =
        (to - from)
        * (Self.bezier(min(1, (time + dt) / duration), curve)
          - Self.bezier(max(0, (time - dt) / duration), curve))
        / (min(duration, time + dt) - max(0, time - dt)) * 1000
      return .init(position: position, velocity: velocity, completed: false)
    case .spring(let mass, let stiffness, let damping):
      return Self.spring(
        time: time, from: from, to: to, velocity: initialVelocity, mass: mass, stiffness: stiffness,
        damping: damping)
    }
  }
  private static func spring(
    time: Double, from: Double, to: Double, velocity: Double, mass: Double, stiffness: Double,
    damping: Double
  ) -> JoltScalarSample {
    let t = time / 1000
    let x = from - to
    let w = sqrt(stiffness / mass)
    let z = damping / (2 * sqrt(stiffness * mass))
    let displacement: Double
    let speed: Double
    if abs(z - 1) < 1e-6 {
      let b = velocity + w * x
      let decay = exp(-w * t)
      displacement = decay * (x + b * t)
      speed = decay * (b - w * (x + b * t))
    } else if z < 1 {
      let wd = w * sqrt(1 - z * z)
      let b = (velocity + z * w * x) / wd
      let decay = exp(-z * w * t)
      let cosine = cos(wd * t)
      let sine = sin(wd * t)
      displacement = decay * (x * cosine + b * sine)
      speed = decay * ((b * wd - z * w * x) * cosine + (-x * wd - z * w * b) * sine)
    } else {
      let s = w * sqrt(z * z - 1)
      let r1 = -z * w + s
      let r2 = -z * w - s
      let c1 = (velocity - r2 * x) / (r1 - r2)
      let c2 = x - c1
      displacement = c1 * exp(r1 * t) + c2 * exp(r2 * t)
      speed = c1 * r1 * exp(r1 * t) + c2 * r2 * exp(r2 * t)
    }
    return .init(
      position: to + displacement, velocity: time == 0 ? velocity : speed, completed: false)
  }
  private static func bezier(_ progress: Double, _ c: [Double]) -> Double {
    if progress <= 0 { return 0 }
    if progress >= 1 { return 1 }
    if c[0] == c[1] && c[2] == c[3] { return progress }
    func curve(_ t: Double, _ a: Double, _ b: Double) -> Double {
      3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t
    }
    var low = 0.0
    var high = 1.0
    var t = progress
    for _ in 0..<40 {
      let value = curve(t, c[0], c[2])
      if abs(value - progress) < 1e-7 { break }
      if value < progress { low = t } else { high = t }
      t = (low + high) / 2
    }
    return curve(t, c[1], c[3])
  }
}
public struct JoltScalarSample: Equatable, Sendable {
  public let position: Double
  public let velocity: Double
  public let completed: Bool
}

public enum JoltDirection: String, CaseIterable, Sendable { case up, down, left, right }
public struct JoltPresetParameters: Equatable, Sendable {
  public let distance: Double?
  public let scale: Double?
  public let direction: JoltDirection?
  public let duration: Double?
  public init(
    distance: Double? = nil, scale: Double? = nil, direction: JoltDirection? = nil,
    duration: Double? = nil
  ) throws {
    for (value, maximum) in [(distance, 1_000_000.0), (scale, 100.0), (duration, 60_000.0)] {
      if let value {
        guard value.isFinite, value >= 0, value <= maximum else { throw JoltError.invalidPreset }
      }
    }
    self.distance = distance
    self.scale = scale
    self.direction = direction
    self.duration = duration
  }
  public static let none = Self(unchecked: ())
  private init(unchecked: Void) {
    distance = nil
    scale = nil
    direction = nil
    duration = nil
  }
}
public struct JoltRecipe: Equatable, Sendable {
  public let from: JoltPose
  public let to: JoltPose
  public let transformTransition: JoltTransition
  public let opacityTransition: JoltTransition
}
extension JoltPreset {
  public func recipe(_ parameters: JoltPresetParameters = .none) -> JoltRecipe {
    let entering = !rawValue.contains("Out")
    let originalFrom = pose(active: false)
    let originalTo = pose(active: true)
    var start = originalFrom
    var end = originalTo
    var x = entering ? start.x : end.x
    var y = entering ? start.y : end.y
    if let direction = parameters.direction {
      let distance = parameters.distance ?? 24
      x = 0
      y = 0
      switch direction {
      case .left: x = -distance
      case .right: x = distance
      case .up: y = entering ? distance : -distance
      case .down: y = entering ? -distance : distance
      }
    } else if let distance = parameters.distance {
      x = x == 0 ? 0 : (x < 0 ? -distance : distance)
      y = y == 0 ? 0 : (y < 0 ? -distance : distance)
    }
    let base = entering ? start : end
    let scale = parameters.scale ?? base.scaleX
    let adjusted = JoltPose(
      unchecked: x, y, scale, scale, 0, base.opacity, rotateX: base.rotateX,
      rotateY: base.rotateY)
    if entering { start = adjusted } else { end = adjusted }
    let custom = parameters.duration.map {
      JoltTransition(
        kind: .tween(milliseconds: $0, curve: Definitions.curve(entering ? .easeOut : .easeIn)))
    }
    return .init(
      from: start, to: end, transformTransition: custom ?? transformTransition,
      opacityTransition: custom ?? opacityTransition)
  }
}
