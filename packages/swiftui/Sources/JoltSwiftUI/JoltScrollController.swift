import JoltCore
import SwiftUI

/// Programmatic vertical scrolling in points, sharing Jolt's motion clock and lifecycle.
@MainActor public final class JoltScrollController: ObservableObject, JoltResource {
  public let progress: JoltScrollProgress
  public let coordinateSpace = UUID()
  public private(set) var disposed = false
  @Published public private(set) var connected = false
  private let motion: JoltMotionValue
  private var observation: JoltObservation?
  private var connection: (owner: ObjectIdentifier, read: () -> (Double,Double), write: (Double) -> Void, layout: () -> Void)?
  private var paused = false, suspended = false
  private var generation = 0
  var revision: Int { generation }
  private var anchors: [AnyHashable: CGRect] = [:]
  var pinnedHeight = 0.0
  var appReducedMotion = false
  public init(clock: JoltClock = .shared) throws {
    progress=try JoltScrollProgress()
    motion=try JoltMotionValue(0, clock: clock)
    observation=try motion.subscribe { [weak self] value in
      guard let self, !self.disposed, !self.paused, !self.suspended else { return }
      self.connection?.write(value)
      self.refresh()
    }
  }
  @discardableResult func attach(owner: AnyObject, read: @escaping () -> (Double,Double), write: @escaping (Double) -> Void, layout: @escaping () -> Void) -> Bool {
    guard !disposed else { return false }
    let id=ObjectIdentifier(owner)
    if let connection, connection.owner != id { return false }
    connection=(id,read,write,layout)
    if !connected { connected=true }
    refresh()
    return true
  }
  func detach(owner: AnyObject) {
    guard connection?.owner == ObjectIdentifier(owner) else { return }
    cancel(); connection=nil; connected=false
  }
  func refresh() {
    guard !disposed, let connection else { return }
    let (offset,extent)=connection.read()
    progress.update(offset: offset, extent: extent)
  }
  func updateAnchors(_ anchors: [AnyHashable: CGRect]) { self.anchors=anchors }
  /// Returns false before the view is attached, while paused/suspended, or after disposal.
  @discardableResult public func scrollTo(_ offset: Double, animated: Bool = true, transition: JoltTransition = .spring(.smooth)) throws -> Bool {
    guard offset.isFinite else { throw JoltError.invalidMotion }
    guard !disposed, !paused, !suspended, let connection else { return false }
    generation += 1
    let (current,extent)=connection.read(), target=Swift.max(0,Swift.min(extent,offset))
    try motion.set(current)
    if !animated || appReducedMotion || motion.clock.reducedMotion {
      connection.write(target); refresh()
    } else { try motion.animate(to: target, transition: transition, reducedMotion: appReducedMotion) }
    return true
  }
  @discardableResult public func scrollToTop(animated: Bool = true) throws -> Bool { try scrollTo(0, animated: animated) }
  public func cancel() { generation += 1; motion.cancel() }
  /// Layout is allowed to commit before reading the platform's current content extent.
  public func remeasure() async {
    await layoutBoundary()
    guard !disposed else { return }
    connection?.layout(); refresh()
  }
  private func layoutBoundary() async {
    await withCheckedContinuation { continuation in
      DispatchQueue.main.async { DispatchQueue.main.async { continuation.resume() } }
    }
  }
  /// Mark realized rows with `joltScrollAnchor`. A removed anchor falls back to its previous index.
  @discardableResult public func preserveAnchor(_ change: @MainActor () async throws -> Void) async rethrows -> Bool {
    guard !disposed, !paused, !suspended, connection != nil else { return false }
    cancel()
    let epoch=generation, offset=progress.offset
    let rows=anchors.sorted { $0.value.minY < $1.value.minY }
    let index=rows.firstIndex { $0.value.maxY > offset+pinnedHeight }
    let saved=index.map { rows[$0] }
    try await change()
    await remeasure()
    guard !disposed, !paused, !suspended, generation == epoch, let connection else { return false }
    if let saved, let index {
      let updated=anchors.sorted { $0.value.minY < $1.value.minY }
      let next=anchors[saved.key] ?? (updated.isEmpty ? nil : updated[Swift.min(index,updated.count-1)].value)
      if let next {
        let (_,extent)=connection.read()
        connection.write(Swift.max(0,Swift.min(extent,offset+next.minY-saved.value.minY)))
        refresh()
      }
    }
    return true
  }
  public func pause() { paused=true; motion.pause(); progress.pause(); generation += 1 }
  public func play() { guard !disposed else { return }; paused=false; progress.play(); motion.play(); refresh() }
  public func suspend() { suspended=true; motion.suspend(); progress.suspend(); generation += 1 }
  public func resume() { guard !disposed else { return }; suspended=false; progress.resume(); motion.resume(); refresh() }
  public func dispose() {
    guard !disposed else { return }
    disposed=true; generation += 1
    observation?.dispose(); observation=nil; motion.dispose(); progress.dispose()
    connection=nil; anchors=[:]; connected=false
  }
}

private struct ScrollCoordinateSpace: EnvironmentKey { static let defaultValue: UUID? = nil }
extension EnvironmentValues {
  var joltScrollSpace: UUID? {
    get { self[ScrollCoordinateSpace.self] }
    set { self[ScrollCoordinateSpace.self]=newValue }
  }
}
struct ScrollAnchors: PreferenceKey {
  static var defaultValue: [AnyHashable:CGRect] { [:] }
  static func reduce(value: inout [AnyHashable:CGRect], nextValue: () -> [AnyHashable:CGRect]) { value.merge(nextValue(), uniquingKeysWith: { _,new in new }) }
}
private struct ScrollAnchor: ViewModifier {
  let id: AnyHashable
  @Environment(\.joltScrollSpace) private var space
  func body(content: Content) -> some View {
    content.background(GeometryReader { geometry in
      if let space { Color.clear.preference(key: ScrollAnchors.self, value: [id:geometry.frame(in: .named(space))]) }
    })
  }
}
extension View {
  /// Stable key and realized content bounds used by `preserveAnchor`; no fixed row height required.
  public func joltScrollAnchor<ID: Hashable>(_ id: ID) -> some View { modifier(ScrollAnchor(id: AnyHashable(id))) }
}
