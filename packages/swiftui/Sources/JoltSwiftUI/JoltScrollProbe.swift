import SwiftUI

// Observe the actual platform scroll container. SwiftUI content geometry can keep a
// local origin of zero while NSClipView/UIScrollView moves its presentation.
#if os(macOS)
  import AppKit
  final class NativeNotificationTokens: @unchecked Sendable {
    let tokens: [NSObjectProtocol]
    init(_ tokens: [NSObjectProtocol]) { self.tokens = tokens }
    deinit { for token in tokens { NotificationCenter.default.removeObserver(token) } }
  }
  struct ScrollProbe: NSViewRepresentable {
    var controller: JoltScrollController? = nil
    var update: @MainActor (Double, Double) -> Void
    func makeNSView(context: Context) -> Probe { Probe(controller: controller, update: update) }
    func updateNSView(_ view: Probe, context: Context) {
      if view.controller !== controller { view.controller?.detach(owner: view); view.controller=controller }
      view.update = update
      view.attach()
    }
    static func dismantleNSView(_ view: Probe, coordinator: ()) { view.detach() }
    @MainActor final class Probe: NSView {
      weak var controller: JoltScrollController?
      var update: @MainActor (Double, Double) -> Void
      private weak var scroll: NSScrollView?
      private var notifications: NativeNotificationTokens?
      private var previousFrame = false
      private var boundsLease: NativeBoundsLease?
      private var queued = false
      init(controller: JoltScrollController?, update: @escaping @MainActor (Double, Double) -> Void) {
        self.controller=controller
        self.update = update
        super.init(frame: .zero)
      }
      required init?(coder: NSCoder) { fatalError("Use init(update:)") }
      override func hitTest(_ point: NSPoint) -> NSView? { nil }
      override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window == nil { detach() } else { attach() }
      }
      override func viewDidMoveToSuperview() {
        super.viewDidMoveToSuperview()
        attach()
      }
      override func layout() {
        super.layout()
        attach()
      }
      func attach() {
        guard window != nil else { return }
        var ancestor = superview
        var found: NSScrollView?
        while let view = ancestor {
          if let candidate = view as? NSScrollView {
            found = candidate
            break
          }
          ancestor = view.superview
        }
        guard let found else { return }
        if scroll !== found {
          detach()
          scroll = found
          boundsLease = NativeBoundsLease(found.contentView)
          previousFrame = found.documentView?.postsFrameChangedNotifications ?? false
          found.documentView?.postsFrameChangedNotifications = true
          let notify: @Sendable (Notification) -> Void = { [weak self] _ in
            MainActor.assumeIsolated { self?.schedule() }
          }
          notifications = NativeNotificationTokens([
            NotificationCenter.default.addObserver(
              forName: NSView.boundsDidChangeNotification, object: found.contentView, queue: .main,
              using: notify),
            NotificationCenter.default.addObserver(
              forName: NSView.frameDidChangeNotification, object: found.documentView, queue: .main,
              using: notify),
            NotificationCenter.default.addObserver(forName: NSScrollView.willStartLiveScrollNotification, object: found, queue: .main) { [weak self] _ in
              MainActor.assumeIsolated { self?.controller?.cancel() }
            },
          ])
        }
        schedule()
      }
      private func schedule() {
        guard !queued else { return }
        queued = true
        Task { @MainActor [weak self] in
          guard let self else { return }
          self.queued = false
          guard self.window != nil, let scroll = self.scroll, let document = scroll.documentView
          else { return }
          self.controller?.attach(owner: self, read: { [weak self] in self?.snapshot() ?? (0,0) }, write: { [weak self] in self?.write($0) }, layout: { [weak self] in self?.scroll?.layoutSubtreeIfNeeded() })
          let extent = max(0, document.bounds.height - scroll.contentView.bounds.height)
          let offset =
            document.isFlipped
            ? scroll.contentView.bounds.minY - document.bounds.minY
            : extent - (scroll.contentView.bounds.minY - document.bounds.minY)
          self.update(offset, extent)
        }
      }
      private func snapshot() -> (Double, Double) {
        guard let scroll, let document=scroll.documentView else { return (0,0) }
        let extent=max(0,document.bounds.height-scroll.contentView.bounds.height)
        return (document.isFlipped ? scroll.contentView.bounds.minY-document.bounds.minY : extent-(scroll.contentView.bounds.minY-document.bounds.minY),extent)
      }
      private func write(_ offset: Double) {
        guard let scroll, let document=scroll.documentView else { return }
        let extent=max(0,document.bounds.height-scroll.contentView.bounds.height)
        let y=document.bounds.minY+(document.isFlipped ? offset : extent-offset)
        scroll.contentView.scroll(to: NSPoint(x: scroll.contentView.bounds.minX, y: y))
        scroll.reflectScrolledClipView(scroll.contentView)
      }
      func detach() {
        controller?.detach(owner: self)
        notifications = nil
        if let scroll {
          scroll.documentView?.postsFrameChangedNotifications = previousFrame
        }
        boundsLease = nil
        scroll = nil
      }
    }
  }
