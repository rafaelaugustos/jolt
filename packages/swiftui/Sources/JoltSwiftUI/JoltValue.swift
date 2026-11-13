import JoltCore
import SwiftUI

@MainActor public protocol JoltResource: AnyObject, Sendable {
  var disposed: Bool { get }
  func pause()
  func play()
  func suspend()
  func resume()
  func dispose()
}
public enum JoltPlaybackState: String, Sendable {
  case idle, running, paused, suspended, completed, cancelled, disposed
}

/// A sampled scalar, owned explicitly by a scope or caller. All writes occur on the main actor.
@MainActor public final class JoltMotionValue: ObservableObject, JoltResource {
  @Published public private(set) var value: Double
  @Published public private(set) var target: Double
  @Published public private(set) var velocity: Double = 0
  @Published public private(set) var state: JoltPlaybackState = .idle
  public private(set) var disposed = false
  public private(set) var paused = false
  public private(set) var suspended = false
  public let clock: JoltClock
  private enum Trajectory {
    case scalar(JoltScalarMotion)
    case decay(JoltDecayMotion)
    func sample(at time: Double) -> JoltScalarSample {
      switch self {
      case .scalar(let motion): motion.sample(at: time)
      case .decay(let motion): motion.sample(at: time)
      }
    }
  }
  private var motion: Trajectory?
  private var elapsed = 0.0
  private var started = 0.0
  private var subscription: ClockSubscription?
  private var observers: [UUID: @MainActor (Double) -> Void] = [:]
  private var finishers: [UUID: @MainActor (Bool) -> Void] = [:]
  private var scalarObservers: [UUID: @MainActor () -> Void] = [:]
  func observeScalar(_ callback: @escaping @MainActor () -> Void) -> JoltObservation {
    let id=UUID(); scalarObservers[id]=callback
    return JoltObservation { [weak self] in self?.scalarObservers.removeValue(forKey: id) }
  }
  private func scalarChanged() {
    for (id, callback) in Array(scalarObservers) where scalarObservers[id] != nil { callback() }
  }
  private var generation = 0
  private(set) var lease: UUID?
  private var leaseLost: (@MainActor () -> Void)?
  public init(_ initial: Double, clock: JoltClock = .shared) throws {
    guard initial.isFinite, Swift.abs(initial) <= 1e12 else { throw JoltError.invalidMotion }
    value = initial
    target = initial
    self.clock = clock
  }
  /// Jump cancels the previous motion. Invalid input leaves it running.
  public func set(_ next: Double) throws {
    defer { scalarChanged() }
    guard !disposed else { throw JoltError.disposed }
    guard next.isFinite, Swift.abs(next) <= 1e12 else { throw JoltError.invalidMotion }
    let callbacks = detachMotion()
    generation += 1
    let lost = dropLease()
    target = next
    velocity = 0
    state = .idle
    publish(next)
    for callback in callbacks { callback(false) }
    lost?()
  }
  /// Replacement springs inherit sampled velocity. Completion reports false on cancellation/replacement.
  public func animate(
    to next: Double, transition: JoltTransition = .spring(.smooth),
    velocity initialVelocity: Double? = nil, reducedMotion: Bool = false,
    completion: (@MainActor (Bool) -> Void)? = nil
  ) throws {
    guard !disposed else { throw JoltError.disposed }
    let sample = currentSample()
    let candidate = try JoltScalarMotion(
      from: sample?.position ?? value, to: next,
      velocity: initialVelocity ?? sample?.velocity ?? velocity,
      transition: transition)
    let oldFinishers = detachMotion()
    generation += 1
    let lost = dropLease()
    let epoch = generation
    motion = .scalar(candidate)
    elapsed = 0
    started = clock.now
    target = next
    if let completion { finishers[UUID()] = completion }
    for callback in oldFinishers { callback(false) }
    lost?()
    guard !disposed, generation == epoch else { return }
    if let sample {
      velocity = sample.velocity
      publish(sample.position)
    }
    guard !disposed, generation == epoch else { return }
    if reducedMotion || clock.reducedMotion || candidate.duration == 0 {
      settle()
    } else {
      start()
    }
  }
  /// Finite exponential release, clamped at the first bound. Invalid parameters preserve current motion.
  public func decay(
    velocity initialVelocity: Double, friction: Double = 0.998, bounds: ClosedRange<Double>? = nil,
    reducedMotion: Bool = false, completion: (@MainActor (Bool) -> Void)? = nil
  ) throws {
    guard !disposed else { throw JoltError.disposed }
    let sample = currentSample()
    let candidate = try JoltDecayMotion(
      from: sample?.position ?? value, velocity: initialVelocity, friction: friction, bounds: bounds
    )
    let old = detachMotion()
    generation += 1
    let lost = dropLease()
    let epoch = generation
    motion = .decay(candidate)
    elapsed = 0
    started = clock.now
    target = candidate.to
    if let completion { finishers[UUID()] = completion }
    for callback in old { callback(false) }
    lost?()
    guard !disposed, generation == epoch else { return }
    if let sample {
      velocity = sample.velocity
      publish(sample.position)
    }
    guard !disposed, generation == epoch else { return }
    if reducedMotion || clock.reducedMotion || candidate.duration == 0 { settle() } else { start() }
  }
  public func cancel() {
    defer { scalarChanged() }
    guard !disposed else { return }
    let sample = currentSample()
    let callbacks = detachMotion()
    generation += 1
    let lost = dropLease()
    velocity = 0
    state = .cancelled
    if let sample { publish(sample.position) }
    for callback in callbacks { callback(false) }
    lost?()
  }
  public func pause() {
    defer { scalarChanged() }
    guard !disposed, !paused else { return }
    freeze()
    paused = true
    updateState()
  }
  public func play() {
    defer { scalarChanged() }
    guard !disposed else { return }
    paused = false
    start()
  }
  public func suspend() {
    defer { scalarChanged() }
    guard !disposed, !suspended else { return }
    freeze()
    suspended = true
    updateState()
  }
  public func resume() {
    defer { scalarChanged() }
    guard !disposed else { return }
    suspended = false
    start()
  }
  public func dispose() {
    defer { scalarChanged() }
    guard !disposed else { return }
    let callbacks = detachMotion()
    generation += 1
    let lost = dropLease()
    disposed = true
    velocity = 0
    state = .disposed
    observers.removeAll()
    scalarChanged()
    scalarObservers.removeAll()
    for callback in callbacks { callback(false) }
    lost?()
  }
  /// A scoped spring follower. The returned resource owns the subscription, not the borrowed source/value.
  public func follow(_ source: JoltMotionValue, transition: JoltTransition = .spring(.smooth))
    throws -> JoltValueFollower
  {
    guard !disposed, !source.disposed, source !== self else { throw JoltError.invalidMotion }
    return try JoltValueFollower(source: source, destination: self, transition: transition)
  }
  @discardableResult public func subscribe(_ callback: @escaping @MainActor (Double) -> Void) throws
    -> JoltObservation
  {
    guard !disposed else { throw JoltError.disposed }
    let id = UUID()
    observers[id] = callback
    return JoltObservation { [weak self] in self?.observers.removeValue(forKey: id) }
  }
  func claim(_ owner: UUID, lost: (@MainActor () -> Void)? = nil) {
    let epoch = generation
    cancel()
    // A cancellation callback can synchronously install a newer owner.
    if !disposed, generation == epoch + 1, motion == nil {
      lease = owner
      leaseLost = lost
    }
  }
  func sample(_ sample: JoltScalarSample, target next: Double, owner: UUID) {
    defer { scalarChanged() }
    guard !disposed, lease == owner else { return }
    if target != next { target = next }
    if velocity != sample.velocity { velocity = sample.velocity }
    let nextState: JoltPlaybackState = sample.completed ? .completed : .running
    if state != nextState { state = nextState }
    publish(sample.position)
  }
  func markLeasePaused(_ owner: UUID, suspended: Bool) {
    defer { scalarChanged() }
    guard lease == owner else { return }
    velocity = 0
    state = suspended ? .suspended : .paused
  }
  func relinquish(_ owner: UUID, cancelled: Bool) {
    defer { scalarChanged() }
    guard lease == owner else { return }
    lease = nil
    leaseLost = nil
    velocity = 0
    state = cancelled ? .cancelled : .completed
  }
  private func dropLease() -> (@MainActor () -> Void)? {
    let lost = lease == nil ? nil : leaseLost
    lease = nil
    leaseLost = nil
    return lost
  }
  private func publish(_ next: Double) {
    guard value != next else { return }
    value = next
    for (id, callback) in Array(observers) where observers[id] != nil { callback(next) }
  }
  private func currentSample() -> JoltScalarSample? {
    motion?.sample(at: elapsed + (subscription == nil ? 0 : Swift.max(0, clock.now - started)))
  }
  private func detachMotion() -> [@MainActor (Bool) -> Void] {
    subscription?.cancel()
    subscription = nil
    motion = nil
    let callbacks = Array(finishers.values)
    finishers.removeAll()
    return callbacks
  }
  private func settle() {
    defer { scalarChanged() }
    let final = target
    let callbacks = detachMotion()
    generation += 1
    velocity = 0
    state = .completed
    publish(final)
    for callback in callbacks { callback(true) }
  }
  private func freeze() {
    if let subscription {
      let time = Swift.max(0, clock.now - started)
      elapsed += time
      subscription.cancel()
      self.subscription = nil
      if let sample = motion?.sample(at: elapsed) {
        velocity = sample.velocity
        publish(sample.position)
      }
    }
  }
  private func updateState() {
    if motion != nil { state = suspended ? .suspended : paused ? .paused : .running }
  }
  private func start() {
    guard !disposed, motion != nil else { return }
    updateState()
    guard !paused, !suspended, subscription == nil else { return }
    started = clock.now
    subscription = clock.subscribe { [weak self] now in
      guard let self, let motion = self.motion else { return }
      if self.clock.reducedMotion {
        self.settle()
        return
      }
      let sample = motion.sample(at: self.elapsed + Swift.max(0, now - self.started))
      if sample.completed {
        self.settle()
      } else {
        self.velocity = sample.velocity
        self.publish(sample.position)
        self.scalarChanged()
      }
    }
  }
}

