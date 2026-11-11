import JoltCore
import SwiftUI

@MainActor public final class JoltScrollProgress: ObservableObject {
  @Published public private(set) var offset = 0.0
  @Published public private(set) var progress = 0.0
  public private(set) var range: ClosedRange<Double>?
  public init(range: ClosedRange<Double>? = nil) throws {
    if let range {
      guard range.lowerBound.isFinite, range.upperBound.isFinite,
        range.upperBound > range.lowerBound
      else { throw JoltError.invalidMotion }
    }
    self.range = range
  }
  public func update(offset: Double, extent: Double) {
    guard offset.isFinite, extent.isFinite else { return }
    let start = range?.lowerBound ?? 0
    let end = range?.upperBound ?? max(0, extent)
    let normalized = offset == 0 ? 0 : offset
    let next = end > start ? min(1, max(0, (normalized - start) / (end - start))) : 0
    if self.offset != normalized { self.offset = normalized }
    if progress != next { progress = next }
  }
}
/// Vertical scroll geometry in points. The optional range overrides full-content progress.
public struct JoltScrollView<Content: View>: View {
  @ObservedObject private var progress: JoltScrollProgress
  private let content: () -> Content
  @State private var offset = 0.0
  @State private var extent = 0.0
  @State private var visible = false
  @JoltSceneActivity private var sceneActive
  public init(progress: JoltScrollProgress, @ViewBuilder content: @escaping () -> Content) {
    self.progress = progress
    self.content = content
  }
  private func publish() {
    if visible && sceneActive { progress.update(offset: offset, extent: extent) }
  }
  public var body: some View {
    ScrollView {
      content().background(
        ScrollProbe { offset, extent in
          self.offset = offset
          self.extent = extent
          publish()
        }.frame(width: 0, height: 0))
    }
    .onAppear {
      visible = true
      publish()
    }.onDisappear { visible = false }
    .onChange(of: sceneActive) { _, _ in publish() }
    .modifier(JoltActivityProvider($sceneActive))
  }
}
private struct ScrollMotion: ViewModifier {
  @ObservedObject var source: JoltScrollProgress
  let from: JoltPose, to: JoltPose
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    let p = source.progress
    let transform = reduced || appReduced ? 0 : p
    func mix(_ a: Double, _ b: Double, _ p: Double) -> Double { a + (b - a) * p }
    return content.offset(x: mix(from.x, to.x, transform), y: mix(from.y, to.y, transform))
      .scaleEffect(
        x: mix(from.scaleX, to.scaleX, transform), y: mix(from.scaleY, to.scaleY, transform)
      )
      .rotationEffect(.degrees(mix(from.rotate, to.rotate, transform)))
      .opacity(mix(from.opacity, to.opacity, p)).transaction { $0.animation = nil }
  }
}
extension View {
  /// Declarative progress mapping; decorative transforms stay at `from` under Reduce Motion.
  public func joltScrollLinked(
    _ source: JoltScrollProgress, from: JoltPose = .identity, to: JoltPose
  ) -> some View {
    modifier(ScrollMotion(source: source, from: from, to: to))
  }
}
