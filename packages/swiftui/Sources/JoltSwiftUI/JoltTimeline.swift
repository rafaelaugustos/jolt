import Combine
import Foundation
import JoltCore

@MainActor public struct JoltTimelineTrack {
  public let value: JoltMotionValue
  public let to: Double
  public let from: Double?
  public let at: Double
  public let transition: JoltTransition
  public init(
    _ value: JoltMotionValue, to: Double, from: Double? = nil, at milliseconds: Double = 0,
    transition: JoltTransition = .spring(.smooth)
  ) {
    self.value = value
    self.to = to
    self.from = from
    self.at = milliseconds
    self.transition = transition
  }
}
@MainActor public struct JoltTimelineCue {
  public let name: String
  public let at: Double
  public let perform: @MainActor (String) -> (any JoltResource)?
  public init(
    _ name: String, at milliseconds: Double,
    perform: @escaping @MainActor (String) -> (any JoltResource)?
  ) {
    self.name = name
    self.at = milliseconds
    self.perform = perform
  }
}

public enum JoltCueLatePolicy: Sendable { case skip, catchUp }

/// Finite coordinated playback. Tracks targeting the same value must not overlap.
/// Named cue adapters return an owned resource; cancellation disposes it and suppresses later cues.
@MainActor public final class JoltTimeline: ObservableObject, JoltResource {
  private struct Track {
    let value: JoltMotionValue
    let at: Double
    let motion: JoltScalarMotion
  }
  public let duration: Double
  public let clock: JoltClock
  @Published public private(set) var state: JoltPlaybackState = .idle
  @Published public private(set) var elapsed: Double = 0
  public private(set) var disposed = false
  public private(set) var paused = false
  public private(set) var suspended = false
  private let tracks: [Track]
  private let values: [JoltMotionValue]
  private let cues: [JoltTimelineCue]
  private let reducedMotion: Bool
  private let cueLatePolicy: JoltCueLatePolicy
  private let cueTolerance: Double
  private let identity = UUID()
  private var effects: [any JoltResource] = []
  private var frameObservers: [UUID: @MainActor () -> Void] = [:]
  func observeFrame(_ callback: @escaping @MainActor () -> Void) -> JoltObservation {
    let key = UUID()
    frameObservers[key] = callback
    return JoltObservation { [weak self] in self?.frameObservers.removeValue(forKey: key) }
  }
  private func notifyFrame() {
    for (key, callback) in Array(frameObservers) where frameObservers[key] != nil { callback() }
  }
  private var fired = Set<Int>()
  private var subscription: ClockSubscription?
  private var started = 0.0
  private var baseline = 0.0
  private var claimed = false
  private var completion: (@MainActor (Bool) -> Void)?
  public init(
    tracks: [JoltTimelineTrack], cues: [JoltTimelineCue] = [], clock: JoltClock = .shared,
    reducedMotion: Bool = false, autoplay: Bool = true, cueLatePolicy: JoltCueLatePolicy = .skip,
    cueTolerance: Double = 50, completion: (@MainActor (Bool) -> Void)? = nil
  ) throws {
    guard tracks.count <= 10_000, cues.count <= 1024, cueTolerance.isFinite, cueTolerance >= 0,
      Set(cues.map(\.name)).count == cues.count
    else { throw JoltError.invalidTimeline }
    var built: [Track] = []
    var endpoints: [ObjectIdentifier: (Double, Double)] = [:]
    var unique: [ObjectIdentifier: JoltMotionValue] = [:]
    var total = 0.0
    for item in tracks.enumerated().sorted(by: {
      $0.element.at == $1.element.at ? $0.offset < $1.offset : $0.element.at < $1.element.at
    }).map(\.element) {
      guard !item.value.disposed, item.value.clock === clock,
        item.at.isFinite, item.at >= 0, item.at <= 60_000
      else {
        throw JoltError.invalidTimeline
      }
      let key = ObjectIdentifier(item.value)
      let previous = endpoints[key]
      guard item.at >= (previous?.1 ?? 0) else { throw JoltError.invalidTimeline }
      let motion = try JoltScalarMotion(
        from: item.from ?? previous?.0 ?? item.value.value, to: item.to, transition: item.transition
      )
      let end = item.at + motion.duration
      guard end <= 60_000 else { throw JoltError.invalidTimeline }
      endpoints[key] = (item.to, end)
      unique[key] = item.value
      built.append(.init(value: item.value, at: item.at, motion: motion))
      total = max(total, end)
    }
    for cue in cues {
      guard !cue.name.isEmpty, cue.name.count <= 128, cue.at.isFinite, cue.at >= 0, cue.at <= 60_000
      else { throw JoltError.invalidTimeline }
      total = max(total, cue.at)
    }
    self.tracks = built
    self.values = Array(unique.values)
    self.cues = cues.enumerated().sorted { a, b in
      a.element.at == b.element.at ? a.offset < b.offset : a.element.at < b.element.at
    }.map(\.element)
    self.duration = total
    self.clock = clock
    self.reducedMotion = reducedMotion || clock.reducedMotion
    self.completion = completion
    self.cueLatePolicy = cueLatePolicy
    self.cueTolerance = cueTolerance
    if autoplay {
      play()
    } else {
      paused = true
      state = .paused
    }
  }
  /// Sequential stages use each solved duration, rather than guessed spring delays.
  public static func sequence(
    _ steps: [JoltTimelineTrack], gap: Double = 0, clock: JoltClock = .shared,
    reducedMotion: Bool = false
  ) throws -> JoltTimeline {
    guard gap.isFinite, gap >= 0 else { throw JoltError.invalidTimeline }
    var time = 0.0
    var endpoints: [ObjectIdentifier: Double] = [:]
    var tracks: [JoltTimelineTrack] = []
    for step in steps {
      let id = ObjectIdentifier(step.value)
      let motion = try JoltScalarMotion(
        from: step.from ?? endpoints[id] ?? step.value.value, to: step.to,
        transition: step.transition)
      tracks.append(
        .init(step.value, to: step.to, from: step.from, at: time, transition: step.transition))
      endpoints[id] = step.to
      time += motion.duration + gap
    }
    return try JoltTimeline(tracks: tracks, clock: clock, reducedMotion: reducedMotion)
  }
  public static func stagger(
    _ values: [JoltMotionValue], to: Double, interval: Double = 80,
    transition: JoltTransition = .spring(.smooth), clock: JoltClock = .shared,
    reducedMotion: Bool = false
  ) throws -> JoltTimeline {
    guard interval.isFinite, interval >= 0 else { throw JoltError.invalidTimeline }
    return try JoltTimeline(
      tracks: values.enumerated().map {
        .init($0.element, to: to, at: Double($0.offset) * interval, transition: transition)
      }, clock: clock, reducedMotion: reducedMotion)
  }
  public var progress: Double { duration == 0 ? (state == .completed ? 1 : 0) : elapsed / duration }
  /// Seek pauses playback and cleans active effects without firing cues. Forward playback rearms later cues.
  /// A completed timeline can be explicitly sought again; a cancelled/disposed timeline cannot.
  public func seek(to progress: Double) throws {
    guard !disposed, state != .cancelled, progress.isFinite, (0...1).contains(progress),
      values.allSatisfy({ !$0.disposed })
    else { throw JoltError.invalidTimeline }
    if claimed && state != .completed && !values.allSatisfy({ $0.lease == identity }) {
      throw JoltError.invalidTimeline
    }
    subscription?.cancel()
    subscription = nil
    paused = true
    state = suspended ? .suspended : .paused
    if !claimed || values.contains(where: { $0.lease != identity }) {
      claimed = true
      for value in values {
        value.claim(identity, lost: leaseLost)
        guard !disposed, state == .paused || state == .suspended else {
          throw JoltError.invalidTimeline
        }
      }
    }
    let old = effects
    effects.removeAll()
    for effect in old { effect.dispose() }
    guard !disposed, state == .paused || state == .suspended else {
      throw JoltError.invalidTimeline
    }
    elapsed = progress * duration
    baseline = elapsed
    fired = Set(cues.indices.filter { cues[$0].at <= elapsed })
    var latest: [ObjectIdentifier: Track] = [:]
    var first: [ObjectIdentifier: Track] = [:]
    for track in tracks {
      let id = ObjectIdentifier(track.value)
      if first[id] == nil { first[id] = track }
      if track.at <= elapsed { latest[id] = track }
    }
    for value in values {
      let id = ObjectIdentifier(value)
      let track = latest[id] ?? first[id]!
      let time = latest[id] == nil ? 0 : elapsed - track.at
      value.sample(track.motion.sample(at: time), target: track.motion.to, owner: identity)
      value.markLeasePaused(identity, suspended: suspended)
      guard !disposed, values.allSatisfy({ $0.lease == identity }),
        state == .paused || state == .suspended
      else { throw JoltError.invalidTimeline }
    }
    notifyFrame()
  }
  public func play() {
    guard !disposed, state != .completed, state != .cancelled else { return }
    paused = false
    start()
  }
  public func pause() {
    guard !disposed else { return }
    freeze()
    paused = true
    for value in values { value.markLeasePaused(identity, suspended: suspended) }
    for effect in effects { effect.pause() }
    updateState()
  }
  public func suspend() {
    guard !disposed else { return }
    freeze()
    suspended = true
    for value in values { value.markLeasePaused(identity, suspended: true) }
    for effect in effects { effect.suspend() }
    updateState()
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    for effect in effects { effect.resume() }
    start()
  }
  public func cancel() {
    guard !disposed, state != .cancelled else { return }
    finish(false)
  }
  public func dispose() {
    guard !disposed else { return }
    finish(false)
    disposed = true
    state = .disposed
  }
  private func start() {
    guard !disposed, state != .completed, state != .cancelled else { return }
    updateState()
    guard !paused, !suspended, subscription == nil else { return }
    if !claimed {
      claimed = true
      for value in values {
        value.claim(identity, lost: leaseLost)
        guard !disposed, state == .running else { return }
      }
    }
    for effect in effects { effect.play() }
    baseline = elapsed
    started = clock.now
    apply(reducedMotion ? duration : elapsed)
    guard state == .running else { return }
    subscription = clock.subscribe { [weak self] now in
      guard let self else { return }
      self.apply(self.baseline + max(0, now - self.started))
    }
  }
  private var leaseLost: @MainActor () -> Void {
    { [weak self] in
      guard let self, !self.disposed, self.state != .completed, self.state != .cancelled
      else { return }
      self.finish(false)
    }
  }
  private func updateState() {
    guard state != .completed, state != .cancelled else { return }
    state = suspended ? .suspended : paused ? .paused : .running
  }
  private func apply(_ milliseconds: Double) {
    guard !disposed, state == .running else { return }
    guard values.allSatisfy({ !$0.disposed && $0.lease == identity }) else {
      finish(false)
      return
    }
    let reduced = reducedMotion || clock.reducedMotion
    elapsed = reduced ? duration : min(duration, milliseconds)
    // Only the latest started track for each value writes; completed earlier tracks cannot rewind it.
    var latest: [ObjectIdentifier: Track] = [:]
    for track in tracks where track.at <= elapsed { latest[ObjectIdentifier(track.value)] = track }
    for track in latest.values {
      let sample = track.motion.sample(at: reduced ? track.motion.duration : elapsed - track.at)
      track.value.sample(sample, target: track.motion.to, owner: identity)
      guard state == .running else { return }
      guard values.allSatisfy({ !$0.disposed && $0.lease == identity }) else {
        finish(false)
        return
      }
    }
    notifyFrame()
    guard !disposed, state == .running else { return }
    for (index, cue) in cues.enumerated() where cue.at <= elapsed && !fired.contains(index) {
      fired.insert(index)
      if reduced || (cueLatePolicy == .skip && elapsed - cue.at > cueTolerance) { continue }
      if let resource = cue.perform(cue.name) {
        if state == .running && !disposed { effects.append(resource) } else { resource.dispose() }
      }
      guard state == .running, !disposed else { return }
    }
    if elapsed >= duration { finish(true) }
  }
  private func freeze() {
    guard subscription != nil else { return }
    apply(baseline + max(0, clock.now - started))
    subscription?.cancel()
    subscription = nil
  }
  private func finish(_ completed: Bool) {
    subscription?.cancel()
    subscription = nil
    let old = effects
    effects.removeAll()
    for value in values { value.relinquish(identity, cancelled: !completed) }
    let callback = completion
    completion = nil
    state = completed ? .completed : .cancelled
    for resource in old { resource.dispose() }
    callback?(completed)
  }
  deinit {
    let effects = effects
    let values = values
    let identity = identity
    Task { @MainActor in
      for resource in effects { resource.dispose() }
      for value in values { value.relinquish(identity, cancelled: true) }
    }
  }
}

/// Adapt an application-owned sound/haptic/effect with explicit playback and cleanup hooks.
@MainActor public final class JoltEffect: JoltResource {
  public private(set) var disposed = false
  private let onPause: @MainActor () -> Void
  private let onPlay: @MainActor () -> Void
  private var cleanup: (@MainActor () -> Void)?
  private var paused = false, suspended = false
  public init(
    pause: @escaping @MainActor () -> Void = {}, play: @escaping @MainActor () -> Void = {},
    dispose: @escaping @MainActor () -> Void
  ) {
    onPause = pause
    onPlay = play
    cleanup = dispose
  }
  public func pause() {
    guard !disposed, !paused else { return }
    paused = true
    onPause()
  }
  public func play() {
    guard !disposed, paused else { return }
    paused = false
    if !suspended { onPlay() }
  }
  public func suspend() {
    guard !disposed, !suspended else { return }
    suspended = true
    onPause()
  }
  public func resume() {
    guard !disposed, suspended else { return }
    suspended = false
    if !paused { onPlay() }
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    let callback = cleanup
    cleanup = nil
    callback?()
  }
  deinit {
    let callback = cleanup
    Task { @MainActor in callback?() }
  }
}
