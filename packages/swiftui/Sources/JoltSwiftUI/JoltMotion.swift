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
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.scenePhase) private var phase
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    content
      .scaleEffect(x: pose.scaleX, y: pose.scaleY)
      .rotationEffect(.degrees(pose.rotate))
      .offset(x: pose.x, y: pose.y)
      .animation(
        reduced || appReduced || phase != .active ? nil : transition.animation,
        value: pose.transform
      )
      .opacity(pose.opacity)
      .animation(phase == .active ? opacityTransition.animation : nil, value: pose.opacity)
  }
}

extension View {
  /// Request reduced motion for this subtree. Never overrides the system accessibility preference.
  public func joltReduceMotion(_ enabled: Bool) -> some View {
    environment(\.joltReduceMotion, enabled)
  }

  /// Finite state-driven motion. SwiftUI owns interruption and removal; Jolt adds no timer or JS runtime.
  /// Transforms settle immediately under Reduce Motion; opacity retains its finite transition.
  public func joltMotion(
    to pose: JoltPose, transition: JoltTransition = .spring(.smooth), opacity: JoltTransition? = nil
  ) -> some View {
    modifier(
      MotionModifier(pose: pose, transition: transition, opacityTransition: opacity ?? transition))
  }
  /// A supported shared Jolt recipe. `active` selects its endpoint, not structural presence.
  public func joltPreset(
    _ preset: JoltPreset, active: Bool, parameters: JoltPresetParameters = try! .init()
  ) -> some View {
    let recipe = preset.recipe(parameters)
    return modifier(
      MotionModifier(
        pose: active ? recipe.to : recipe.from, transition: recipe.transformTransition,
        opacityTransition: recipe.opacityTransition))
  }
}
