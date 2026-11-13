import JoltCore
import SwiftUI

/// One native scroll source can feed several ranges, all in points and with independent lifetimes.
@MainActor public final class JoltScrollProgress: ObservableObject, JoltResource {
  @Published public private(set) var offset = 0.0
  @Published public private(set) var progress = 0.0
  @Published public private(set) var extent = 0.0
  public private(set) var range: ClosedRange<Double>?
  public private(set) var disposed = false
  private var paused = false, suspended = false
  private var pending: (offset: Double, extent: Double) = (0,0)
  private weak var parent: JoltScrollProgress?
  private final class Child { weak var value: JoltScrollProgress?; init(_ value: JoltScrollProgress) { self.value=value } }
  private var children: [Child] = []
  public init(range: ClosedRange<Double>? = nil) throws {
    try Self.validate(range)
    self.range = range
  }
  private static func validate(_ range: ClosedRange<Double>?) throws {
    if let range {
      guard range.lowerBound.isFinite, range.upperBound.isFinite, range.upperBound > range.lowerBound else { throw JoltError.invalidMotion }
    }
  }
  /// Borrows this source. Disposing a subrange leaves the source and siblings active.
  public func subrange(_ range: ClosedRange<Double>) throws -> JoltScrollProgress {
    guard !disposed else { throw JoltError.disposed }
    let child=try JoltScrollProgress(range: range)
    child.parent=self
    children.removeAll { $0.value == nil }
    children.append(Child(child))
    child.update(offset: offset, extent: extent)
    return child
  }
  public func setRange(_ range: ClosedRange<Double>?) throws {
    guard !disposed else { throw JoltError.disposed }
    try Self.validate(range)
    self.range=range
    apply()
  }
  public func update(offset: Double, extent: Double) {
    guard !disposed, offset.isFinite, extent.isFinite else { return }
    pending=(offset == 0 ? 0 : offset, max(0,extent))
    apply()
  }
  private func apply() {
    guard !disposed, !paused, !suspended else { return }
    let start = range?.lowerBound ?? 0, end = range?.upperBound ?? pending.extent
    let next=end>start ? min(1,max(0,(pending.offset-start)/(end-start))) : 0
    if offset != pending.offset { offset=pending.offset }
    if extent != pending.extent { extent=pending.extent }
    if progress != next { progress=next }
    children.removeAll { $0.value == nil }
    for child in children { child.value?.update(offset: offset, extent: extent) }
  }
  public func pause() { paused=true }
  public func play() { paused=false; apply() }
  public func suspend() { suspended=true }
  public func resume() { suspended=false; apply() }
  public func dispose() {
    guard !disposed else { return }
    disposed=true
    parent?.children.removeAll { $0.value === self || $0.value == nil }; parent=nil
    let detached=children; children=[]
    for child in detached { child.value?.dispose() }
  }
}
/// Vertical scroll geometry in points. The optional range overrides full-content progress.
public struct JoltScrollView<Content: View>: View {
  @ObservedObject private var progress: JoltScrollProgress
  private let content: () -> Content
  private let controller: JoltScrollController?
  @Environment(\.joltEffectiveReduceMotion) private var reducedMotion
  @State private var progressSpace = UUID()
  @State private var offset = 0.0
  @State private var extent = 0.0
  @State private var visible = false
  @JoltSceneActivity private var sceneActive
  public init(progress: JoltScrollProgress, @ViewBuilder content: @escaping () -> Content) {
    self.progress = progress
    self.content = content
    self.controller = nil
  }
  public init(controller: JoltScrollController, @ViewBuilder content: @escaping () -> Content) {
    self.controller=controller; self.progress=controller.progress; self.content=content
  }
  private func publish() {
    if visible && sceneActive { progress.update(offset: offset, extent: extent) }
  }
  public var body: some View {
    ScrollView {
      content().coordinateSpace(name: controller?.coordinateSpace ?? progressSpace)
      .environment(\.joltScrollSpace, controller?.coordinateSpace)
      .onPreferenceChange(ScrollAnchors.self) { anchors in controller?.updateAnchors(anchors) }
      .background(
        ScrollProbe(controller: controller) { offset, extent in
          self.offset = offset
          self.extent = extent
          publish()
        }.frame(width: 0, height: 0))
    }
    .onAppear {
      visible = true
      controller?.appReducedMotion=reducedMotion
      if sceneActive { controller?.resume() }
      publish()
    }.onDisappear { visible = false; controller?.suspend() }
    .onChange(of: sceneActive) { _, active in
      if visible && active { controller?.resume() } else { controller?.suspend() }
      publish()
    }
    .onChange(of: reducedMotion) { _, value in controller?.appReducedMotion=value }
    .modifier(JoltActivityProvider($sceneActive))
  }
}
public enum JoltScrollRole: Sendable {
  case decorative
  /// Only x/y remain linked under Reduce Motion; scale, rotation and shadow stay at `from`.
  case structuralTranslation
  /// The entire pose carries layout state and remains linked under Reduce Motion.
  case structuralPose
}
func scrollChannels(from: JoltPose, to: JoltPose, progress: Double, reduced: Bool, role: JoltScrollRole) -> JoltDepthChannels {
  var channels=JoltDepthChannels(from).mixed(with: .init(to), reduced && role != .structuralPose ? 0 : progress)
  if reduced && role == .structuralTranslation {
    channels.storage[0]=from.x+(to.x-from.x)*progress
    channels.storage[1]=from.y+(to.y-from.y)*progress
  }
  return channels
}
private struct ScrollMotion: ViewModifier {
  @ObservedObject var source: JoltScrollProgress
  let from: JoltPose, to: JoltPose
  let shadowColor: Color
  let role: JoltScrollRole
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    let p = source.progress
    let transform = (reduced || appReduced) && role != .structuralPose ? 0 : p
    return content.modifier(
      JoltShadowEffect(
        channels: JoltShadowChannels(from.shadow).mixed(with: .init(to.shadow), transform),
        color: shadowColor)
    )
    .modifier(
      JoltDepthModifier(channels: scrollChannels(from: from, to: to, progress: p, reduced: reduced || appReduced, role: role))
    )
    .opacity(from.opacity + (to.opacity - from.opacity) * p).transaction { $0.animation = nil }
  }
}
extension View {
  /// Declarative progress mapping; decorative transforms and the shadow stay at `from` under
  /// Reduce Motion. Channels compose in the shared order: scale, rotateX, rotateY, rotate, translation.
  public func joltScrollLinked(
    _ source: JoltScrollProgress, from: JoltPose = .identity, to: JoltPose,
    shadowColor: Color = .black, role: JoltScrollRole = .decorative
  ) -> some View {
    modifier(ScrollMotion(source: source, from: from, to: to, shadowColor: shadowColor, role: role))
  }
}
