import JoltCore
import SwiftUI

@MainActor public struct JoltDropTarget {
  public let id: String, label: String, priority: Double
  /// Extra hit area outside the reported frame, per edge, in points.
  public let padding: JoltDropPadding
  public let accepts: @MainActor () -> Bool
  public init(
    _ id: String, label: String? = nil, priority: Double = 0, padding: JoltDropPadding = .zero,
    accepts: @escaping @MainActor () -> Bool = { true }
  ) {
    self.id = id
    self.label = label ?? id
    self.priority = priority
    self.padding = padding
    self.accepts = accepts
  }
}
public struct JoltDropEvent: Equatable, Sendable {
  public enum Method: Sendable { case drag, request }
  public let id: String, method: Method
}
@MainActor public final class JoltDropZones: ObservableObject, JoltResource {
  public let targets: [JoltDropTarget]
  public let overlap: Bool
  @Published public private(set) var hovered: String?
  @Published public private(set) var accepted: String?
  @Published public private(set) var dragging = false
  @Published public private(set) var offset = CGSize.zero
  @Published private(set) var handles = 0
  public private(set) var disposed = false
  private var paused = false, suspended = false, generation = 0
  private var frames: [String: JoltDropRect] = [:]
  private var source: JoltDropRect?
  private var start = CGSize.zero, translation = CGSize.zero
  private let x: JoltMotionValue, y: JoltMotionValue, group: JoltPropertyGroup
  private var observations: [JoltObservation] = []
  private var effect: (any JoltResource)?
  private let onDrop: @MainActor (JoltDropEvent) -> (any JoltResource)?
  private let onReject: @MainActor (JoltDropEvent?) -> Void
  public init(
    _ targets: [JoltDropTarget], overlap: Bool = false, clock: JoltClock = .shared,
    onReject: @escaping @MainActor (JoltDropEvent?) -> Void = { _ in },
    onDrop: @escaping @MainActor (JoltDropEvent) -> (any JoltResource)? = { _ in nil }
  ) throws {
    guard (1...64).contains(targets.count), Set(targets.map(\.id)).count == targets.count,
      targets.allSatisfy({ !$0.id.isEmpty && $0.id.count <= 64 && $0.priority.isFinite })
    else {
      throw JoltError.invalidMotion
    }
    self.targets = targets.enumerated().sorted {
      $0.element.priority == $1.element.priority
        ? $0.offset < $1.offset : $0.element.priority > $1.element.priority
    }.map(\.element)
    self.overlap = overlap
    self.onDrop = onDrop
    self.onReject = onReject
    x = try .init(0, clock: clock)
    y = try .init(0, clock: clock)
    group = try .init(["x": x, "y": y], clock: clock)
    observations = [
      try x.subscribe { [weak self] n in self?.offset.width = n },
      try y.subscribe { [weak self] n in self?.offset.height = n },
    ]
  }
  private var available: Bool { !disposed && !paused && !suspended && source != nil }
  /// The source's visual frame, including the current offset, in the targets' coordinate space.
  public func sourceBounds(_ rect: CGRect?) {
    layoutBounds(rect.map { $0.offsetBy(dx: -offset.width, dy: -offset.height) })
  }
  /// The source's layout frame without the drag offset. A change during a drag re-anchors it.
  func layoutBounds(_ rect: CGRect?) {
    guard !disposed else { return }
    let previous = source
    source = rect.flatMap {
      try? .init(x: $0.minX, y: $0.minY, width: $0.width, height: $0.height)
    }
    guard let source else {
      cancel()
      return
    }
    if dragging, let previous {
      let dx = source.x + source.width / 2 - previous.x - previous.width / 2
      let dy = source.y + source.height / 2 - previous.y - previous.height / 2
      if abs(dx) > 0.01 || abs(dy) > 0.01 {
        start.width -= dx
        start.height -= dy
        place()
      }
    }
    refresh()
  }
  func attachHandle() { handles += 1 }
  func detachHandle() { handles = max(0, handles - 1) }
  public func targetBounds(_ id: String, _ rect: CGRect?) throws {
    guard !disposed, targets.contains(where: { $0.id == id }) else { throw JoltError.invalidMotion }
    if let rect {
      frames[id] = try .init(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height)
    } else {
      frames.removeValue(forKey: id)
    }
    if accepted == id && frames[id] == nil { cancel() }
    refresh()
  }
  public func begin() {
    guard available else { return }
    generation += 1
    let epoch = generation
    clearEffect()
    guard generation == epoch, available else { return }
    group.cancel()
    start = offset
    translation = .zero
    dragging = true
    refresh()
  }
  public func move(_ translation: CGSize) {
    guard available, dragging, translation.width.isFinite, translation.height.isFinite else {
      return
    }
    self.translation = translation
    place()
    refresh()
  }
  private func place() {
    let px = start.width + translation.width
    let py = start.height + translation.height
    guard abs(px) <= 1e6, abs(py) <= 1e6 else { return }
    try? x.set(px)
    try? y.set(py)
  }
  public func refresh() {
    guard available, dragging, let source,
      let rect = try? JoltDropRect(
        x: source.x + offset.width, y: source.y + offset.height, width: source.width,
        height: source.height)
    else {
      hovered = nil
      return
    }
    hovered =
      targets.first { target in
        frames[target.id].map { rect.hits($0, overlap: overlap, padding: target.padding) } ?? false
      }?.id
  }
  @discardableResult public func end(reducedMotion: Bool = false) -> Bool {
    guard dragging else { return false }
    let id = hovered
    return commit(id, method: .drag, reducedMotion: reducedMotion)
  }
  @discardableResult public func request(_ id: String, reducedMotion: Bool = false) throws -> Bool {
    guard targets.contains(where: { $0.id == id }) else { throw JoltError.invalidMotion }
    guard available else { return false }
    generation += 1
    let epoch = generation
    clearEffect()
    guard generation == epoch, available else { return false }
    group.cancel()
    return commit(id, method: .request, reducedMotion: reducedMotion)
  }
  private func commit(_ id: String?, method: JoltDropEvent.Method, reducedMotion: Bool) -> Bool {
    let epoch = generation
    dragging = false
    hovered = nil
    guard available else { return false }
    let target = targets.first { $0.id == id && frames[$0.id] != nil }
    let detail = target.map { JoltDropEvent(id: $0.id, method: method) }
    let allowed = target?.accepts() ?? false
    guard generation == epoch, available else { return false }
    guard allowed, let target, frames[target.id] != nil, let detail else {
      onReject(detail)
      if generation == epoch, available {
        try? group.animate(to: ["x": 0, "y": 0], reducedMotion: reducedMotion)
      }
      return false
    }
    group.cancel()
    accepted = target.id
    let result = onDrop(detail)
    guard generation == epoch, available, frames[target.id] != nil else {
      result?.dispose()
      return false
    }
    effect = result
    return true
  }
  private func clearEffect() {
    let old = effect
    effect = nil
    accepted = nil
    old?.dispose()
  }
  public func cancel() {
    generation += 1
    dragging = false
    hovered = nil
    group.cancel()
    if !disposed {
      try? x.set(0)
      try? y.set(0)
    }
    clearEffect()
  }
  public func pause() {
    guard !disposed else { return }
    paused = true
    cancel()
  }
  public func play() { if !disposed { paused = false } }
  public func suspend() {
    guard !disposed else { return }
    suspended = true
    cancel()
  }
  public func resume() { if !disposed { suspended = false } }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    cancel()
    frames.removeAll()
    source = nil
    observations.forEach { $0.dispose() }
    observations.removeAll()
    group.dispose()
    x.dispose()
    y.dispose()
  }
  deinit {
    let effect = effect
    Task { @MainActor in effect?.dispose() }
  }
}
private struct DropGeometry: View {
  let update: @MainActor (CGRect?) -> Void
  var body: some View {
    GeometryReader { geometry in
      let rect = geometry.frame(in: .global)
      Color.clear.onAppear { update(rect) }.onChange(of: rect) { _, next in update(next) }
        .onDisappear { update(nil) }
    }.allowsHitTesting(false).accessibilityHidden(true)
  }
}
@MainActor private func dropDrag(
  _ model: JoltDropZones, active: GestureState<Bool>, reducedMotion: Bool
) -> some Gesture {
  DragGesture(minimumDistance: 3, coordinateSpace: .global).updating(active) { _, state, _ in
    state = true
  }
  .onChanged { event in
    if !model.dragging { model.begin() }
    model.move(event.translation)
  }
  .onEnded { _ in model.end(reducedMotion: reducedMotion) }
}
private struct DropActions: ViewModifier {
  @ObservedObject var model: JoltDropZones
  let shown: Bool, reducedMotion: Bool
  func body(content: Content) -> some View {
    content.accessibilityActions {
      if shown {
        ForEach(model.targets, id: \.id) { target in
          Button("Move to \(target.label)") {
            _ = try? model.request(target.id, reducedMotion: reducedMotion)
          }
        }
        Button("Return to origin") { model.cancel() }
      }
    }
  }
}
private struct DropSource: ViewModifier {
  @ObservedObject var model: JoltDropZones
  @JoltSceneActivity private var sceneActive
  @Environment(\.isEnabled) private var enabled
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  @GestureState private var active = false
  @State private var visible = false
  private func sync() {
    if visible && enabled && sceneActive { model.resume() } else { model.suspend() }
  }
  func body(content: Content) -> some View {
    // Measured outside the offset: the layout frame, so a change re-anchors the drag.
    content.offset(model.offset).background(DropGeometry(update: model.layoutBounds))
      .gesture(
        dropDrag(model, active: $active, reducedMotion: reduced || appReduced),
        including: model.handles > 0 ? .subviews : .all
      )
      .modifier(
        DropActions(model: model, shown: model.handles == 0, reducedMotion: reduced || appReduced)
      )
      .onAppear {
        visible = true
        sync()
      }.onDisappear {
        visible = false
        sync()
      }
      .onChange(of: sceneActive) { _, _ in sync() }.onChange(of: enabled) { _, _ in sync() }
      .onChange(of: active) { _, next in if !next && model.dragging { model.cancel() } }
      .modifier(JoltActivityProvider($sceneActive))
  }
}
private struct DropHandle: ViewModifier {
  @ObservedObject var model: JoltDropZones
  @JoltSceneActivity private var sceneActive
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  @GestureState private var active = false
  func body(content: Content) -> some View {
    content.contentShape(Rectangle())
      .highPriorityGesture(
        dropDrag(model, active: $active, reducedMotion: reduced || appReduced),
        including: sceneActive ? .all : .subviews
      )
      .modifier(DropActions(model: model, shown: true, reducedMotion: reduced || appReduced))
      .onAppear { model.attachHandle() }.onDisappear { model.detachHandle() }
      .onChange(of: active) { _, next in if !next && model.dragging { model.cancel() } }
      .modifier(JoltActivityProvider($sceneActive))
  }
}
extension View {
  public func joltDropSource(_ zones: JoltDropZones) -> some View {
    modifier(DropSource(model: zones))
  }
  /// Starts the drag from this view only. Apply it inside the `joltDropSource` view: the source
  /// still moves, and while a handle is on screen the rest of the source keeps its own gestures.
  public func joltDropHandle(_ zones: JoltDropZones) -> some View {
    modifier(DropHandle(model: zones))
  }
  public func joltDropTarget(_ id: String, in zones: JoltDropZones) -> some View {
    background(DropGeometry { rect in try? zones.targetBounds(id, rect) })
  }
}
