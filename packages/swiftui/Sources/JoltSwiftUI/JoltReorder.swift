import JoltCore
import SwiftUI

/// Owns a bounded order of stable IDs. Preview does not commit application order until release.
@MainActor public final class JoltReorderModel: ObservableObject, JoltResource {
  @Published public private(set) var keys: [String]
  @Published public private(set) var active: String?
  @Published public private(set) var destination: Int?
  public private(set) var disposed = false
  public let rowHeight: Double, spacing: Double
  public let measuresRows: Bool
  @Published private var measuredHeights: [String: Double] = [:]
  private var dragGeometry: JoltReorderGeometry?
  private var grabOffset = 0.0
  public func height(for key: String) -> Double {
    measuresRows ? measuredHeights[key] ?? rowHeight : rowHeight
  }
  public func updateMeasurements(_ heights: [String: Double]) throws {
    guard !disposed else { throw JoltError.disposed }
    let known = Set(keys)
    guard heights.count <= 1000, heights.keys.allSatisfy(known.contains),
      heights.values.allSatisfy({ $0.isFinite && $0 >= 24 && $0 <= 10000 })
    else { throw JoltError.invalidMotion }
    guard measuresRows else { return }
    guard heights.contains(where: { abs((measuredHeights[$0.key] ?? rowHeight) - $0.value) > 0.5 })
    else { return }
    cancel()
    measuredHeights.merge(heights) { _, next in next }
  }
  public func index(at offset: Double, inPreview: Bool = false) -> Int? {
    try? JoltReorderGeometry(
      heights: (inPreview ? preview : keys).map { height(for: $0) }, spacing: spacing
    ).index(at: offset)
  }
  private let clock: JoltClock
  private let onMove: @MainActor (JoltReorderMove) -> Void
  private var paused = false, suspended = false
  private var edgeSubscription: ClockSubscription?
  private var edgeDirection = 0, lastEdge = 0.0
  var edgeScroll: (@MainActor (Int) -> Bool)?
  public var stride: Double { rowHeight + spacing }
  public var preview: [String] {
    guard let active, let from = keys.firstIndex(of: active), let to = destination else {
      return keys
    }
    var copy = keys
    copy.remove(at: from)
    copy.insert(active, at: to)
    return copy
  }
  public init(
    _ keys: [String], rowHeight: Double = 64, spacing: Double = 8, measuresRows: Bool = false,
    clock: JoltClock = .shared, onMove: @escaping @MainActor (JoltReorderMove) -> Void = { _ in }
  ) throws {
    try Self.validate(keys)
    guard rowHeight.isFinite, (24...500).contains(rowHeight), spacing.isFinite,
      (0...100).contains(spacing)
    else { throw JoltError.invalidMotion }
    self.keys = keys
    self.measuresRows = measuresRows
    self.rowHeight = rowHeight
    self.spacing = spacing
    self.clock = clock
    self.onMove = onMove
  }
  private static func validate(_ keys: [String]) throws {
    guard keys.count <= 1000, Set(keys).count == keys.count,
      keys.allSatisfy({ !$0.isEmpty && $0.count <= 128 })
    else { throw JoltError.invalidMotion }
  }
  public func replace(_ keys: [String]) throws {
    try Self.validate(keys)
    guard !disposed else { throw JoltError.disposed }
    cancel()
    self.keys = keys
    measuredHeights = measuredHeights.filter { keys.contains($0.key) }
  }
  public func begin(_ key: String, pointerY: Double? = nil, scrollOffset: Double = 0) {
    guard !disposed, !paused, !suspended, keys.contains(key) else { return }
    guard scrollOffset.isFinite, pointerY?.isFinite != false else { return }
    cancel()
    active = key
    destination = keys.firstIndex(of: key)
    if measuresRows, let from = destination,
      let geometry = try? JoltReorderGeometry(
        heights: keys.map { height(for: $0) }, spacing: spacing)
    {
      dragGeometry = geometry
      let center = geometry.starts[from] + geometry.heights[from] / 2
      grabOffset = pointerY.map { $0 + scrollOffset - center } ?? 0
    }
  }
  public func move(viewportY: Double, scrollOffset: Double, viewportHeight: Double) {
    guard active != nil, !disposed, !paused, !suspended,
      [viewportY, scrollOffset, viewportHeight].allSatisfy(\.isFinite), viewportHeight > 0
    else { return }
    if measuresRows, let active, let from = keys.firstIndex(of: active), let dragGeometry {
      destination = dragGeometry.destination(
        from: from, center: viewportY + scrollOffset - grabOffset)
    } else {
      destination = min(
        keys.count - 1,
        max(0, Int(min(Double(keys.count), max(0, (viewportY + scrollOffset) / stride)))))
    }
    let edge =
      viewportY < min(42, viewportHeight / 4)
      ? -1 : viewportY > viewportHeight - min(42, viewportHeight / 4) ? 1 : 0
    if edge != edgeDirection {
      stopEdge()
      edgeDirection = edge
    }
    guard edge != 0, edgeSubscription == nil, edgeScroll != nil else { return }
    lastEdge = clock.now
    edgeSubscription = clock.subscribe { [weak self] time in
      guard let self, self.active != nil, !self.paused, !self.suspended else { return }
      if time - self.lastEdge >= 120 {
        self.lastEdge = time
        if self.edgeScroll?(self.edgeDirection) != true { self.stopEdge() }
      }
    }
  }
  @discardableResult public func end() -> JoltReorderMove? {
    guard let active, let from = keys.firstIndex(of: active), let to = destination else {
      cancel()
      return nil
    }
    cancel()
    return commit(from: from, to: to)
  }
  @discardableResult public func move(_ key: String, to index: Int) -> JoltReorderMove? {
    guard !disposed, !paused, !suspended, let from = keys.firstIndex(of: key) else { return nil }
    cancel()
    return commit(from: from, to: index)
  }
  private func commit(from: Int, to: Int) -> JoltReorderMove? {
    guard !disposed, !paused, !suspended,
      let move = JoltReorderMove.resolve(keys, from: from, to: to)
    else { return nil }
    var next = keys
    let key = next.remove(at: from)
    next.insert(key, at: to)
    keys = next
    onMove(move)
    return move
  }
  private func stopEdge() {
    edgeSubscription?.cancel()
    edgeSubscription = nil
    edgeDirection = 0
  }
  public func cancel() {
    stopEdge()
    active = nil
    destination = nil
    dragGeometry = nil
    grabOffset = 0
  }
  public func pause() {
    paused = true
    cancel()
  }
  public func play() { if !disposed { paused = false } }
  public func suspend() {
    suspended = true
    cancel()
  }
  public func resume() { if !disposed { suspended = false } }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    cancel()
    edgeScroll = nil
  }
}

