import Combine
import JoltCore
import SwiftUI

/// Application renderer callbacks. Demand is separate from the renderer's own frame and scene policy.
@MainActor public final class JoltRenderAdapter {
  fileprivate var owner: UUID?
  fileprivate let change: @MainActor (Bool) -> Void, redraw: @MainActor () -> Void
  public init(change: @escaping @MainActor (Bool) -> Void, redraw: @escaping @MainActor () -> Void)
  {
    self.change = change
    self.redraw = redraw
  }
}
/// Subscription-driven demand aggregation; never installs a frame callback or owns borrowed playback.
@MainActor public final class JoltRenderActivity: ObservableObject, JoltResource {
  @Published public private(set) var active = false
  public private(set) var disposed = false
  public private(set) var suspended = false
  public var size: Int { entries.count }
  private let id = UUID()
  private let adapter: JoltRenderAdapter
  private weak var parent: JoltRenderActivity?
  private var children: [UUID: JoltRenderActivity] = [:]
  private var entries: [UUID: Bool] = [:]
  private var subscriptions: [UUID: [AnyCancellable]] = [:]
  private var frames: [UUID: JoltObservation] = [:]
  private var paused = false, notifying = false, dirty = false, drawPending = false
  public init(_ adapter: JoltRenderAdapter) throws {
    guard adapter.owner == nil else { throw JoltError.invalidMotion }
    self.adapter = adapter
    adapter.owner = id
  }
  private init(parent: JoltRenderActivity) {
    self.adapter = parent.adapter
    self.parent = parent
  }
  public func scope() throws -> JoltRenderActivity {
    guard !disposed, root.totalOwners < 1024 else { throw JoltError.invalidMotion }
    let child = JoltRenderActivity(parent: self)
    children[child.id] = child
    return child
  }
  private var root: JoltRenderActivity { parent?.root ?? self }
  private var totalOwners: Int { 1 + children.values.reduce(0) { $0 + $1.totalOwners } }
  private var totalEntries: Int {
    entries.count + children.values.reduce(0) { $0 + $1.totalEntries }
  }
  private func add(_ running: Bool) throws -> (UUID, JoltObservation) {
    guard !disposed, root.totalEntries < 4096 else { throw JoltError.invalidMotion }
    let key = UUID()
    entries[key] = running
    let observation = JoltObservation { [weak self] in
      guard let self else { return }
      self.subscriptions.removeValue(forKey: key)
      self.frames.removeValue(forKey: key)?.dispose()
      self.entries.removeValue(forKey: key)
      self.refresh(draw: true)
    }
    refresh(draw: true)
    return (key, observation)
  }
  public func hold() throws -> JoltObservation { try add(true).1 }
  public func track(_ value: JoltMotionValue) throws -> JoltObservation {
    guard !value.disposed else { throw JoltError.disposed }
    let (key, observation) = try add(value.state == .running)
    guard !disposed, entries[key] != nil else { return observation }
    frames[key] = try value.subscribe { [weak self] _ in self?.refresh(draw: true) }
    subscriptions[key] = [
      value.$state.dropFirst().sink { [weak self] state in
        guard let self, self.entries[key] != nil else { return }
        self.entries[key] = state == .running
        self.refresh(draw: true)
      }
    ]
    return observation
  }
  public func track(_ timeline: JoltTimeline) throws -> JoltObservation {
    guard !timeline.disposed else { throw JoltError.disposed }
    let (key, observation) = try add(timeline.state == .running)
    guard !disposed, entries[key] != nil else { return observation }
    frames[key] = timeline.observeFrame { [weak self] in self?.refresh(draw: true) }
    subscriptions[key] = [
      timeline.$state.dropFirst().sink { [weak self] state in
        guard let self, self.entries[key] != nil else { return }
        self.entries[key] = state == .running
        self.refresh(draw: true)
      }
    ]
    return observation
  }
  private func compute(blocked: Bool) -> Bool {
    let blocked = blocked || disposed || suspended || paused
    var demand = !blocked && entries.values.contains(true)
    for child in children.values { demand = child.compute(blocked: blocked) || demand }
    if active != demand { active = demand }
    return demand
  }
  private func refresh(draw: Bool) {
    if let parent {
      parent.refresh(draw: draw)
      return
    }
    dirty = true
    drawPending = drawPending || draw
    guard !notifying else { return }
    notifying = true
    defer { notifying = false }
    var attempts = 0
    while dirty && attempts < 100 {
      attempts += 1
      dirty = false
      let previous = active
      let redraw = drawPending
      drawPending = false
      let next = compute(blocked: false)
      if previous != next { adapter.change(next) }
      if redraw && !suspended && !paused { adapter.redraw() }
    }
    dirty = false
    drawPending = false
  }
  public func pause() {
    guard !disposed else { return }
    paused = true
    refresh(draw: true)
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    refresh(draw: true)
  }
  public func suspend() {
    guard !disposed else { return }
    suspended = true
    refresh(draw: true)
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    refresh(draw: true)
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    for child in Array(children.values) { child.dispose() }
    children.removeAll()
    entries.removeAll()
    subscriptions.removeAll()
    for frame in frames.values { frame.dispose() }
    frames.removeAll()
    refresh(draw: true)
    if let parent {
      parent.children.removeValue(forKey: id)
    } else if adapter.owner == id {
      adapter.owner = nil
    }
  }
  deinit {
    let adapter = adapter
    let id = id
    Task { @MainActor in
      if adapter.owner == id {
        adapter.owner = nil
        adapter.change(false)
        adapter.redraw()
      }
    }
  }
}
