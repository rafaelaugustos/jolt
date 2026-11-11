public import JoltCore
import SwiftUI

#if os(macOS)
  import AppKit
#else
  import UIKit
#endif
@MainActor enum JoltAccessibility {
  static var reducedMotion: Bool {
    #if os(macOS)
      NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    #else
      UIAccessibility.isReduceMotionEnabled
    #endif
  }
}
public typealias JoltPose = JoltCore.JoltPose
public typealias JoltTransition = JoltCore.JoltTransition
public typealias JoltPreset = JoltCore.JoltPreset
public typealias JoltSpring = JoltCore.JoltSpring
public typealias JoltEase = JoltCore.JoltEase
public typealias JoltError = JoltCore.JoltError
public typealias JoltPresetParameters = JoltCore.JoltPresetParameters
public typealias JoltDirection = JoltCore.JoltDirection
public typealias JoltRecipe = JoltCore.JoltRecipe

extension JoltTransition {
  var animation: Animation {
    switch kind {
    case .tween(let milliseconds, let curve):
      return .timingCurve(curve[0], curve[1], curve[2], curve[3], duration: milliseconds / 1000)
    case .spring(let mass, let stiffness, let damping):
      return .interpolatingSpring(
        mass: mass, stiffness: stiffness, damping: damping, initialVelocity: 0)
    }
  }
}

private struct JoltReduceMotionKey: EnvironmentKey {
  static let defaultValue = false
}
extension EnvironmentValues {
  var joltReduceMotion: Bool {
    get { self[JoltReduceMotionKey.self] }
    set { self[JoltReduceMotionKey.self] = newValue }
  }
}

private struct MotionModifier: ViewModifier {
  let pose: JoltPose
  let transition: JoltTransition
  let opacityTransition: JoltTransition
  var shadowColor: Color = .black
  var consumesPerspective = true
  @Environment(\.accessibilityReduceMotion) private var reduced
  @JoltSceneActivity private var sceneActive
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    let shadow = JoltShadowChannels(pose.shadow)
    content
      .modifier(JoltShadowEffect(channels: shadow, color: shadowColor))
      .modifier(JoltDepthModifier(channels: .init(pose), consumes: consumesPerspective))
      .animation(
        reduced || appReduced || !sceneActive ? nil : transition.animation,
        value: pose.transform + (0..<4).map { shadow.storage[$0] }
      )
      .opacity(pose.opacity)
      .animation(sceneActive ? opacityTransition.animation : nil, value: pose.opacity)
      .modifier(JoltActivityProvider($sceneActive))
  }
}

extension View {
  /// Request reduced motion for this subtree. Never overrides the system accessibility preference.
  public func joltReduceMotion(_ enabled: Bool) -> some View {
    environment(\.joltReduceMotion, enabled)
  }

  /// Finite state-driven motion. SwiftUI owns interruption and removal; Jolt adds no timer or JS runtime.
  /// Transforms and the shadow settle immediately under Reduce Motion; opacity keeps its transition.
  /// The pose's shadow is drawn in `shadowColor`, whose alpha multiplies the shadow's opacity.
  public func joltMotion(
    to pose: JoltPose, transition: JoltTransition = .spring(.smooth),
    opacity: JoltTransition? = nil, shadowColor: Color = .black
  ) -> some View {
    modifier(
      MotionModifier(
        pose: pose, transition: transition, opacityTransition: opacity ?? transition,
        shadowColor: shadowColor))
  }
  func joltMotion(
    to pose: JoltPose, transition: JoltTransition, shadowColor: Color, consumesPerspective: Bool
  ) -> some View {
    modifier(
      MotionModifier(
        pose: pose, transition: transition, opacityTransition: transition,
        shadowColor: shadowColor, consumesPerspective: consumesPerspective))
  }
  /// A supported shared Jolt recipe. `active` selects its endpoint, not structural presence.
  public func joltPreset(
    _ preset: JoltPreset, active: Bool, parameters: JoltPresetParameters = .none
  ) -> some View {
    let recipe = preset.recipe(parameters)
    return modifier(
      MotionModifier(
        pose: active ? recipe.to : recipe.from, transition: recipe.transformTransition,
        opacityTransition: recipe.opacityTransition))
  }
}
