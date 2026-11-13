import Combine
import Foundation
import QuartzCore

#if os(macOS)
  import AppKit
#else
  import UIKit
#endif

/// One demand-driven display link shared by live values/timelines. Manual clocks are for deterministic tests.
@MainActor public final class JoltClock: ObservableObject {
  public static let shared = JoltClock()
  public let manual: Bool
  // Internal deterministic test policy; production clocks always consult the system preference.
  var testingReducedMotion: Bool?
  var reducedMotion: Bool { testingReducedMotion ?? JoltAccessibility.reducedMotion }
  public private(set) var time: Double = 0
  @Published public private(set) var activeCount = 0
  private var callbacks: [UUID: @MainActor (Double) -> Void] = [:]
  private var deriving = false
  private var derived: [ObjectIdentifier: @MainActor () -> Void] = [:]
  func derive(_ owner: ObjectIdentifier, _ callback: @escaping @MainActor () -> Void) {
    if deriving { derived[owner]=callback } else { callback() }
  }
  private var proxy: ClockProxy?
  public init(manual: Bool = false) {
    self.manual = manual
    time = manual ? 0 : CACurrentMediaTime() * 1000
  }
  public func advance(by milliseconds: Double) throws {
    guard manual, milliseconds.isFinite, milliseconds >= 0 else { throw JoltError.invalidMotion }
    tick(time + milliseconds)
  }
  var now: Double { manual ? time : CACurrentMediaTime() * 1000 }
  func subscribe(_ callback: @escaping @MainActor (Double) -> Void) -> ClockSubscription {
    let id = UUID()
    callbacks[id] = callback
    activeCount = callbacks.count
    if !manual { connect() }
    return ClockSubscription(clock: self, id: id)
  }
  fileprivate func remove(_ id: UUID) {
    callbacks.removeValue(forKey: id)
    if activeCount != callbacks.count { activeCount = callbacks.count }
    if callbacks.isEmpty { disconnect() }
  }
  fileprivate func tick(_ timestamp: Double) {
    // Several displays can report the same vsync; time never moves backwards.
    guard timestamp > time || manual else { return }
    time = timestamp
    deriving=true
    // A callback may cancel another callback or subscribe replacement work.
    for (id, callback) in Array(callbacks) where callbacks[id] != nil { callback(timestamp) }
    while !derived.isEmpty {
      let pending=derived; derived.removeAll()
      for callback in pending.values { callback() }
    }
    deriving=false
  }
  #if os(macOS)
    private var links: [CGDirectDisplayID: CADisplayLink] = [:]
    /// One link per display that shows a visible Jolt window; none while every such window is
    /// hidden, minimized or covered. Before any Jolt view is hosted, the main display drives it.
    private func connect() {
      guard !callbacks.isEmpty else { return disconnect() }
      JoltWindows.shared.listen(self) { [weak self] in self?.connect() }
      let screens = NSScreen.screens
      let wanted =
        JoltWindows.shared.displays
        ?? [(NSScreen.main ?? screens.first)?.joltDisplay].compactMap { $0 }
      for (display, link) in links where !wanted.contains(display) {
        link.invalidate()
        links.removeValue(forKey: display)
      }
      let proxy = self.proxy ?? ClockProxy(self)
      self.proxy = proxy
      for display in wanted where links[display] == nil {
        guard let screen = screens.first(where: { $0.joltDisplay == display }) else { continue }
        let link = screen.displayLink(target: proxy, selector: #selector(ClockProxy.frame(_:)))
        link.add(to: .main, forMode: .common)
        links[display] = link
      }
    }
    private func disconnect() {
      JoltWindows.shared.stopListening(self)
      for link in links.values { link.invalidate() }
      links.removeAll()
      proxy = nil
    }
    var displayCount: Int { links.count }
  #else
    private var link: CADisplayLink?
    private func connect() {
      guard link == nil else { return }
      let proxy = ClockProxy(self)
      link = CADisplayLink(target: proxy, selector: #selector(ClockProxy.frame(_:)))
      self.proxy = proxy
      link?.add(to: .main, forMode: .common)
    }
    private func disconnect() {
      link?.invalidate()
      link = nil
      proxy = nil
    }
  #endif
}
@MainActor private final class ClockProxy: NSObject {
  weak var clock: JoltClock?
  init(_ clock: JoltClock) { self.clock = clock }
  @objc func frame(_ link: CADisplayLink) { clock?.tick(link.timestamp * 1000) }
}
@MainActor final class ClockSubscription {
  weak var clock: JoltClock?
  let id: UUID
  init(clock: JoltClock, id: UUID) {
    self.clock = clock
    self.id = id
  }
  func cancel() {
    clock?.remove(id)
    clock = nil
  }
  deinit {
    let clock = clock
    let id = id
    Task { @MainActor in clock?.remove(id) }
  }
}
