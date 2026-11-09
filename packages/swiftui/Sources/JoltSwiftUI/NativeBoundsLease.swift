#if os(macOS)
  import AppKit
  /// Multiple scroll/viewport observers share the native notification flag without disabling each other.
  @MainActor final class NativeBoundsLease {
    private struct Entry {
      weak var view: NSView?
      var count: Int
      let previous: Bool
      let generation: UUID
    }
    private static var entries: [ObjectIdentifier: Entry] = [:]
    private let id: ObjectIdentifier
    private let generation: UUID
    init(_ view: NSView) {
      id = ObjectIdentifier(view)
      if var entry = Self.entries[id], entry.view === view {
        entry.count += 1
        Self.entries[id] = entry
        generation = entry.generation
      } else {
        generation = UUID()
        Self.entries[id] = .init(
          view: view, count: 1, previous: view.postsBoundsChangedNotifications,
          generation: generation)
        view.postsBoundsChangedNotifications = true
      }
    }
    deinit {
      let id = id
      let generation = generation
      Task { @MainActor in
        guard var entry = Self.entries[id], entry.generation == generation else { return }
        entry.count -= 1
        if entry.count == 0 {
          entry.view?.postsBoundsChangedNotifications = entry.previous
          Self.entries.removeValue(forKey: id)
        } else {
          Self.entries[id] = entry
        }
      }
    }
  }
#endif
