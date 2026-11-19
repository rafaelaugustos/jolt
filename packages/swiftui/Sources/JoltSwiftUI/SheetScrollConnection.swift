import JoltCore
import SwiftUI

/// Platform input and scroll geometry use the sheet model and the existing finite decay clock.
@MainActor final class SheetScrollConnection {
  let model: JoltSheetModel
  var read: () -> (Double, Double) = { (0,0) }
  var write: (Double) -> Void = { _ in }
  private(set) var active=false
  private var epoch=0
  private var owner=JoltScrollConsumption.Owner.none
  private var coasting=false
  private let value: JoltMotionValue
  private var observation: JoltObservation?
  init(_ model: JoltSheetModel) {
    self.model=model
    value=try! JoltMotionValue(0, clock: model.clock)
    observation=try? value.subscribe { [weak self] offset in
      guard let self, self.coasting else { return }
      guard self.model.inputRevision == self.epoch, !self.model.disposed,
        !self.model.paused, !self.model.suspended else { self.stop(); return }
      let extent=self.read().1
      self.write(min(extent,max(0,offset)))
      if offset < 0 || offset > extent { self.stop() }
    }
  }
  @discardableResult func begin() -> Bool {
    cancel()
    guard model.beginDrag() else { return false }
    active=true; epoch=model.inputRevision; owner = .none
    return true
  }
  @discardableResult func change(_ delta: Double) -> Bool {
    guard active, epoch==model.inputRevision else { cancel(); return false }
    let (offset,extent)=read()
    guard let next=model.consumeScroll(delta: delta, offset: offset, extent: extent) else { cancel(); return false }
    if next.owner != .none { owner=next.owner }
    write(next.offset)
    return true
  }
  func end(velocity: Double, reduced: Bool) {
    guard active, epoch==model.inputRevision, model.dragging else { cancel(); return }
    active=false
    let scrollOwns=owner == .scroll
    model.endDrag(velocity: owner == .panel ? velocity : 0)
    epoch=model.inputRevision
    guard scrollOwns, !reduced, !model.disposed, !model.paused, !model.suspended else { return }
    let (offset,extent)=read()
    guard extent>0, velocity.isFinite else { return }
    try? value.set(min(extent,max(0,offset)))
    coasting=true
    try? value.decay(velocity: max(-4000,min(4000,-velocity)), bounds: 0...extent) { [weak self] _ in self?.coasting=false }
  }
  func stop() { coasting=false; value.cancel() }
  func cancel() {
    let owned=active && epoch==model.inputRevision && model.dragging
    active=false; stop()
    if owned { model.cancel() }
  }
  func synchronize(enabled: Bool, reduced: Bool) {
    if !enabled || model.paused || model.suspended || model.disposed { cancel() }
    else if active && (epoch != model.inputRevision || !model.dragging) { cancel() }
    if reduced { stop() }
  }
  func dispose() { cancel(); observation?.dispose(); observation=nil; value.dispose(); read={ (0,0) }; write={ _ in } }
}