@MainActor public final class JoltObservation {
  private var cleanup: (@MainActor () -> Void)?
  init(_ cleanup: @escaping @MainActor () -> Void) { self.cleanup = cleanup }
  public func dispose() {
    let callback = cleanup
    cleanup = nil
    callback?()
  }
  deinit {
    let callback = cleanup
    Task { @MainActor in callback?() }
  }
}

@MainActor public final class JoltValueFollower: JoltResource {
  public private(set) var disposed = false
  private weak var source: JoltMotionValue?
  private weak var destination: JoltMotionValue?
  private let transition: JoltTransition
  private var observation: JoltObservation?
  private var paused = false
  private var suspended = false
  init(source: JoltMotionValue, destination: JoltMotionValue, transition: JoltTransition) throws {
    self.source = source
    self.destination = destination
    self.transition = transition
    try destination.animate(to: source.value, transition: transition)
    observation = try source.subscribe { [weak self] value in
      guard let self, !self.disposed, !self.paused, !self.suspended else { return }
      try? self.destination?.animate(to: value, transition: self.transition)
    }
  }
  public func pause() { paused = true }
  public func play() {
    paused = false
    catchUp()
  }
  public func suspend() { suspended = true }
  public func resume() {
    suspended = false
    catchUp()
  }
  private func catchUp() {
    guard !disposed, !paused, !suspended, let source else { return }
    try? destination?.animate(to: source.value, transition: transition)
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    observation?.dispose()
    observation = nil
  }
}

