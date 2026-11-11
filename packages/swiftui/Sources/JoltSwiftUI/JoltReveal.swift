import JoltCore
import SwiftUI

/// A circular reveal and conceal for one surface. Origins are points in the view's local space
/// (top-left origin, the space a `.local` SpatialTapGesture reports). Only a fully revealed
/// surface is drawn unclipped, hit-testable and visible to accessibility; Jolt never moves focus.
@MainActor public final class JoltReveal: ObservableObject, JoltResource, JoltViewLinked {
  public enum Phase: String, Sendable { case revealed, revealing, concealing, concealed }
  @Published public private(set) var phase: Phase
  /// The clip while a reveal or conceal runs on a measured view; nil otherwise.
  @Published public private(set) var circle: JoltRevealCircle?
  @Published public private(set) var state: JoltPlaybackState = .idle
  public private(set) var disposed = false
  public private(set) var paused = false
  public private(set) var suspended = false
  public let clock: JoltClock
  /// True only when fully revealed: the surface receives hits and accessibility focus.
  public var interactive: Bool { phase == .revealed }
  let links = JoltViewLinks()
  private struct Run {
    let opening: Bool
    let origin: JoltPoint?
    let inherited: JoltRevealCircle?
    let motion: JoltScalarMotion
  }
  private var run: Run?
  private var chainStart: Phase
  private var finishers: [@MainActor (Bool) -> Void] = []
  private var width = 0.0, height = 0.0, measured = false
  private var elapsed = 0.0, started = 0.0
  private var subscription: ClockSubscription?
  private var generation = 0
  public init(revealed: Bool = true, clock: JoltClock = .shared) {
    let initial: Phase = revealed ? .revealed : .concealed
    phase = initial
    chainStart = initial
    self.clock = clock
  }
  /// Grows a circle from `origin` (default: the current circle's centre while interrupting,
  /// otherwise the view's centre) to the farthest corner, then removes the clip. Completion
  /// reports false when cancelled or replaced.
  public func reveal(
    from origin: JoltPoint? = nil, duration: Double = JoltEffects.revealDuration,
    reducedMotion: Bool = false, completion: (@MainActor (Bool) -> Void)? = nil
  ) throws {
    try start(true, origin, duration, reducedMotion, completion)
  }
  /// Shrinks the circle toward `origin` from the circle on screen, then hides the surface while
  /// keeping its layout space. Concealing a concealed surface completes at once.
  public func conceal(
    to origin: JoltPoint? = nil, duration: Double = JoltEffects.revealDuration,
    reducedMotion: Bool = false, completion: (@MainActor (Bool) -> Void)? = nil
  ) throws {
    try start(false, origin, duration, reducedMotion, completion)
  }
  /// Stops the running reveal or conceal and restores the phase from before its chain started.
  public func cancel() {
    guard !disposed else { return }
    settle(false)
  }
  private func start(
    _ opening: Bool, _ origin: JoltPoint?, _ duration: Double, _ reducedMotion: Bool,
    _ completion: (@MainActor (Bool) -> Void)?
  ) throws {
    guard !disposed else { throw JoltError.disposed }
    guard duration.isFinite, duration >= 0, duration <= JoltEffects.maximumDuration else {
      throw JoltError.invalidMotion
    }
    let motion = try JoltScalarMotion(
      from: 0, to: 1, transition: .tween(milliseconds: duration, ease: JoltEffects.revealEase))
    if !opening && run == nil && phase == .concealed {
      completion?(true)
      return
    }
    let inherited = run == nil ? nil : sample(currentTime)
    let old = finishers
    finishers = []
    if run == nil { chainStart = phase }
    subscription?.cancel()
    subscription = nil
    generation += 1
    let epoch = generation
    run = Run(opening: opening, origin: origin, inherited: inherited, motion: motion)
    elapsed = 0
    if let completion { finishers.append(completion) }
    phase = opening ? .revealing : .concealing
    circle = sample(0)
    for callback in old { callback(false) }
    guard !disposed, generation == epoch else { return }
    if reducedMotion || duration == 0 || clock.reducedMotion || links.reduced {
      settle(true)
    } else {
      reconcile()
    }
  }
  private var currentTime: Double {
    elapsed + (subscription == nil ? 0 : max(0, clock.now - started))
  }
  private func sample(_ time: Double) -> JoltRevealCircle? {
    guard let run, measured else { return nil }
    let x = run.origin?.x ?? run.inherited?.x ?? width / 2
    let y = run.origin?.y ?? run.inherited?.y ?? height / 2
    return try? JoltEffects.revealCircle(
      width: width, height: height, x: x, y: y, opening: run.opening, from: run.inherited,
      progress: run.motion.sample(at: time).position)
  }
  private func reconcile() {
    guard !disposed, run != nil else { return }
    let go = !paused && !suspended && links.shown
    if go, subscription == nil {
      started = clock.now
      subscription = clock.subscribe { [weak self] now in self?.tick(now) }
    } else if !go, subscription != nil {
      elapsed = currentTime
      subscription?.cancel()
      subscription = nil
    }
    let next: JoltPlaybackState =
      paused ? .paused : suspended || !links.shown ? .suspended : .running
    if state != next { state = next }
  }
  private func tick(_ now: Double) {
    guard let run, subscription != nil else { return }
    if clock.reducedMotion { return settle(true) }
    let time = elapsed + max(0, now - started)
    if run.motion.sample(at: time).completed { return settle(true) }
    let next = sample(time)
    if next != circle { circle = next }
  }
  private func settle(_ finished: Bool) {
    guard let run else { return }
    subscription?.cancel()
    subscription = nil
    self.run = nil
    generation += 1
    elapsed = 0
    phase = finished ? (run.opening ? .revealed : .concealed) : chainStart
    circle = nil
    state = finished ? .completed : .cancelled
    let callbacks = finishers
    finishers = []
    for callback in callbacks { callback(finished) }
  }
  func resize(width: Double, height: Double) {
    guard width.isFinite, height.isFinite, width >= 0, height >= 0 else { return }
    self.width = width
    self.height = height
    measured = true
    guard run != nil else { return }
    let next = sample(currentTime)
    if next != circle { circle = next }
  }
  func link(_ id: UUID, active: Bool, reduced: Bool) {
    guard !disposed else { return }
    links.set(id, active: active, reduced: reduced)
    if reduced, run != nil { return settle(true) }
    reconcile()
  }
  func unlink(_ id: UUID) {
    links.remove(id)
    reconcile()
  }
  public func pause() {
    guard !disposed, !paused else { return }
    paused = true
    reconcile()
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    reconcile()
  }
  public func suspend() {
    guard !disposed, !suspended else { return }
    suspended = true
    reconcile()
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    reconcile()
  }
  /// Cancels a running reveal or conceal (restoring its starting phase); later calls are ignored.
  public func dispose() {
    guard !disposed else { return }
    settle(false)
    disposed = true
    state = .disposed
  }
}

