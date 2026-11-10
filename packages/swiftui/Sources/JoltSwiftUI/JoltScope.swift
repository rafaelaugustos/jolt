import JoltCore
import SwiftUI

@MainActor private final class WeakScope {
  weak var value: JoltScope?
  init(_ value: JoltScope) { self.value = value }
}
/// Retains resources independently of playback; suspension preserves each resource's manual pause.
@MainActor public final class JoltScope: ObservableObject, JoltResource {
  private static var owners: [ObjectIdentifier: WeakScope] = [:]
  @Published public private(set) var disposed = false
  @Published public private(set) var suspended = false
  @Published public private(set) var count = 0
  private var clearing = false
  private var resources: [ObjectIdentifier: any JoltResource] = [:]
  public init() {}
  @discardableResult public func retain<T: JoltResource>(_ resource: T) throws -> T {
    guard !disposed, !clearing, !resource.disposed else { throw JoltError.disposed }
    let key = ObjectIdentifier(resource)
    if let other = Self.owners[key]?.value, other !== self { throw JoltError.invalidMotion }
    resources[key] = resource
    Self.owners[key] = WeakScope(self)
    count = resources.count
    if suspended { resource.suspend() }
    return resource
  }
  public func release(_ resource: any JoltResource) {
    let key = ObjectIdentifier(resource)
    guard resources.removeValue(forKey: key) != nil else { return }
    Self.owners.removeValue(forKey: key)
    count = resources.count
    resource.dispose()
  }
  public func value(_ initial: Double, clock: JoltClock = .shared) throws -> JoltMotionValue {
    guard !disposed, !clearing else { throw JoltError.disposed }
    return try retain(JoltMotionValue(initial, clock: clock))
  }
  public func pause() {
    guard !disposed else { return }
    for resource in Array(resources.values) { resource.pause() }
  }
  public func play() {
    guard !disposed else { return }
    for resource in Array(resources.values) { resource.play() }
  }
  public func suspend() {
    guard !disposed, !suspended else { return }
    suspended = true
    for resource in Array(resources.values) { resource.suspend() }
  }
  public func resume() {
    guard !disposed, suspended else { return }
    suspended = false
    for resource in Array(resources.values) { resource.resume() }
  }
  public func reset() {
    guard !clearing else { return }
    clearing = true
    defer { clearing = false }
    let old = resources
    resources.removeAll()
    count = 0
    for (key, resource) in old {
      Self.owners.removeValue(forKey: key)
      resource.dispose()
    }
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    reset()
  }
  deinit {
    let old = resources
    Task { @MainActor in
      for (key, resource) in old {
        if Self.owners[key]?.value == nil {
          Self.owners.removeValue(forKey: key)
          resource.dispose()
        }
      }
    }
  }
}
private struct ScopeModifier: ViewModifier {
  let scope: JoltScope
  @Environment(\.scenePhase) private var phase
  @State private var visible = false
  private func synchronize() {
    if visible && phase == .active { scope.resume() } else { scope.suspend() }
  }
  func body(content: Content) -> some View {
    content.onAppear {
      visible = true
      synchronize()
    }
    .onDisappear {
      visible = false
      synchronize()
    }
    .onChange(of: phase) { _, _ in synchronize() }
  }
}
extension View {
  /// Bind a scope to this view/scene. Offscreen resources suspend; the owner disposes the scope.
  public func joltScope(_ scope: JoltScope) -> some View { modifier(ScopeModifier(scope: scope)) }
}