public enum JoltValueProperty: String, CaseIterable, Sendable {
  case x, y, scale, scaleX, scaleY, rotate, rotateX, rotateY, opacity
}
extension JoltValueProperty {
  var tilts: Bool { self == .rotateX || self == .rotateY }
  func channels(_ scalar: Double) -> JoltDepthChannels {
    .init(
      x: self == .x ? scalar : 0, y: self == .y ? scalar : 0,
      scaleX: self == .scale || self == .scaleX ? scalar : 1,
      scaleY: self == .scale || self == .scaleY ? scalar : 1, rotate: self == .rotate ? scalar : 0,
      rotateX: self == .rotateX ? scalar : 0, rotateY: self == .rotateY ? scalar : 0)
  }
}
private struct ValueModifier: ViewModifier {
  @ObservedObject var value: JoltMotionValue
  let property: JoltValueProperty
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  private var scalar: Double {
    (reduced || appReduced) && property != .opacity ? value.target : value.value
  }
  func body(content: Content) -> some View {
    content
      .modifier(
        JoltDepthModifier(
          channels: property == .opacity ? .init() : property.channels(scalar),
          consumes: property.tilts)
      )
      .opacity(property == .opacity ? Swift.min(1, Swift.max(0, scalar)) : 1)
      .transaction { $0.animation = nil }
  }
}
extension View {
  /// Bind a sampled value without applying a second implicit interpolation. Scope owns its lifecycle.
  /// rotateX/rotateY project under the nearest `joltPerspective`; bind both axes with one call.
  public func joltBind(_ property: JoltValueProperty, to value: JoltMotionValue) -> some View {
    modifier(ValueModifier(value: value, property: property))
  }
}
