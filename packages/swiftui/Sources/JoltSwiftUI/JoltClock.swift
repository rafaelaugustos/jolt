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
  public private(set) var time: Double = 0
  @Published public private(set) var activeCount = 0
  private var callbacks: [UUID: @MainActor (Double) -> Void] = [:]
  private var link: CADisplayLink?
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
    if !manual && link == nil {
      let proxy = ClockProxy(self)
      #if os(macOS)
        let display = NSScreen.main ?? NSScreen.screens.first
        link = display?.displayLink(target: proxy, selector: #selector(ClockProxy.frame(_:)))
      #else
        link = CADisplayLink(target: proxy, selector: #selector(ClockProxy.frame(_:)))
      #endif
      self.proxy = proxy
      link?.add(to: .main, forMode: .common)
    }
    return ClockSubscription(clock: self, id: id)
  }
  fileprivate func remove(_ id: UUID) {
    callbacks.removeValue(forKey: id)
    if activeCount != callbacks.count { activeCount = callbacks.count }
    if callbacks.isEmpty {
      link?.invalidate()
      link = nil
      proxy = nil
    }
  }
  fileprivate func tick(_ timestamp: Double) {
    time = timestamp
    // A callback may cancel another callback or subscribe replacement work.
    for (id, callback) in Array(callbacks) where callbacks[id] != nil { callback(timestamp) }
  }
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
