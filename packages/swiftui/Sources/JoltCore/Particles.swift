import Foundation

public struct JoltParticleSample: Equatable, Sendable {
  public let x: Double, y: Double, rotation: Double, opacity: Double
  /// Radians/second for spin, points/second for velocity, points/second² for gravity.
  public static func sample(
    x: Double, y: Double, vx: Double, vy: Double, gravity: Double,
    spin: Double, lifetime: Double, milliseconds: Double, fadeOut: Bool = true
  ) throws -> Self {
    guard
      [x, y, vx, vy, gravity, spin, milliseconds].allSatisfy({ $0.isFinite && abs($0) <= 1e9 }),
      lifetime.isFinite, lifetime > 0, lifetime <= 60_000
    else { throw JoltError.invalidMotion }
    let age = max(0, milliseconds) / 1000
    return .init(
      x: x + vx * age, y: y + vy * age + gravity * age * age / 2, rotation: spin * age,
      opacity: fadeOut ? max(0, 1 - age * 1000 / lifetime) : 1)
  }
}