/// Realized vertical rows. Opt into measured heights on the model; only handles initiate reorder.
public struct JoltReorderList<Row: View>: View {
  @ObservedObject private var model: JoltReorderModel
  private let row: (String) -> Row
  @StateObject private var scroll = makeReorderScroll()
  @State private var coordinate = UUID()
  @State private var pointerY = 0.0
  @State private var edgeIndex = 0
  @State private var gestureKey: String?
  @GestureState private var dragging = false
  @JoltSceneActivity private var sceneActive
  @Environment(\.isEnabled) private var enabled
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  public init(_ model: JoltReorderModel, @ViewBuilder row: @escaping (String) -> Row) {
    self.model = model
    self.row = row
  }
  private func adjust(_ key: String, _ step: Int) {
    if let index = model.keys.firstIndex(of: key) { model.move(key, to: index + step) }
  }
  private func connectEdge(_ proxy: ScrollViewProxy, height: Double) {
    model.edgeScroll = { [weak model] direction in
      guard let model, model.active != nil else { return false }
      let visibleEdge =
        model.index(at: max(0, scroll.offset + (direction > 0 ? height : 0)), inPreview: true) ?? 0
      let next = min(
        model.keys.count - 1,
        max(
          0,
          direction > 0 ? max(edgeIndex + 1, visibleEdge) : min(edgeIndex - 1, visibleEdge)))
      guard model.keys.indices.contains(next), next != edgeIndex else { return false }
      edgeIndex = next
      proxy.scrollTo(model.preview[next], anchor: direction > 0 ? .bottom : .top)
      return true
    }
  }

