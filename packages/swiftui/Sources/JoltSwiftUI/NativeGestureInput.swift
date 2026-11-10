#if os(iOS)
  import SwiftUI
  import UIKit

  /// A non-hit-testing geometry anchor; recognizers filter touches to this region and preserve taps.
  struct NativeGestureInput: UIViewRepresentable {
    let model: JoltGestureModel
    final class Anchor: UIView {
      var connection: ((UIWindow?) -> Void)?
      override func didMoveToWindow() {
        super.didMoveToWindow()
        connection?(window)
      }
    }
    @MainActor final class Coordinator: NSObject, UIGestureRecognizerDelegate {
      var model: JoltGestureModel
      weak var anchor: Anchor?
      private weak var window: UIWindow?
      private var origin = CGPoint.zero
      private lazy var pan = UIPanGestureRecognizer(target: self, action: #selector(panned))
      private lazy var pinch = UIPinchGestureRecognizer(target: self, action: #selector(pinched))
      private lazy var turn = UIRotationGestureRecognizer(target: self, action: #selector(rotated))
      private var inputs: [UIGestureRecognizer] { [pan, pinch, turn] }
      init(_ model: JoltGestureModel) {
        self.model = model
        super.init()
      }
      func attach(_ next: UIWindow?) {
        if window === next { return }
        detach()
        window = next
        pan.maximumNumberOfTouches = 1
        for input in inputs {
          input.delegate = self
          input.cancelsTouchesInView = false
          next?.addGestureRecognizer(input)
        }
      }
      func detach() {
        for input in inputs { window?.removeGestureRecognizer(input) }
        window = nil
        model.cancel()
      }
      func gestureRecognizer(_ recognizer: UIGestureRecognizer, shouldReceive touch: UITouch)
        -> Bool
      {
        guard let anchor, anchor.window != nil, !anchor.isHidden, !model.disposed, !model.suspended
        else { return false }
        return anchor.bounds.contains(touch.location(in: anchor))
      }
      func gestureRecognizer(
        _ recognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer
      ) -> Bool {
        inputs.contains { $0 === other }
      }
      private func begin(_ input: UIGestureRecognizer, _ contact: JoltGestureContact) -> Bool {
        guard let anchor, let window, !model.disposed, !model.suspended else { return false }
        if model.contacts.isEmpty {
          let center = anchor.convert(
            .init(x: anchor.bounds.midX, y: anchor.bounds.midY), to: window)
          origin = .init(x: center.x - model.position.x, y: center.y - model.position.y)
        }
        return model.contacts.contains(contact) || model.begin(contact)
      }
      private func focal(_ input: UIGestureRecognizer) -> CGPoint {
        let point = input.location(in: window)
        return .init(x: point.x - origin.x, y: point.y - origin.y)
      }
      private func final(_ input: UIGestureRecognizer, _ contact: JoltGestureContact) {
        if input.state == .ended || input.state == .cancelled || input.state == .failed {
          model.end(contact)
        }
      }
      @objc private func panned(_ input: UIPanGestureRecognizer) {
        defer { final(input, .pan) }
        guard [.began, .changed, .ended].contains(input.state), begin(input, .pan) else { return }
        let delta = input.translation(in: window)
        input.setTranslation(.zero, in: window)
        try? model.change(pan: .init(width: delta.x, height: delta.y))
      }
      @objc private func pinched(_ input: UIPinchGestureRecognizer) {
        defer { final(input, .pinch) }
        guard [.began, .changed, .ended].contains(input.state), begin(input, .pinch) else { return }
        let delta = input.scale
        input.scale = 1
        try? model.change(magnification: Double(delta), around: focal(input))
      }
      @objc private func rotated(_ input: UIRotationGestureRecognizer) {
        defer { final(input, .rotation) }
        guard [.began, .changed, .ended].contains(input.state), begin(input, .rotation) else {
          return
        }
        let delta = input.rotation
        input.rotation = 0
        try? model.change(rotation: Double(delta) * 180 / Double.pi, around: focal(input))
      }
    }
    func makeCoordinator() -> Coordinator { .init(model) }
    func makeUIView(context: Context) -> Anchor {
      let anchor = Anchor()
      anchor.isUserInteractionEnabled = false
      anchor.isAccessibilityElement = false
      context.coordinator.anchor = anchor
      anchor.connection = { [weak coordinator = context.coordinator] window in
        coordinator?.attach(window)
      }
      return anchor
    }
    func updateUIView(_ view: Anchor, context: Context) {
      if context.coordinator.model !== model {
        context.coordinator.detach()
        context.coordinator.model = model
        context.coordinator.attach(view.window)
      }
    }
    static func dismantleUIView(_ view: Anchor, coordinator: Coordinator) {
      view.connection = nil
      coordinator.detach()
      coordinator.anchor = nil
    }
  }
#endif
