import JoltCore
import SwiftUI

public typealias JoltSheetSnap = JoltCore.JoltSheetSnap
public typealias JoltSheetGeometry = JoltCore.JoltSheetGeometry

/// A finite, scoped panel. Heights and velocities use Apple points and points/second.
@MainActor public final class JoltSheetModel: ObservableObject, JoltResource {
  public let snaps: [JoltSheetSnap]
  public let dismissible: Bool
  public private(set) var geometry: JoltSheetGeometry?
  public private(set) var snapPoint: JoltSheetSnap?
  public private(set) var isOpen = false
  public private(set) var dragging = false
  public private(set) var disposed = false
  public private(set) var paused = false
  public private(set) var suspended = false
  public private(set) var position = 0.0
  public var visibleHeight: Double { max(0, (geometry?.height ?? 0) - position) }
  public var state: JoltPlaybackState { value.state }
  public var canExpand: Bool {
    guard let geometry, let snapPoint,
      let stop = geometry.stops.first(where: { $0.point == snapPoint })
    else { return false }
    return geometry.stops.contains { $0.height > stop.height + 0.5 }
  }
  public var canCollapse: Bool {
    guard let geometry, let snapPoint,
      let stop = geometry.stops.first(where: { $0.point == snapPoint })
    else { return false }
    return geometry.stops.contains { $0.height < stop.height - 0.5 }
  }
  private let value: JoltMotionValue
  private let transition: JoltTransition
  private let onChange: @MainActor (JoltSheetSnap?) -> Void
  private var observation: JoltObservation?
  private var origin = 0.0
  private var reduced = false
  private var updating = false
  private var revision = 0
  public init(
    snaps: [JoltSheetSnap], dismissible: Bool = true,
    transition: JoltTransition = .spring(.snappy), clock: JoltClock = .shared,
    onChange: @escaping @MainActor (JoltSheetSnap?) -> Void = { _ in }
  ) throws {
    try JoltSheetGeometry.validate(snaps)
    self.snaps = snaps
    self.dismissible = dismissible
    self.transition = transition
    self.onChange = onChange
    value = try JoltMotionValue(0, clock: clock)
    observation = try value.subscribe { [weak self] next in
      guard let self, !self.disposed else { return }
      self.position = self.clamp(next)
      if !self.updating { self.objectWillChange.send() }
    }
  }
  private func clamp(_ next: Double) -> Double {
    guard let geometry else { return next }
    return min(geometry.closedY, max(geometry.stops.lazy.map(\.y).min() ?? 0, next))
  }
  public func updateLayout(
    height: Double, contentHeight: Double, safeTop: Double = 0, safeBottom: Double = 0,
    keyboardOverlap: Double = 0, extendable: Bool = true
  ) throws {
    guard !disposed else { throw JoltError.disposed }
    let candidate = try JoltSheetGeometry(
      snaps, hostHeight: height, contentHeight: contentHeight,
      safeTop: safeTop, safeBottom: safeBottom, keyboardOverlap: keyboardOverlap,
      extendable: extendable)
    guard candidate != geometry else { return }
    let first = geometry == nil
    revision += 1
    updating = true
    dragging = false
    geometry = candidate
    if first || !isOpen { try value.set(candidate.closedY) } else { try value.set(clamp(position)) }
    position = clamp(value.value)
    if isOpen, let snapPoint, let stop = candidate.stops.first(where: { $0.point == snapPoint }) {
      try value.animate(to: stop.y, transition: transition, reducedMotion: reduced)
    }
    updating = false
    objectWillChange.send()
  }
  public func open(_ point: JoltSheetSnap? = nil) throws { try snapTo(point ?? snaps[0]) }
  public func snapTo(_ point: JoltSheetSnap) throws {
    guard !disposed else { throw JoltError.disposed }
    guard snaps.contains(point) else { throw JoltError.invalidMotion }
    try move(to: point, velocity: nil)
  }
  public func dismiss() {
    guard !disposed, dismissible else { return }
    try? move(to: nil, velocity: nil)
  }
  private func move(to point: JoltSheetSnap?, velocity: Double?) throws {
    revision += 1
    let epoch = revision
    updating = true
    dragging = false
    snapPoint = point
    isOpen = point != nil
    if let geometry {
      let target =
        point.flatMap { point in geometry.stops.first { $0.point == point }?.y } ?? geometry.closedY
      try value.animate(
        to: target, transition: transition, velocity: velocity, reducedMotion: reduced)
    }
    updating = false
    objectWillChange.send()
    if !disposed, revision == epoch { onChange(point) }
  }
  public func expand() {
    guard let geometry else { return }
    let height = geometry.stops.first { $0.point == snapPoint }?.height ?? 0
    if let next = geometry.stops.filter({ $0.height > height + 0.5 }).min(by: {
      $0.height < $1.height
    }) {
      try? snapTo(next.point)
    }
  }
  public func collapse() {
    guard let geometry else { return }
    let height = geometry.stops.first { $0.point == snapPoint }?.height ?? 0
    if let next = geometry.stops.filter({ $0.height < height - 0.5 }).max(by: {
      $0.height < $1.height
    }) {
      try? snapTo(next.point)
    }
  }
  @discardableResult public func beginDrag() -> Bool {
    guard !disposed, !paused, !suspended, isOpen, geometry != nil else { return false }
    revision += 1
    updating = true
    value.cancel()
    origin = clamp(value.value)
    position = origin
    dragging = true
    updating = false
    objectWillChange.send()
    return dragging && !disposed
  }
  public func drag(by translation: Double) {
    guard dragging, !disposed, !paused, !suspended, translation.isFinite else { return }
    try? value.set(clamp(origin + translation))
  }
  public func endDrag(velocity: Double = 0) {
    guard dragging, let geometry, !disposed else { return }
    guard velocity.isFinite else {
      cancel()
      return
    }
    let point = try? geometry.release(at: position, velocity: velocity, dismissible: dismissible)?
      .point
    try? move(to: point, velocity: max(-4000, min(4000, velocity)))
  }
  public func cancel() {
    guard !disposed else { return }
    revision += 1
    updating = true
    dragging = false
    value.cancel()
    updating = false
    objectWillChange.send()
  }
  public func setReducedMotion(_ next: Bool) {
    guard !disposed, reduced != next else { return }
    reduced = next
    if next, !dragging { try? value.set(value.target) }
  }
  public func pause() {
    guard !disposed else { return }
    paused = true
    dragging = false
    value.pause()
    objectWillChange.send()
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    value.play()
    objectWillChange.send()
  }
  public func suspend() {
    guard !disposed else { return }
    suspended = true
    dragging = false
    value.suspend()
    objectWillChange.send()
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    value.resume()
    objectWillChange.send()
  }
  public func dispose() {
    guard !disposed else { return }
    revision += 1
    disposed = true
    dragging = false
    isOpen = false
    snapPoint = nil
    observation?.dispose()
    observation = nil
    value.dispose()
    position = geometry?.closedY ?? 0
    objectWillChange.send()
  }
}