private struct RevealClip: Shape {
  let circle: JoltRevealCircle?
  let closed: Bool
  func path(in rect: CGRect) -> Path {
    if let circle {
      return Path(
        ellipseIn: CGRect(
          x: circle.x - circle.radius, y: circle.y - circle.radius, width: circle.radius * 2,
          height: circle.radius * 2))
    }
    if closed { return Path() }
    // An unbounded rectangle keeps the content's identity without clipping shadows or overflow.
    return Path(rect.insetBy(dx: -1_000_000, dy: -1_000_000))
  }
}

private struct RevealModifier: ViewModifier {
  @ObservedObject var reveal: JoltReveal
  func body(content: Content) -> some View {
    let phase = reveal.phase
    let interactive = phase == .revealed
    content
      .background {
        GeometryReader { geometry in
          Color.clear.onAppear {
            reveal.resize(width: geometry.size.width, height: geometry.size.height)
          }.onChange(of: geometry.size) { _, size in
            reveal.resize(width: size.width, height: size.height)
          }
        }
      }
      .animation(nil) {
        $0.clipShape(
          RevealClip(circle: reveal.circle, closed: reveal.circle == nil && phase == .revealing)
        ).opacity(phase == .concealed ? 0 : 1)
      }
      .allowsHitTesting(interactive)
      .accessibilityHidden(!interactive)
      .modifier(JoltLinkModifier(resource: reveal))
  }
}

extension View {
  /// Clips this view to the reveal's circle while it runs. When a reveal ends the clip is gone;
  /// when a conceal ends the view is transparent but keeps its layout space. Not hit-testable and
  /// hidden from accessibility unless fully revealed. Held while off screen or the scene is
  /// inactive; settles at once under reduced motion.
  public func joltReveal(_ reveal: JoltReveal) -> some View {
    modifier(RevealModifier(reveal: reveal))
  }
}
