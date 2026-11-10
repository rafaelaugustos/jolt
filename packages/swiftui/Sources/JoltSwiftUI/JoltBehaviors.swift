import JoltCore
import SwiftUI

public enum JoltBehaviorStatus: String, Sendable {
  case running, completed, interrupted, cancelled, blocked, failed
}
@MainActor public final class JoltBehaviorRun: ObservableObject {
  public let id: UUID, name: String
  @Published public fileprivate(set) var status: JoltBehaviorStatus
  fileprivate var cancelRun: (@MainActor () -> Void)?
  fileprivate init(name: String, status: JoltBehaviorStatus) {
    id = UUID()
    self.name = name
    self.status = status
  }
  public func cancel() { cancelRun?() }
  fileprivate func settle(_ status: JoltBehaviorStatus) {
    guard self.status == .running else { return }
    self.status = status
    cancelRun = nil
  }
}
/// A finite property behavior. Domain conditions stay in the application; no unbounded async task is created.
@MainActor public struct JoltBehavior {
  public let targets: [String: Double]
  public let priority: Double
  public let blocks: Set<String>
  public let replaceEqual: Bool
  public let transition: JoltTransition
  public let when: @MainActor () -> Bool
  public init(
    _ targets: [String: Double], priority: Double = 0, blocks: Set<String> = [],
    replaceEqual: Bool = false, transition: JoltTransition = .spring(.smooth),
    when: @escaping @MainActor () -> Bool = { true }
  ) {
    self.targets = targets
    self.priority = priority
    self.blocks = blocks
    self.replaceEqual = replaceEqual
    self.transition = transition
    self.when = when
  }
}
/// One exclusive behavior lane over a borrowed group. Higher priority interrupts unless explicitly blocked.
@MainActor public final class JoltBehaviors: ObservableObject, JoltResource {
  public let group: JoltPropertyGroup
  public let definitions: [String: JoltBehavior]
  public let rest: String?
  @Published public private(set) var current: JoltBehaviorRun?
  public private(set) var disposed = false
  private var changing = false, restorePending = false, paused = false, suspended = false
  private var reducedMotion = false
  public init(group: JoltPropertyGroup, definitions: [String: JoltBehavior], rest: String? = nil)
    throws
  {
    guard (1...1024).contains(definitions.count), rest == nil || definitions[rest!] != nil else {
      throw JoltError.invalidMotion
    }
    for (name, definition) in definitions {
      guard !name.isEmpty, name.count <= 128, definition.priority.isFinite,
        definition.blocks.allSatisfy({ definitions[$0] != nil })
      else { throw JoltError.invalidMotion }
      try group.validate(definition.targets)
    }
    self.group = group
    self.definitions = definitions
    self.rest = rest
  }
  public func can(_ name: String) -> Bool {
    guard !disposed, let next = definitions[name], next.when() else { return false }
    guard let current, current.status == .running, let active = definitions[current.name] else {
      return true
    }
    return !active.blocks.contains(name)
      && (next.priority > active.priority
        || (next.priority == active.priority && active.replaceEqual))
  }
  @discardableResult public func request(_ name: String, reducedMotion: Bool = false) throws
    -> JoltBehaviorRun
  {
    guard !disposed else { throw JoltError.disposed }
    guard let definition = definitions[name] else { throw JoltError.invalidMotion }
    guard !changing else { return .init(name: name, status: .blocked) }
    changing = true
    defer {
      changing = false
      restoreIfNeeded()
    }
    guard can(name) else { return .init(name: name, status: .blocked) }
    try group.validate(definition.targets)
    self.reducedMotion = reducedMotion
    restorePending = false
    current?.settle(.interrupted)
    let run = JoltBehaviorRun(name: name, status: .running)
    current = run
    run.cancelRun = { [weak self, weak run] in
      guard let self, let run, self.current === run else { return }
      self.cancel()
    }
    do {
      try group.animate(
        to: definition.targets, transition: definition.transition, reducedMotion: reducedMotion
      ) { [weak self, weak run] completed in
        guard let self, let run, self.current === run, run.status == .running else { return }
        run.settle(completed ? .completed : .cancelled)
        self.restorePending = run.name != self.rest
        self.restoreIfNeeded()
      }
    } catch {
      run.settle(.failed)
      restorePending = name != rest
      throw error
    }
    return run
  }
  public func cancel() {
    guard !disposed, !changing else { return }
    changing = true
    let name = current?.name
    current?.settle(.cancelled)
    group.cancel()
    restorePending = name != rest
    changing = false
    restoreIfNeeded()
  }
  /// Stops without restoring rest. A future request may start a new run.
  public func stop() {
    guard !disposed, !changing else { return }
    changing = true
    restorePending = false
    current?.settle(.cancelled)
    group.cancel()
    changing = false
  }
  private func restoreIfNeeded() {
    guard restorePending, !changing, !disposed, !paused, !suspended else { return }
    restorePending = false
    if let rest, definitions[rest]?.when() == true {
      _ = try? request(rest, reducedMotion: reducedMotion)
    }
  }
  public func pause() {
    guard !disposed else { return }
    paused = true
    group.pause()
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    group.play()
    restoreIfNeeded()
  }
  public func suspend() {
    guard !disposed else { return }
    suspended = true
    group.suspend()
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    group.resume()
    restoreIfNeeded()
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    restorePending = false
    current?.settle(.cancelled)
    group.cancel()
  }
}
