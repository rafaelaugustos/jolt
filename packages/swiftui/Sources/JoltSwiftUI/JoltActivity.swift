import SwiftUI

#if os(macOS)
  import AppKit
#endif

private struct JoltActivityKey: EnvironmentKey {
  static let defaultValue: Bool? = nil
}
extension EnvironmentValues {
  var joltProvidedActivity: Bool? {
    get { self[JoltActivityKey.self] }
    set { self[JoltActivityKey.self] = newValue }
  }
  /// Whether Jolt runs motion and input here. iOS and iPadOS: the scene is active. macOS: the
  /// hosting window is on screen, not minimized and not fully covered, whether or not it is key.
  /// Outside Jolt views and `joltActivity()`, this falls back to the scene phase.
  public var joltActive: Bool { joltProvidedActivity ?? (scenePhase == .active) }
}

/// The activity a Jolt view reads, resolved once per platform for every modifier and view.
@MainActor @propertyWrapper struct JoltSceneActivity: DynamicProperty {
  @Environment(\.joltProvidedActivity) private var provided
  @Environment(\.scenePhase) private var phase
  @State private var window: Bool?
  init() {}
  var wrappedValue: Bool {
    #if os(macOS)
      provided ?? window ?? true
    #else
      provided ?? (phase == .active)
    #endif
  }
  var projectedValue: Link { Link(provided: provided, value: wrappedValue, window: $window) }
  struct Link {
    let provided: Bool?
    let value: Bool
    let window: Binding<Bool?>
  }
}

/// Publishes the resolved activity to descendants. On macOS the first Jolt view without an
/// inherited value observes its own window, so nested views share one probe.
struct JoltActivityProvider: ViewModifier {
  let link: JoltSceneActivity.Link
  init(_ link: JoltSceneActivity.Link) { self.link = link }
  func body(content: Content) -> some View {
    #if os(macOS)
      if link.provided == nil {
        content.environment(\.joltProvidedActivity, link.value)
          .background(JoltWindowProbe { link.window.wrappedValue = $0 })
      } else {
        content
      }
    #else
      content.environment(\.joltProvidedActivity, link.value)
    #endif
  }
}

private struct PublicActivity: ViewModifier {
  @JoltSceneActivity private var active
  func body(content: Content) -> some View { content.modifier(JoltActivityProvider($active)) }
}

extension View {
  /// Resolve `joltActive` for this subtree. Jolt's own views and modifiers already do this; use it
  /// to read the same activity in application views.
  public func joltActivity() -> some View { modifier(PublicActivity()) }
}

#if os(macOS)
  /// Reports whether the hosting window can show motion, and registers that window's display with
  /// the clocks.
  struct JoltWindowProbe: NSViewRepresentable {
    let report: @MainActor (Bool) -> Void
    func makeNSView(context: Context) -> ProbeView {
      let view = ProbeView()
      view.report = report
      DispatchQueue.main.async { [weak view] in view?.publish() }
      return view
    }
    func updateNSView(_ view: ProbeView, context: Context) { view.report = report }
    static func dismantleNSView(_ view: ProbeView, coordinator: ()) { view.detach() }

    @MainActor final class ProbeView: NSView {
      var report: (@MainActor (Bool) -> Void)?
      private var observed: NSWindow?
      private var tokens: [NSObjectProtocol] = []
      private var last: Bool?
      override var isOpaque: Bool { false }
      override func hitTest(_ point: NSPoint) -> NSView? { nil }
      override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        observe(window)
        publish()
      }
      func publish() {
        let visible = JoltWindows.visible(window)
        JoltWindows.shared.update(self, window: window, visible: visible)
        guard visible != last else { return }
        last = visible
        report?(visible)
      }
      func detach() {
        observe(nil)
        JoltWindows.shared.remove(self)
        report = nil
      }
      private func observe(_ next: NSWindow?) {
        guard observed !== next else { return }
        for token in tokens { NotificationCenter.default.removeObserver(token) }
        tokens.removeAll()
        observed = next
        guard let next else { return }
        let names: [Notification.Name] = [
          NSWindow.didChangeOcclusionStateNotification, NSWindow.didMiniaturizeNotification,
          NSWindow.didDeminiaturizeNotification, NSWindow.didChangeScreenNotification,
          NSWindow.willCloseNotification,
        ]
        tokens = names.map { name in
          NotificationCenter.default.addObserver(forName: name, object: next, queue: .main) {
            [weak self] notification in
            let closing = notification.name == NSWindow.willCloseNotification
            MainActor.assumeIsolated {
              guard let self else { return }
              if closing { self.observe(nil) }
              self.publish()
            }
          }
        }
      }
    }
  }

  /// Windows that host Jolt views, and the displays that show the visible ones.
  @MainActor final class JoltWindows {
    static let shared = JoltWindows()
    private struct Entry {
      weak var window: NSWindow?
      var visible: Bool
    }
    private var entries: [ObjectIdentifier: Entry] = [:]
    private var listeners: [ObjectIdentifier: () -> Void] = [:]
    static func visible(_ window: NSWindow?) -> Bool {
      guard let window else { return false }
      return window.isVisible && !window.isMiniaturized
        && window.occlusionState.contains(.visible)
    }
    /// `nil` until a Jolt view is hosted in a window: the clock then keeps the main display.
    var displays: [CGDirectDisplayID]? {
      guard !entries.isEmpty else { return nil }
      return Self.displays(entries.values.map { ($0.visible, $0.window?.screen?.joltDisplay) })
    }
    nonisolated static func displays(_ hosts: [(visible: Bool, display: CGDirectDisplayID?)])
      -> [CGDirectDisplayID]
    {
      var seen: Set<CGDirectDisplayID> = []
      return hosts.compactMap { host in
        guard host.visible, let display = host.display, seen.insert(display).inserted else {
          return nil
        }
        return display
      }
    }
    func update(_ probe: NSView, window: NSWindow?, visible: Bool) {
      let key = ObjectIdentifier(probe)
      let previous = entries[key]
      entries[key] = Entry(window: window, visible: visible)
      if previous?.visible != visible || previous?.window?.screen != window?.screen
        || previous == nil
      {
        notify()
      }
    }
    func remove(_ probe: NSView) {
      guard entries.removeValue(forKey: ObjectIdentifier(probe)) != nil else { return }
      notify()
    }
    func listen(_ owner: AnyObject, _ change: @escaping () -> Void) {
      listeners[ObjectIdentifier(owner)] = change
    }
    func stopListening(_ owner: AnyObject) { listeners.removeValue(forKey: ObjectIdentifier(owner)) }
    private func notify() { for listener in Array(listeners.values) { listener() } }
  }

  extension NSScreen {
    var joltDisplay: CGDirectDisplayID? {
      deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID
    }
  }
#endif