  public var body: some View {
    GeometryReader { geometry in
      ScrollViewReader { proxy in
        JoltScrollView(progress: scroll) {
          VStack(spacing: model.spacing) {
            ForEach(model.preview, id: \.self) { key in
              HStack {
                row(key).frame(maxWidth: .infinity, alignment: .leading).fixedSize(
                  horizontal: false, vertical: model.measuresRows)
                Image(systemName: "line.3.horizontal").frame(
                  width: 44, height: model.measuresRows ? 44 : model.rowHeight
                )
                .contentShape(Rectangle()).accessibilityLabel("Move \(key)")
                .accessibilityIdentifier("jolt-reorder-handle-" + key)
                .highPriorityGesture(
                  DragGesture(minimumDistance: 4, coordinateSpace: .named(coordinate))
                    .updating($dragging) { _, state, _ in state = true }
                    .onChanged { event in
                      if gestureKey == nil {
                        gestureKey = key
                        model.begin(
                          key, pointerY: event.startLocation.y, scrollOffset: scroll.offset)
                        edgeIndex = model.keys.firstIndex(of: key) ?? 0
                      }
                      pointerY = event.location.y
                      model.move(
                        viewportY: pointerY, scrollOffset: scroll.offset,
                        viewportHeight: geometry.size.height)
                    }.onEnded { _ in
                      model.end()
                      gestureKey = nil
                    })
              }.modifier(ReorderRowSize(measured: model.measuresRows, fixed: model.rowHeight))
                .background {
                  if model.measuresRows {
                    GeometryReader { rowGeometry in
                      Color.clear.preference(
                        key: ReorderHeightsKey.self, value: [key: rowGeometry.size.height])
                    }
                  }
                }.background(
                  model.active == key ? Color.accentColor.opacity(0.15) : .clear
                )
                .accessibilityElement(children: .contain)
                .accessibilityValue(
                  "Position \((model.keys.firstIndex(of:key) ?? 0)+1) of \(model.keys.count)"
                )
                .accessibilityAction(named: Text("Move up")) { adjust(key, -1) }
                .accessibilityAction(named: Text("Move down")) { adjust(key, 1) }
                .modifier(ReorderKeyboard(up: { adjust(key, -1) }, down: { adjust(key, 1) }))
                .id(key)
            }
          }.onPreferenceChange(ReorderHeightsKey.self) { heights in
            try? model.updateMeasurements(heights.filter { model.keys.contains($0.key) })
          }.animation(reduced || appReduced ? nil : .easeOut(duration: 0.15), value: model.preview)
        }.coordinateSpace(name: coordinate)
          .onAppear {
            if sceneActive && enabled { model.resume() } else { model.suspend() }
            connectEdge(proxy, height: geometry.size.height)
          }
          .onChange(of: geometry.size) { _, next in
            model.cancel()
            connectEdge(proxy, height: next.height)
          }
          .onDisappear {
            model.suspend()
            model.edgeScroll = nil
          }
          .onChange(of: sceneActive) { _, next in
            if next && enabled { model.resume() } else { model.suspend() }
          }
          .onChange(of: enabled) { _, next in
            if next && sceneActive { model.resume() } else { model.suspend() }
          }
          .onChange(of: scroll.offset) { _, _ in
            model.move(
              viewportY: pointerY, scrollOffset: scroll.offset, viewportHeight: geometry.size.height
            )
          }
          .onChange(of: dragging) { _, next in
            if !next {
              if model.active != nil { model.cancel() }
              gestureKey = nil
            }
          }
      }
    }
    .modifier(JoltActivityProvider($sceneActive))
  }
}
private struct ReorderKeyboard: ViewModifier {
  let up: () -> Void, down: () -> Void
  func body(content: Content) -> some View {
    #if os(macOS)
      content.focusable().onMoveCommand { direction in
        if direction == .up { up() }
        if direction == .down { down() }
      }
    #else
      content
    #endif
  }
}

@MainActor private func makeReorderScroll() -> JoltScrollProgress { try! .init() }

private struct ReorderHeightsKey: PreferenceKey {
  static let defaultValue: [String: Double] = [:]
  static func reduce(value: inout [String: Double], nextValue: () -> [String: Double]) {
    value.merge(nextValue()) { _, next in next }
  }
}
private struct ReorderRowSize: ViewModifier {
  let measured: Bool
  let fixed: Double
  func body(content: Content) -> some View {
    if measured {
      content.frame(minHeight: 44, maxHeight: 10000).clipped()
    } else {
      content.frame(height: fixed)
    }
  }
}
