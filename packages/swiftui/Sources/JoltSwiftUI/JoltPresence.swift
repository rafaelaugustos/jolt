import JoltCore
import SwiftUI

/// Retains one SwiftUI content identity until exit actually completes. Reentry invalidates removal.
public struct JoltPresence<Content: View>: View {
  public let isPresent: Bool
  public let enter: JoltRecipe
  public let leave: JoltRecipe
  private let content: () -> Content
  @State private var retained: Bool
  @State private var pose: JoltPose
  @State private var epoch = UUID()
  @Environment(\.scenePhase) private var phase
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  public init(
    _ isPresent: Bool, enter: JoltRecipe = JoltPreset.fadeInUp.recipe(),
    leave: JoltRecipe = JoltPreset.fadeOut.recipe(), @ViewBuilder content: @escaping () -> Content
  ) {
    self.isPresent = isPresent
    self.enter = enter
    self.leave = leave
    self.content = content
    _retained = State(initialValue: isPresent)
    _pose = State(initialValue: enter.from)
  }
  public var body: some View {
    Group {
      if retained {
        content().scaleEffect(x: pose.scaleX, y: pose.scaleY).rotationEffect(.degrees(pose.rotate))
          .offset(x: pose.x, y: pose.y)
          .opacity(pose.opacity)
          .animation(
            phase == .active ? (isPresent ? enter : leave).opacityTransition.animation : nil,
            value: pose.opacity
          )
          .allowsHitTesting(isPresent).accessibilityHidden(!isPresent)
      }
    }
    .onAppear { reconcile() }
    .onChange(of: isPresent) { _, _ in reconcile() }
    .onChange(of: phase) { _, new in if new != .active { reconcile() } }
    .onChange(of: reduced || appReduced) { _, _ in reconcile() }
    .onDisappear { epoch = UUID() }
  }
  private func reconcile() {
    let token = UUID()
    epoch = token
    let recipe = isPresent ? enter : leave
    if isPresent && !retained {
      var transaction = Transaction(animation: nil)
      transaction.disablesAnimations = true
      withTransaction(transaction) {
        pose = enter.from
        retained = true
      }
    }
    guard retained else { return }
    let target = recipe.to
    if phase != .active || reduced || appReduced {
      var transaction = Transaction(animation: nil)
      transaction.disablesAnimations = true
      withTransaction(transaction) {
        pose = target
        if !isPresent { retained = false }
      }
      return
    }
    // Schedule after insertion, retaining the same content identity on interrupted exit.
    Task { @MainActor in
      await Task.yield()
      guard epoch == token else { return }
      withAnimation(recipe.transformTransition.animation, completionCriteria: .removed) {
        pose = target
      } completion: {
        guard epoch == token, !isPresent else { return }
        retained = false
      }
    }
  }
}
