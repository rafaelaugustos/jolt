import JoltCore
import SwiftUI

/// Geometric entry, not visual occlusion detection. Own this controller for one observed view.
@MainActor public final class JoltViewportEntry: ObservableObject, JoltResource {
  public let threshold: Double, once: Bool
  public let progress: JoltMotionValue
  @Published public private(set) var entries = 0
  @Published public private(set) var visible = false
  public private(set) var disposed = false
  private var paused = false, suspended = false, reduced = false
  private var fraction = 0.0
  private let transition: JoltTransition
  public init(
    threshold: Double = 0.25, once: Bool = true, transition: JoltTransition = .spring(.smooth),
    clock: JoltClock = .shared
  ) throws {
    guard threshold.isFinite, (0...1).contains(threshold) else { throw JoltError.invalidMotion }
    self.threshold = threshold
    self.once = once
    self.transition = transition
    progress = try JoltMotionValue(0, clock: clock)
  }
  public func update(visibleFraction: Double) {
    guard !disposed, visibleFraction.isFinite else { return }
    fraction = min(1, max(0, visibleFraction))
    reconcile()
  }
  private func reconcile() {
    guard !disposed, !paused, !suspended else { return }
    let next = fraction > 0 && fraction >= threshold
    guard next != visible else { return }
    visible = next
    if next {
      if once && entries > 0 {
        try? progress.set(1)
        return
      }
      entries += 1
      try? progress.animate(to: 1, transition: transition, reducedMotion: reduced)
    } else if !once {
      try? progress.set(0)
    }
  }
  func reducedMotion(_ reduced: Bool) {
    self.reduced = reduced
    if reduced && visible { try? progress.set(1) }
  }
  func detach() {
    progress.cancel()
    visible = false
    fraction = 0
    suspend()
  }
  public func pause() {
    paused = true
    progress.pause()
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    progress.play()
    reconcile()
  }
  public func suspend() {
    suspended = true
    progress.suspend()
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    progress.resume()
    reconcile()
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    visible = false
    progress.dispose()
  }
}
private struct ViewportMotion: ViewModifier {
  @ObservedObject var controller: JoltViewportEntry
  @ObservedObject var progress: JoltMotionValue
  let from: JoltPose, to: JoltPose
  @Environment(\.scenePhase) private var phase
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    let p = min(1, max(0, progress.value))
    let transform = reduced || appReduced ? 1 : p
    func mix(_ a: Double, _ b: Double, _ p: Double) -> Double { a + (b - a) * p }
    return content.scaleEffect(
      x: mix(from.scaleX, to.scaleX, transform), y: mix(from.scaleY, to.scaleY, transform)
    )
    .rotationEffect(.degrees(mix(from.rotate, to.rotate, transform)))
    .offset(x: mix(from.x, to.x, transform), y: mix(from.y, to.y, transform))
    .opacity(mix(from.opacity, to.opacity, p)).transaction { $0.animation = nil }
    .background(ViewportProbe { controller.update(visibleFraction: $0) })
    .onAppear {
      controller.reducedMotion(reduced || appReduced)
      if phase == .active { controller.resume() } else { controller.suspend() }
    }
    .onDisappear { controller.detach() }
    .onChange(of: phase) { _, phase in
      if phase == .active { controller.resume() } else { controller.suspend() }
    }
    .onChange(of: reduced || appReduced) { _, next in controller.reducedMotion(next) }
  }
}
extension View {
  /// Observes geometric intersection with the native window and clipping ancestors; opacity is not occlusion.
  public func joltViewportEnter(
    _ controller: JoltViewportEntry, from: JoltPose = try! .init(y: 24, opacity: 0),
    to: JoltPose = .identity
  ) -> some View {
    modifier(
      ViewportMotion(controller: controller, progress: controller.progress, from: from, to: to))
  }
}

