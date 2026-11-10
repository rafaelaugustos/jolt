import SwiftUI

#if os(iOS)
  import UIKit

  /// Convert the keyboard's screen rect into the actual host, including parent keyboard avoidance.
  struct SheetKeyboardProbe: UIViewRepresentable {
    let active: Bool
    let update: @MainActor (Double) -> Void
    final class Anchor: UIView {
      var changed: (() -> Void)?
      override func layoutSubviews() {
        super.layoutSubviews()
        changed?()
      }
      override func didMoveToWindow() {
        super.didMoveToWindow()
        changed?()
      }
    }
    @MainActor final class Coordinator {
      weak var anchor: Anchor?
      var update: @MainActor (Double) -> Void
      private var tokens: [NSObjectProtocol] = []
      private var keyboard: CGRect?
      private var last = -1.0
      private var generation = 0
      private var active = false
      init(_ update: @escaping @MainActor (Double) -> Void) { self.update = update }
      func start(_ next: Bool) {
        guard next != active else { return }
        active = next
        last = -1
        generation += 1
        for token in tokens { NotificationCenter.default.removeObserver(token) }
        tokens.removeAll()
        if next {
          for name in [
            UIResponder.keyboardWillChangeFrameNotification,
            UIResponder.keyboardWillHideNotification,
          ] {
            tokens.append(
              NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) {
                [weak self] notification in
                let frame =
                  notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect
                let hidden = notification.name == UIResponder.keyboardWillHideNotification
                MainActor.assumeIsolated {
                  guard let self, self.active else { return }
                  self.keyboard = hidden ? nil : frame
                  self.measure()
                }
              })
          }
        } else {
          keyboard = nil
        }
        measure()
      }
      func measure() {
        let overlap: Double
        if active, let keyboard, let anchor, let window = anchor.window {
          let inWindow = window.convert(keyboard, from: window.screen.coordinateSpace)
          let rect = anchor.convert(inWindow, from: window)
          // A floating keyboard that does not cover the bottom edge leaves bottom-sheet geometry intact.
          overlap =
            rect.maxY >= anchor.bounds.maxY - 0.5 && rect.intersects(anchor.bounds)
            ? max(0, min(anchor.bounds.height, anchor.bounds.maxY - rect.minY)) : 0
        } else {
          overlap = 0
        }
        guard abs(overlap - last) > 0.5 else { return }
        last = overlap
        let epoch = generation
        DispatchQueue.main.async { [weak self] in
          guard let self, self.generation == epoch else { return }
          self.update(overlap)
        }
      }
      func dispose() {
        active = false
        generation += 1
        for token in tokens { NotificationCenter.default.removeObserver(token) }
        tokens.removeAll()
        anchor = nil
      }
    }
    func makeCoordinator() -> Coordinator { .init(update) }
    func makeUIView(context: Context) -> Anchor {
      let anchor = Anchor()
      anchor.isUserInteractionEnabled = false
      context.coordinator.anchor = anchor
      anchor.changed = { [weak coordinator = context.coordinator] in coordinator?.measure() }
      return anchor
    }
    func updateUIView(_ view: Anchor, context: Context) {
      context.coordinator.update = update
      context.coordinator.start(active)
      context.coordinator.measure()
    }
    static func dismantleUIView(_ view: Anchor, coordinator: Coordinator) {
      view.changed = nil
      coordinator.dispose()
    }
  }
#else
  struct SheetKeyboardProbe: View {
    let active: Bool
    let update: (Double) -> Void
    var body: some View { Color.clear.onAppear { update(0) } }
  }
#endif
