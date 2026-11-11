import JoltCore
import SwiftUI

extension View {
  /// SwiftUI namespace ownership: one source per ID. Both endpoints must share the namespace/tree.
  /// Navigation across separate windows or removed trees needs application-owned overlay coordination.
  public func joltSharedLayout<ID: Hashable>(
    _ id: ID, in namespace: Namespace.ID, properties: MatchedGeometryProperties = .frame,
    anchor: UnitPoint = .center, isSource: Bool = true
  ) -> some View {
    matchedGeometryEffect(
      id: id, in: namespace, properties: properties, anchor: anchor, isSource: isSource)
  }
  /// Animate a layout change with SwiftUI execution; reduced motion/scene suspension settles immediately.
  public func joltLayout<Value: Equatable>(
    value: Value, transition: JoltTransition = .spring(.smooth)
  ) -> some View {
    modifier(LayoutModifier(value: value, transition: transition))
  }
}
private struct LayoutModifier<Value: Equatable>: ViewModifier {
  let value: Value, transition: JoltTransition
  @JoltSceneActivity private var sceneActive
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    content.animation(
      sceneActive && !reduced && !appReduced ? transition.animation : nil, value: value)
    .modifier(JoltActivityProvider($sceneActive))
  }
}
