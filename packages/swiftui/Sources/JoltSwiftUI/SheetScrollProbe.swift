import SwiftUI

#if os(macOS)
import AppKit
struct SheetScrollProbe: NSViewRepresentable {
  let model: JoltSheetModel
  let enabled: Bool
  let reduced: Bool
  func makeNSView(context: Context) -> Probe { Probe(model) }
  func updateNSView(_ view: Probe, context: Context) { view.configure(model, enabled, reduced) }
  static func dismantleNSView(_ view: Probe, coordinator: ()) { view.detach(); view.connection.dispose() }
  @MainActor final class Probe: NSView {
    var connection: SheetScrollConnection
    private weak var scroll: NSScrollView?
    private var monitor: Any?
    private var enabled=false, reduced=false
    private var wheelEnd: Task<Void,Never>?
    private var wheelTime=0.0, wheelVelocity=0.0
    private lazy var pan=NSPanGestureRecognizer(target: self, action: #selector(panned(_:)))
    init(_ model: JoltSheetModel) { connection=SheetScrollConnection(model); super.init(frame: .zero) }
    required init?(coder: NSCoder) { fatalError("Use init(model:)") }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
    override func viewDidMoveToWindow() { super.viewDidMoveToWindow(); if window == nil { detach() } else { attach() } }
    override func viewDidMoveToSuperview() { super.viewDidMoveToSuperview(); attach() }
    override func layout() { super.layout(); attach() }
    func configure(_ model: JoltSheetModel, _ enabled: Bool, _ reduced: Bool) {
      if connection.model !== model { detach(); connection.dispose(); connection=SheetScrollConnection(model) }
      self.enabled=enabled; self.reduced=reduced
      connection.synchronize(enabled: enabled, reduced: reduced)
      pan.isEnabled=enabled
      attach()
    }
    private func attach() {
      guard window != nil else { return }
      var ancestor=superview
      while let view=ancestor, !(view is NSScrollView) { ancestor=view.superview }
      guard let found=ancestor as? NSScrollView else { return }
      if scroll === found { return }
      detach(); scroll=found
      found.addGestureRecognizer(pan); pan.isEnabled=enabled
      connection.read={ [weak self] in self?.read() ?? (0,0) }
      connection.write={ [weak self] in self?.write($0) }
      monitor=NSEvent.addLocalMonitorForEvents(matching: .scrollWheel) { [weak self] event in
        let consumed=MainActor.assumeIsolated { guard let self else { return false }; return self.wheel(event) == nil }
        return consumed ? nil : event
      }
    }
    private func read() -> (Double,Double) {
      guard let scroll, let document=scroll.documentView else { return (0,0) }
      let extent=max(0,document.bounds.height-scroll.contentView.bounds.height)
      let raw=scroll.contentView.bounds.minY-document.bounds.minY
      return (min(extent,max(0,document.isFlipped ? raw : extent-raw)),extent)
    }
    private func write(_ offset: Double) {
      guard let scroll, let document=scroll.documentView else { return }
      let extent=max(0,document.bounds.height-scroll.contentView.bounds.height)
      let y=document.bounds.minY+(document.isFlipped ? offset : extent-offset)
      scroll.contentView.scroll(to: .init(x: scroll.contentView.bounds.minX,y: y))
      scroll.reflectScrolledClipView(scroll.contentView)
    }
    private func wheel(_ event: NSEvent) -> NSEvent? {
      guard enabled, let scroll, event.window === window,
        scroll.bounds.contains(scroll.convert(event.locationInWindow, from: nil)) else { return event }
      // The connection owns bounded release; do not apply the OS momentum a second time.
      if !event.momentumPhase.isEmpty { return nil }
      if event.phase.contains(.cancelled) { wheelEnd?.cancel(); connection.cancel(); return nil }
      if event.phase.contains(.ended) {
        wheelEnd?.cancel(); connection.end(velocity: wheelVelocity, reduced: reduced); return nil
      }
      let delta=event.scrollingDeltaY*(event.hasPreciseScrollingDeltas ? 1 : 10)
      guard delta != 0 else { return nil }
      if !connection.active { guard connection.begin() else { return event }; wheelTime=event.timestamp; wheelVelocity=0 }
      let dt=event.timestamp-wheelTime
      if dt>0 && dt<0.1 { wheelVelocity=delta/dt }
      wheelTime=event.timestamp
      _=connection.change(delta)
      wheelEnd?.cancel()
      if event.phase.isEmpty {
        wheelEnd=Task { @MainActor [weak self] in
          try? await Task.sleep(for: .milliseconds(100))
          guard !Task.isCancelled, let self else { return }
          self.connection.end(velocity: 0, reduced: self.reduced)
        }
      }
      return nil
    }
    @objc private func panned(_ input: NSPanGestureRecognizer) {
      guard enabled else { return }
      if input.state == .began { _=connection.begin() }
      if [.began,.changed,.ended].contains(input.state) {
        let delta=input.translation(in: nil); input.setTranslation(.zero,in: nil)
        _=connection.change(-delta.y)
      }
      if input.state == .ended { connection.end(velocity: -input.velocity(in: nil).y,reduced: reduced) }
      else if [.cancelled,.failed].contains(input.state) { connection.cancel() }
    }
    func detach() {
      wheelEnd?.cancel(); wheelEnd=nil
      if let monitor { NSEvent.removeMonitor(monitor) }; monitor=nil
      scroll?.removeGestureRecognizer(pan); scroll=nil
      connection.cancel(); connection.read={ (0,0) }; connection.write={ _ in }
    }
  }
}
#else
import UIKit
struct SheetScrollProbe: UIViewRepresentable {
  let model: JoltSheetModel
  let enabled: Bool
  let reduced: Bool
  func makeUIView(context: Context) -> Probe { Probe(model) }
  func updateUIView(_ view: Probe, context: Context) { view.configure(model, enabled, reduced) }
  static func dismantleUIView(_ view: Probe, coordinator: ()) { view.detach(); view.connection.dispose() }
  @MainActor final class Probe: UIView, UIGestureRecognizerDelegate {
    var connection: SheetScrollConnection
    private weak var scroll: UIScrollView?
    private var enabled=false, reduced=false, leased=false, previousPan=true
    private lazy var pan=UIPanGestureRecognizer(target: self, action: #selector(panned(_:)))
    init(_ model: JoltSheetModel) {
      connection=SheetScrollConnection(model); super.init(frame: .zero)
      isUserInteractionEnabled=false; isAccessibilityElement=false
      pan.maximumNumberOfTouches=1; pan.delegate=self
    }
    required init?(coder: NSCoder) { fatalError("Use init(model:)") }
    override func didMoveToWindow() { super.didMoveToWindow(); if window == nil { detach() } else { attach() } }
    override func didMoveToSuperview() { super.didMoveToSuperview(); attach() }
    override func layoutSubviews() { super.layoutSubviews(); attach() }
    func configure(_ model: JoltSheetModel, _ enabled: Bool, _ reduced: Bool) {
      if connection.model !== model { detach(); connection.dispose(); connection=SheetScrollConnection(model) }
      self.enabled=enabled; self.reduced=reduced
      connection.synchronize(enabled: enabled, reduced: reduced)
      attach(); updateInput()
    }
    private func attach() {
      guard window != nil else { return }
      var ancestor=superview
      while let view=ancestor, !(view is UIScrollView) { ancestor=view.superview }
      guard let found=ancestor as? UIScrollView else { return }
      if scroll === found { return }
      detach(); scroll=found; found.addGestureRecognizer(pan)
      connection.read={ [weak found] in
        guard let found else { return (0,0) }
        let inset=found.adjustedContentInset
        return (found.contentOffset.y+inset.top,max(0,found.contentSize.height+inset.top+inset.bottom-found.bounds.height))
      }
      connection.write={ [weak found] offset in
        guard let found else { return }
        found.setContentOffset(.init(x: found.contentOffset.x,y: offset-found.adjustedContentInset.top),animated: false)
      }
      updateInput()
    }
    private func updateInput() {
      guard let scroll else { return }
      pan.isEnabled=enabled
      if enabled && !leased {
        previousPan=scroll.panGestureRecognizer.isEnabled; leased=true
        scroll.panGestureRecognizer.isEnabled=false
      } else if !enabled { restorePan() }
    }
    private func restorePan() {
      if leased, let scroll, !scroll.panGestureRecognizer.isEnabled { scroll.panGestureRecognizer.isEnabled=previousPan }
      leased=false
    }
    func gestureRecognizer(_ recognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
      guard enabled, let scroll else { return false }
      var view=touch.view
      while let current=view, current !== scroll {
        if current is UIScrollView { return false }
        view=current.superview
      }
      return view === scroll
    }
    @objc private func panned(_ input: UIPanGestureRecognizer) {
      guard enabled else { return }
      if input.state == .began { _=connection.begin() }
      if [.began,.changed,.ended].contains(input.state) {
        let delta=input.translation(in: window); input.setTranslation(.zero,in: window)
        _=connection.change(delta.y)
      }
      if input.state == .ended { connection.end(velocity: input.velocity(in: window).y,reduced: reduced) }
      else if [.cancelled,.failed].contains(input.state) { connection.cancel() }
    }
    func detach() {
      connection.cancel(); restorePan()
      scroll?.removeGestureRecognizer(pan); scroll=nil
      connection.read={ (0,0) }; connection.write={ _ in }
    }
  }
}
#endif