#if os(macOS)
  import AppKit
  struct ViewportProbe: NSViewRepresentable {
    let update: @MainActor (Double) -> Void
    func makeNSView(context: Context) -> Probe { Probe(update: update) }
    func updateNSView(_ view: Probe, context: Context) {
      view.update = update
      view.attach()
    }
    static func dismantleNSView(_ view: Probe, coordinator: ()) { view.detach() }
    @MainActor final class Probe: NSView {
      var update: @MainActor (Double) -> Void
      private var notifications: NativeNotificationTokens?
      private var clips: [NSClipView] = []
      private var leases: [NativeBoundsLease] = []
      private var queued = false
      init(update: @escaping @MainActor (Double) -> Void) {
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
        var found: [NSClipView] = []
        var ancestor = superview
        while let view = ancestor {
          if let clip = view as? NSClipView { found.append(clip) }
          ancestor = view.superview
        }
        if found.map(ObjectIdentifier.init) != clips.map(ObjectIdentifier.init) {
          detach()
          clips = found
          leases = found.map(NativeBoundsLease.init)
          var tokens: [NSObjectProtocol] = []
          for clip in found {
            tokens.append(
              NotificationCenter.default.addObserver(
                forName: NSView.boundsDidChangeNotification, object: clip, queue: .main
              ) { [weak self] _ in MainActor.assumeIsolated { self?.schedule() } })
          }
          notifications = NativeNotificationTokens(tokens)
        }
        schedule()
      }
      private func schedule() {
        guard !queued else { return }
        queued = true
        Task { @MainActor [weak self] in
          guard let self else { return }
          self.queued = false
          guard self.window != nil else { return }
          let area = self.bounds.width * self.bounds.height
          let visible = self.visibleRect.intersection(self.bounds)
          self.update(
            area > 0 && !visible.isNull && !self.isHiddenOrHasHiddenAncestor
              ? min(1, max(0, visible.width * visible.height / area)) : 0)
        }
      }
      func detach() {
        notifications = nil
        leases.removeAll()
        clips.removeAll()
      }
    }
  }
#else
  import UIKit
  struct ViewportProbe: UIViewRepresentable {
    let update: @MainActor (Double) -> Void
    func makeUIView(context: Context) -> Probe { Probe(update: update) }
    func updateUIView(_ view: Probe, context: Context) {
      view.update = update
      view.attach()
    }
    static func dismantleUIView(_ view: Probe, coordinator: ()) { view.detach() }
    @MainActor final class Probe: UIView {
      var update: @MainActor (Double) -> Void
      private var scrolls: [UIScrollView] = []
      private var observations: [NSKeyValueObservation] = []
      private var queued = false
      init(update: @escaping @MainActor (Double) -> Void) {
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
        var found: [UIScrollView] = []
        var ancestor = superview
        while let view = ancestor {
          if let scroll = view as? UIScrollView { found.append(scroll) }
          ancestor = view.superview
        }
        if found.map(ObjectIdentifier.init) != scrolls.map(ObjectIdentifier.init) {
          detach()
          scrolls = found
          observations = found.flatMap { scroll in
            [
              scroll.observe(\.contentOffset, options: [.new]) { [weak self] _, _ in
                MainActor.assumeIsolated { self?.schedule() }
              },
              scroll.observe(\.bounds, options: [.new]) { [weak self] _, _ in
                MainActor.assumeIsolated { self?.schedule() }
              },
            ]
          }
        }
        schedule()
      }
      private func schedule() {
        guard !queued else { return }
        queued = true
        Task { @MainActor [weak self] in
          guard let self else { return }
          self.queued = false
          guard let window = self.window else { return }
          let frame = self.convert(self.bounds, to: window)
          let area = frame.width * frame.height
          var visible = frame.intersection(window.bounds)
          var ancestor: UIView? = self
          while let view = ancestor {
            if view.isHidden {
              visible = .null
              break
            }
            if view.clipsToBounds {
              visible = visible.intersection(view.convert(view.bounds, to: window))
            }
            ancestor = view.superview
          }
          self.update(
            area > 0 && !visible.isNull ? min(1, max(0, visible.width * visible.height / area)) : 0)
        }
      }
      func detach() {
        observations.removeAll()
        scrolls.removeAll()
      }
    }
  }
#endif
