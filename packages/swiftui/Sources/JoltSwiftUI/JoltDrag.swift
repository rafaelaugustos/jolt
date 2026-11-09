import JoltCore
import SwiftUI

public struct JoltDragBounds: Equatable, Sendable {
  public let x: ClosedRange<Double>
  public let y: ClosedRange<Double>
  public init(x: ClosedRange<Double>, y: ClosedRange<Double>) throws {
    guard
      [x.lowerBound, x.upperBound, y.lowerBound, y.upperBound].allSatisfy({
        $0.isFinite && abs($0) <= 1e12
      })
    else { throw JoltError.invalidMotion }
    self.x = x
    self.y = y
  }
  func clamp(_ point: CGPoint) -> CGPoint {
    .init(
      x: min(x.upperBound, max(x.lowerBound, point.x)),
      y: min(y.upperBound, max(y.lowerBound, point.y)))
  }
}
public enum JoltDragRelease: Sendable {
  case snap
  case inertia(friction: Double = 0.998)
}

/// Direct manipulation uses points; spring settlement is sampled, so a new drag starts at the visible position.
@MainActor public final class JoltDragModel: ObservableObject, JoltResource {
  @Published public private(set) var position: CGPoint
  @Published public private(set) var dragging = false
  public private(set) var bounds: JoltDragBounds
  public private(set) var snaps: [CGPoint]
  public private(set) var disposed = false
  public private(set) var suspended = false
  private var paused = false
  private let x: JoltMotionValue, y: JoltMotionValue
  private var observations: [JoltObservation] = []
  private var origin = CGPoint.zero
  public let transition: JoltTransition
  public let release: JoltDragRelease
  public init(
    at position: CGPoint = .zero, bounds: JoltDragBounds, snaps: [CGPoint] = [],
    transition: JoltTransition = .spring(.snappy), release: JoltDragRelease = .snap,
    clock: JoltClock = .shared
  ) throws {
    guard position.x.isFinite, position.y.isFinite, snaps.count <= 10_000,
      snaps.allSatisfy({ $0.x.isFinite && $0.y.isFinite && bounds.clamp($0) == $0 })
    else { throw JoltError.invalidMotion }
    if case .inertia(let friction) = release {
      guard snaps.isEmpty, friction.isFinite, friction > 0, friction < 1 else {
        throw JoltError.invalidMotion
      }
    }
    self.release = release
    self.bounds = bounds
    self.snaps = snaps
    self.transition = transition
    let initial = bounds.clamp(position)
    self.position = initial
    x = try JoltMotionValue(initial.x, clock: clock)
    y = try JoltMotionValue(initial.y, clock: clock)
    observations = [
      try x.subscribe { [weak self] value in self?.position.x = value },
      try y.subscribe { [weak self] value in self?.position.y = value },
    ]
  }
  public func updateBounds(_ next: JoltDragBounds, snaps: [CGPoint]) throws {
    guard !disposed, snaps.count <= 10_000,
      snaps.allSatisfy({ $0.x.isFinite && $0.y.isFinite && next.clamp($0) == $0 })
    else { throw JoltError.invalidMotion }
    if case .inertia = release { guard snaps.isEmpty else { throw JoltError.invalidMotion } }
    self.bounds = next
    self.snaps = snaps
    dragging = false
    let point = next.clamp(position)
    try x.set(point.x)
    try y.set(point.y)
  }
  public func begin() {
    guard !disposed, !paused, !suspended else { return }
    x.cancel()
    y.cancel()
    origin = bounds.clamp(position)
    dragging = true
  }
  public func update(translation: CGSize) {
    guard dragging, !disposed, !suspended, translation.width.isFinite, translation.height.isFinite
    else { return }
    let point = bounds.clamp(
      .init(x: origin.x + translation.width, y: origin.y + translation.height))
    try? x.set(point.x)
    try? y.set(point.y)
  }
  public func end(cancelled: Bool = false, reducedMotion: Bool = false, velocity: CGSize = .zero) {
    guard dragging else { return }
    dragging = false
    guard !cancelled, !disposed, !paused, !suspended else { return }
    if case .inertia(let friction) = release {
      guard velocity.width.isFinite, velocity.height.isFinite else { return }
      try? x.decay(
        velocity: velocity.width, friction: friction, bounds: bounds.x, reducedMotion: reducedMotion
      )
      try? y.decay(
        velocity: velocity.height, friction: friction, bounds: bounds.y,
        reducedMotion: reducedMotion)
      return
    }
    let target =
      snaps.min {
        hypot($0.x - position.x, $0.y - position.y) < hypot($1.x - position.x, $1.y - position.y)
      } ?? bounds.clamp(position)
    move(to: target, reducedMotion: reducedMotion)
  }
  public func move(to point: CGPoint, reducedMotion: Bool = false) {
    guard !disposed, !paused, !suspended, point.x.isFinite, point.y.isFinite else { return }
    dragging = false
    let target = bounds.clamp(point)
    try? x.animate(to: target.x, transition: transition, reducedMotion: reducedMotion)
    try? y.animate(to: target.y, transition: transition, reducedMotion: reducedMotion)
  }
  public func adjust(forward: Bool, reducedMotion: Bool = false) {
    let choices = snaps.sorted { $0.x == $1.x ? $0.y < $1.y : $0.x < $1.x }
    if let nearest = choices.indices.min(by: {
      hypot(choices[$0].x - position.x, choices[$0].y - position.y)
        < hypot(choices[$1].x - position.x, choices[$1].y - position.y)
    }) {
      move(
        to: choices[min(choices.count - 1, max(0, nearest + (forward ? 1 : -1)))],
        reducedMotion: reducedMotion)
    } else {
      move(
        to: .init(x: position.x + (forward ? 10 : -10), y: position.y), reducedMotion: reducedMotion
      )
    }
  }
  public func pause() {
    paused = true
    dragging = false
    x.pause()
    y.pause()
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    x.play()
    y.play()
  }
  public func suspend() {
    suspended = true
    dragging = false
    x.suspend()
    y.suspend()
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    x.resume()
    y.resume()
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    dragging = false
    for observation in observations { observation.dispose() }
    observations.removeAll()
    x.dispose()
    y.dispose()
  }
}
private struct DragModifier: ViewModifier {
  @ObservedObject var model: JoltDragModel
  @Environment(\.scenePhase) private var phase
  @Environment(\.isEnabled) private var enabled
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  @GestureState private var gestureActive = false
  @State private var visible = false
  private func synchronize() {
    if visible && enabled && phase == .active { model.resume() } else { model.suspend() }
  }
  func body(content: Content) -> some View {
    content.offset(x: model.position.x, y: model.position.y).transaction { $0.animation = nil }
      .gesture(
        DragGesture(minimumDistance: 1, coordinateSpace: .global).updating($gestureActive) {
          _, state, _ in state = true
        }.onChanged { event in
          guard enabled, phase == .active else { return }
          if !model.dragging { model.begin() }
          model.update(translation: event.translation)
        }.onEnded { event in
          model.end(reducedMotion: reduced || appReduced, velocity: event.velocity)
        }
      )
      .accessibilityValue("\(Int(model.position.x)), \(Int(model.position.y))")
      .accessibilityAdjustableAction { direction in
        model.adjust(forward: direction == .increment, reducedMotion: reduced || appReduced)
      }
      .onChange(of: gestureActive) { _, active in if !active { model.end(cancelled: true) } }
      .onAppear {
        visible = true
        synchronize()
      }.onDisappear {
        visible = false
        synchronize()
      }
      .onChange(of: phase) { _, _ in synchronize() }.onChange(of: enabled) { _, _ in synchronize() }
  }
}
extension View {
  public func joltDrag(_ model: JoltDragModel) -> some View { modifier(DragModifier(model: model)) }
}
