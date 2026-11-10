import JoltCore
import SwiftUI

public struct JoltParticleOptions: Sendable {
  public enum Shape: Sendable { case circle, rectangle, ring }
  public enum Source: Sendable { case center, top, bottom }
  public let colors: [JoltColor]
  public let lifetime: Double, size: Double, velocity: Double, velocityRange: Double
  public let angle: Double, spread: Double, gravity: Double, spin: Double, spinRange: Double
  public let fadeOut: Bool, shape: Shape, source: Source, capacity: Int
  public init(
    colors: [JoltColor] = [.init(argb: 0xffff_ffff)], lifetime: Double = 1500,
    size: Double = 6, velocity: Double = 60, velocityRange: Double = 0, angle: Double = -90,
    spread: Double = 30, gravity: Double = 0, spin: Double = 0, spinRange: Double = 0,
    fadeOut: Bool = true, shape: Shape = .circle, source: Source = .center, capacity: Int = 2000
  ) throws {
    guard (1...32).contains(colors.count), (1...2000).contains(capacity),
      [lifetime, size, velocity, velocityRange, angle, spread, gravity, spin, spinRange].allSatisfy(
        \.isFinite),
      (1...60_000).contains(lifetime), (1...128).contains(size), (0...10_000).contains(velocity),
      (0...10_000).contains(velocityRange), (-360...360).contains(angle),
      (0...360).contains(spread),
      abs(gravity) <= 10_000, abs(spin) <= 3600, (0...3600).contains(spinRange)
    else { throw JoltError.invalidMotion }
    self.colors = colors
    self.lifetime = lifetime
    self.size = size
    self.velocity = velocity
    self.velocityRange = velocityRange
    self.angle = angle
    self.spread = spread
    self.gravity = gravity
    self.spin = spin
    self.spinRange = spinRange
    self.fadeOut = fadeOut
    self.shape = shape
    self.source = source
    self.capacity = capacity
  }
  public static var confetti: Self {
    try! .init(
      colors: [.init(argb: 0xffdb_ff7a), .init(argb: 0xff77_66ff), .init(argb: 0xffff_9dce)],
      lifetime: 2200, size: 8, velocity: 260, velocityRange: 100, spread: 100, gravity: 420,
      spinRange: 360, shape: .rectangle)
  }
}
public struct JoltParticle: Identifiable, Sendable {
  public let id: Int, color: JoltColor
  public let x: Double, y: Double, rotation: Double, opacity: Double
}
/// Optional finite Canvas emitter. Late frames skip expired births without allocating a backlog.
@MainActor public final class JoltParticles: ObservableObject, JoltResource {
  public let options: JoltParticleOptions
  public let clock: JoltClock
  public private(set) var particles: [JoltParticle] = []
  public private(set) var state: JoltPlaybackState = .idle
  public private(set) var disposed = false
  public private(set) var elapsed = 0.0
  private var paused = false, suspended = false, reduced = false, viewReduced = false, armed = false
  private var width = 300.0, height = 180.0, rate = 0.0, duration = 0.0, started = 0.0,
    baseline = 0.0
  private var burstCount = 0, seed: UInt64 = 1
  private var subscription: ClockSubscription?
  private struct Birth {
    let x: Double, y: Double, vx: Double, vy: Double, spin: Double, color: JoltColor
  }
  private var births: [Int: Birth] = [:]
  public init(_ options: JoltParticleOptions = try! .init(), clock: JoltClock = .shared) {
    self.options = options
    self.clock = clock
  }
  /// Existing particles keep their birth position; subsequent births use the new surface size.
  public func resize(width: Double, height: Double) throws {
    guard [width, height].allSatisfy({ $0.isFinite && $0 > 0 && $0 <= 16_384 }) else {
      throw JoltError.invalidMotion
    }
    self.width = width
    self.height = height
  }
  public func burst(count: Int = 80, seed: UInt64 = 1, reducedMotion: Bool = false) throws {
    guard !disposed, (1...options.capacity).contains(count) else { throw JoltError.invalidMotion }
    reset(seed: seed, reduced: reducedMotion)
    burstCount = count
    rate = 0
    duration = 0
    start()
  }
  public func emit(
    rate: Double = 30, duration: Double = 2000, seed: UInt64 = 1,
    reducedMotion: Bool = false
  ) throws {
    guard !disposed, rate.isFinite, rate > 0, rate <= 1000, duration.isFinite,
      duration > 0, duration + options.lifetime <= 60_000,
      ceil(rate * options.lifetime / 1000) <= Double(options.capacity)
    else { throw JoltError.invalidMotion }
    reset(seed: seed, reduced: reducedMotion)
    burstCount = 0
    self.rate = rate
    self.duration = duration
    start()
  }
  private func reset(seed: UInt64, reduced: Bool) {
    subscription?.cancel()
    subscription = nil
    particles = []
    births = [:]
    elapsed = 0
    baseline = 0
    self.seed = seed
    self.reduced = reduced
    state = .idle
    armed = true
  }
  private func start() {
    guard !disposed, armed else { return }
    state = suspended ? .suspended : paused ? .paused : .running
    if !paused, !suspended, subscription == nil {
      started = clock.now
      baseline = elapsed
      subscription = clock.subscribe { [weak self] now in
        guard let self else { return }
        self.paint(self.baseline + max(0, now - self.started))
      }
      paint(elapsed)
    } else {
      objectWillChange.send()
    }
  }
  private func birth(_ index: Int) -> Birth {
    var random = seed &+ UInt64(index) &* 0x9e37_79b9_7f4a_7c15
    func unit() -> Double {
      random = random &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
      return Double(random >> 11) / 9_007_199_254_740_992
    }
    let angle = (options.angle + (unit() - 0.5) * options.spread) * Double.pi / 180
    let speed = max(0, options.velocity + (unit() - 0.5) * options.velocityRange)
    let x = options.source == .center ? width / 2 : unit() * width
    let y = options.source == .center ? height / 2 : options.source == .bottom ? height : 0
    let spin = (options.spin + (unit() - 0.5) * options.spinRange) * Double.pi / 180
    let color = options.colors[
      min(options.colors.count - 1, Int(unit() * Double(options.colors.count)))]
    return .init(
      x: x, y: y, vx: cos(angle) * speed, vy: sin(angle) * speed, spin: spin, color: color)
  }
  private func sample(_ time: Double) {
    elapsed = min(duration + options.lifetime, time)
    if reduced || viewReduced || clock.reducedMotion || elapsed >= duration + options.lifetime {
      subscription?.cancel()
      subscription = nil
      armed = false
      births = [:]
      particles = []
      state = .completed
      return
    }
    let last = burstCount > 0 ? burstCount : Int(floor(min(elapsed, duration) * rate / 1000))
    let first = burstCount > 0 ? 0 : max(0, Int(floor((elapsed - options.lifetime) * rate / 1000)))
    var next: [JoltParticle] = []
    var live: [Int: Birth] = [:]
    for index in max(first, last - options.capacity)..<last {
      let born = burstCount > 0 ? 0 : Double(index + 1) * 1000 / rate
      let age = elapsed - born
      guard age >= 0, age < options.lifetime else { continue }
      let initial = births[index] ?? birth(index)
      live[index] = initial
      let sample = try! JoltParticleSample.sample(
        x: initial.x, y: initial.y, vx: initial.vx, vy: initial.vy,
        gravity: options.gravity, spin: initial.spin, lifetime: options.lifetime, milliseconds: age,
        fadeOut: options.fadeOut)
      next.append(
        .init(
          id: index, color: initial.color, x: sample.x, y: sample.y, rotation: sample.rotation,
          opacity: sample.opacity))
    }
    births = live
    particles = next
  }
  private func paint(_ time: Double) {
    guard !disposed, state == .running else { return }
    sample(time)
    // Notify only after the complete transaction. Reentrant cancellation cannot leave an old clock behind.
    objectWillChange.send()
  }
  private func freeze() {
    if subscription != nil { sample(baseline + max(0, clock.now - started)) }
    subscription?.cancel()
    subscription = nil
  }
  func reduceMotion(_ value: Bool) {
    viewReduced = value
    if value, armed {
      sample(elapsed)
      objectWillChange.send()
    }
  }
  public func pause() {
    guard !disposed else { return }
    freeze()
    paused = true
    if armed { state = .paused }
    objectWillChange.send()
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    start()
  }
  public func suspend() {
    guard !disposed else { return }
    freeze()
    suspended = true
    if armed { state = .suspended }
    objectWillChange.send()
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    start()
  }
  public func cancel() {
    subscription?.cancel()
    subscription = nil
    armed = false
    births = [:]
    particles = []
    state = disposed ? .disposed : .cancelled
    objectWillChange.send()
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    cancel()
  }
}
public struct JoltParticlesView: View {
  @ObservedObject private var model: JoltParticles
  @Environment(\.scenePhase) private var phase
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  public init(_ model: JoltParticles) { self.model = model }
  public var body: some View {
    GeometryReader { geometry in
      Canvas { context, _ in
        guard !reduced, !appReduced else { return }
        let size = model.options.size
        for particle in model.particles {
          var c = context
          c.opacity = particle.opacity
          c.translateBy(x: particle.x, y: particle.y)
          c.rotate(by: .radians(particle.rotation))
          let rect = CGRect(x: -size / 2, y: -size / 2, width: size, height: size)
          if model.options.shape == .rectangle {
            c.fill(
              Path(CGRect(x: -size / 2, y: -size / 4, width: size, height: size / 2)),
              with: .color(particle.color.swiftUIColor))
          } else if model.options.shape == .ring {
            c.stroke(
              Path(ellipseIn: rect), with: .color(particle.color.swiftUIColor),
              lineWidth: max(1, size / 8))
          } else {
            c.fill(Path(ellipseIn: rect), with: .color(particle.color.swiftUIColor))
          }
        }
      }.onAppear {
        model.reduceMotion(reduced || appReduced)
        try? model.resize(width: geometry.size.width, height: geometry.size.height)
        if phase == .active { model.resume() } else { model.suspend() }
      }.onChange(of: geometry.size) { _, size in
        try? model.resize(width: size.width, height: size.height)
      }
    }.allowsHitTesting(false).accessibilityHidden(true)
      .onDisappear { model.suspend() }
      .onChange(of: phase) { _, next in
        if next == .active { model.resume() } else { model.suspend() }
      }
      .onChange(of: reduced || appReduced) { _, next in model.reduceMotion(next) }
  }
}