#else
  import UIKit
  struct ScrollProbe: UIViewRepresentable {
    var controller: JoltScrollController? = nil
    var update: @MainActor (Double, Double) -> Void
    func makeUIView(context: Context) -> Probe { Probe(controller: controller, update: update) }
    func updateUIView(_ view: Probe, context: Context) {
      if view.controller !== controller { view.controller?.detach(owner: view); view.controller=controller }
      view.update = update
      view.attach()
    }
    static func dismantleUIView(_ view: Probe, coordinator: ()) { view.detach() }
    @MainActor final class Probe: UIView {
      weak var controller: JoltScrollController?
      var update: @MainActor (Double, Double) -> Void
      private weak var scroll: UIScrollView?
      private var observations: [NSKeyValueObservation] = []
      private var queued = false
      init(controller: JoltScrollController?, update: @escaping @MainActor (Double, Double) -> Void) {
        self.controller=controller
        self.update = update
        super.init(frame: .zero)
        isUserInteractionEnabled = false
        isAccessibilityElement = false
      }
      required init?(coder: NSCoder) { fatalError("Use init(update:)") }
      override func didMoveToWindow() {
        super.didMoveToWindow()
        if window == nil { detach() } else { attach() }
      }
      override func didMoveToSuperview() {
        super.didMoveToSuperview()
        attach()
      }
      override func layoutSubviews() {
        super.layoutSubviews()
        attach()
      }
      func attach() {
        guard window != nil else { return }
        var ancestor = superview
        var found: UIScrollView?
        while let view = ancestor {
          if let candidate = view as? UIScrollView {
            found = candidate
            break
          }
          ancestor = view.superview
        }
        guard let found else { return }
        if scroll !== found {
          detach()
          scroll = found
          found.panGestureRecognizer.addTarget(self, action: #selector(userPan(_:)))
          observations = [
            found.observe(\.contentOffset, options: [.new]) { [weak self] _, _ in
              MainActor.assumeIsolated { self?.schedule() }
            },
            found.observe(\.contentSize, options: [.new]) { [weak self] _, _ in
              MainActor.assumeIsolated { self?.schedule() }
            },
            found.observe(\.bounds, options: [.new]) { [weak self] _, _ in
              MainActor.assumeIsolated { self?.schedule() }
            },
          ]
        }
        schedule()
      }
      private func schedule() {
        guard !queued else { return }
        queued = true
        Task { @MainActor [weak self] in
          guard let self else { return }
          self.queued = false
          guard self.window != nil, let scroll = self.scroll else { return }
          self.controller?.attach(owner: self, read: { [weak self] in self?.snapshot() ?? (0,0) }, write: { [weak self] in self?.write($0) }, layout: { [weak self] in self?.scroll?.layoutIfNeeded() })
          let insets = scroll.adjustedContentInset
          self.update(
            scroll.contentOffset.y + insets.top,
            max(0, scroll.contentSize.height + insets.top + insets.bottom - scroll.bounds.height))
        }
      }
      @objc private func userPan(_ gesture: UIPanGestureRecognizer) {
        if gesture.state == .began { controller?.cancel() }
      }
      private func snapshot() -> (Double, Double) {
        guard let scroll else { return (0,0) }
        let insets=scroll.adjustedContentInset
        return (scroll.contentOffset.y+insets.top,max(0,scroll.contentSize.height+insets.top+insets.bottom-scroll.bounds.height))
      }
      private func write(_ offset: Double) {
        guard let scroll else { return }
        scroll.setContentOffset(CGPoint(x: scroll.contentOffset.x, y: offset-scroll.adjustedContentInset.top), animated: false)
      }
      func detach() {
        controller?.detach(owner: self)
        scroll?.panGestureRecognizer.removeTarget(self, action: #selector(userPan(_:)))
        observations.removeAll()
        scroll = nil
      }
    }
  }
#endif
