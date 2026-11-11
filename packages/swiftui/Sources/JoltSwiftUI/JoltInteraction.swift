import JoltCore
import SwiftUI

/// A native ButtonStyle: the system retains keyboard, accessibility, disabled and action semantics.
public struct JoltPressStyle: ButtonStyle {
  public var pressed: JoltPose
  public var hovered: JoltPose
  public var transition: JoltTransition
  public var shadowColor: Color
  public init(
    pressed: JoltPose = try! .init(scale: 0.96), hovered: JoltPose = try! .init(scale: 1.03),
    transition: JoltTransition = .spring(.snappy), shadowColor: Color = .black
  ) {
    self.pressed = pressed
    self.hovered = hovered
    self.transition = transition
    self.shadowColor = shadowColor
  }
  public func makeBody(configuration: Configuration) -> some View {
    configuration.label.modifier(PressContent(isPressed: configuration.isPressed, style: self))
  }
  private struct PressContent: ViewModifier {
    let isPressed: Bool
    let style: JoltPressStyle
    @State private var hovering = false
    @Environment(\.isEnabled) private var enabled
    @JoltSceneActivity private var sceneActive
    func body(content: Content) -> some View {
      content.contentShape(Rectangle()).joltMotion(
        to: enabled && sceneActive
          ? (isPressed ? style.pressed : hovering ? style.hovered : .identity) : .identity,
        transition: style.transition, shadowColor: style.shadowColor,
        consumesPerspective: [style.pressed, style.hovered].contains {
          $0.rotateX != 0 || $0.rotateY != 0
        }
      )
      .onHover { hovering = $0 && enabled && sceneActive }
      .onChange(of: sceneActive) { _, _ in hovering = false }
      .onChange(of: enabled) { _, _ in hovering = false }
      .onDisappear { hovering = false }
      .modifier(JoltActivityProvider($sceneActive))
    }
  }
}

public struct JoltPointerSample: Equatable, Sendable {
  /// -1...1, relative to the untransformed source's local bounds. Origin is top-left.
  public let x: Double
  public let y: Double
  public let active: Bool
  public static let center = Self(x: 0, y: 0, active: false)
}
private struct PointerModifier: ViewModifier {
  let update: @MainActor (JoltPointerSample) -> Void
  @State private var size: CGSize = .zero
  @State private var location: CGPoint?
  @JoltSceneActivity private var sceneActive
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  private func publish() {
    guard sceneActive, !reduced, !appReduced, size.width > 0, size.height > 0, let location
    else {
      update(.center)
      return
    }
    update(
      .init(
        x: min(1, max(-1, location.x / size.width * 2 - 1)),
        y: min(1, max(-1, location.y / size.height * 2 - 1)), active: true))
  }
  func body(content: Content) -> some View {
    content.background(
      GeometryReader { geometry in
        Color.clear.onAppear {
          size = geometry.size
          publish()
        }.onChange(of: geometry.size) { _, new in
          size = new
          publish()
        }
      }
    ).onContinuousHover { event in
      switch event {
      case .active(let point): location = point
      case .ended: location = nil
      }
      publish()
    }.onChange(of: sceneActive) { _, _ in
      location = nil
      publish()
    }
    .onChange(of: reduced || appReduced) { _, _ in publish() }
    .onDisappear {
      location = nil
      update(.center)
    }
    .modifier(JoltActivityProvider($sceneActive))
  }
}
extension View {
  /// Mouse/trackpad/hover-capable input. Touch-only devices remain centered; this does not capture drag.
  public func joltPointerFollow(_ update: @escaping @MainActor (JoltPointerSample) -> Void)
    -> some View
  {
    modifier(PointerModifier(update: update))
  }
}
