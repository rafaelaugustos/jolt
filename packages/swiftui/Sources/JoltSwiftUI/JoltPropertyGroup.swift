import JoltCore
import SwiftUI

/// Coordinates borrowed scalar properties on one timeline. The group never destroys the values.
@MainActor public final class JoltPropertyGroup: ObservableObject, JoltResource {
  public let values: [String: JoltMotionValue]
  @Published public private(set) var state: JoltPlaybackState = .idle
  public private(set) var disposed = false
  private var timeline: JoltTimeline?
  private var paused = false, suspended = false
  private var generation = 0
  public let clock: JoltClock
  public init(_ values: [String: JoltMotionValue], clock: JoltClock = .shared) throws {
    guard (1...1024).contains(values.count),
      values.keys.allSatisfy({ !$0.isEmpty && $0.count <= 128 }),
      values.values.allSatisfy({ !$0.disposed && $0.clock === clock }),
      Set(values.values.map(ObjectIdentifier.init)).count == values.count
    else { throw JoltError.invalidMotion }
    self.values = values
    self.clock = clock
  }
  public func validate(_ targets: [String: Double]) throws {
    guard !disposed, !targets.isEmpty,
      targets.allSatisfy({
        values[$0.key] != nil && values[$0.key]?.disposed == false && $0.value.isFinite
          && abs($0.value) <= 1e12
      })
    else { throw JoltError.invalidMotion }
  }
  public func animate(
    to targets: [String: Double], transition: JoltTransition = .spring(.smooth),
    reducedMotion: Bool = false, completion: (@MainActor (Bool) -> Void)? = nil
  ) throws {
    try validate(targets)
    let epoch = generation + 1
    let next = try JoltTimeline(
      tracks: targets.keys.sorted().map {
        .init(values[$0]!, to: targets[$0]!, transition: transition)
      }, clock: clock, reducedMotion: reducedMotion, autoplay: false
    ) { [weak self] completed in
      if let self, self.generation == epoch, !self.disposed {
        self.state = completed ? .completed : .cancelled
      }
      completion?(completed)
    }
    generation = epoch
    let old = timeline
    timeline = next
    old?.dispose()
    guard generation == epoch, !disposed else {
      next.dispose()
      return
    }
    if paused { next.pause() }
    if suspended { next.suspend() }
    state = suspended ? .suspended : paused ? .paused : .running
    if !paused { next.play() }
  }
  public func cancel() {
    let epoch = generation
    timeline?.cancel()
    if !disposed && generation == epoch { state = .cancelled }
  }
  public func pause() {
    guard !disposed else { return }
    paused = true
    timeline?.pause()
    state = .paused
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    timeline?.play()
    state = timeline?.state ?? .idle
  }
  public func suspend() {
    guard !disposed else { return }
    suspended = true
    timeline?.suspend()
    state = .suspended
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    timeline?.resume()
    state = timeline?.state ?? .idle
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    generation += 1
    timeline?.dispose()
    timeline = nil
    state = .disposed
  }
}

/// Named finite targets, validated before adoption. Explicit transition changes replace from sampled values.
@MainActor public final class JoltMotionStates: ObservableObject, JoltResource {
  public let group: JoltPropertyGroup
  public let definitions: [String: [String: Double]]
  @Published public private(set) var current: String?
  public private(set) var disposed = false
  public init(group: JoltPropertyGroup, states: [String: [String: Double]]) throws {
    guard !states.isEmpty, states.count <= 1024,
      states.keys.allSatisfy({ !$0.isEmpty && $0.count <= 128 })
    else { throw JoltError.invalidMotion }
    for targets in states.values { try group.validate(targets) }
    self.group = group
    self.definitions = states
  }
  public func set(
    _ name: String, transition: JoltTransition = .spring(.smooth), reducedMotion: Bool = false
  ) throws {
    guard !disposed, let targets = definitions[name] else { throw JoltError.invalidMotion }
    try group.animate(to: targets, transition: transition, reducedMotion: reducedMotion)
    current = name
  }
  public func pause() { group.pause() }
  public func play() { if !disposed { group.play() } }
  public func suspend() { group.suspend() }
  public func resume() { if !disposed { group.resume() } }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    group.cancel()
  }
}
