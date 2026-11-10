import JoltSwiftUI
import SwiftUI

private let accent = Color(red: 0.86, green: 1, blue: 0.48)
private let backdrop = Color(red: 0.06, green: 0.08, blue: 0.12)
private func stage<Content: View>(height: CGFloat, @ViewBuilder content: () -> Content) -> some View
{
  ZStack {
    RoundedRectangle(cornerRadius: 20).fill(.white.opacity(0.05))
    content()
  }.frame(height: height)
}

private struct PresenceCard: View {
  let enabled: Bool
  let action: () -> Void
  @State private var identity = UUID().uuidString
  var body: some View {
    Button(action: action) {
      Label("Press me", systemImage: "sparkles").font(.headline).padding(28).background(
        accent, in: RoundedRectangle(cornerRadius: 20)
      ).foregroundStyle(.black)
    }.buttonStyle(JoltPressStyle()).disabled(!enabled).accessibilityIdentifier("presence-card")
      .accessibilityValue(identity)
  }
}
struct InteractionLab: View {
  @State private var present = true
  @State private var reentry: Task<Void, Never>?
  @State private var taps = 0
  @State private var reduced = false
  @State private var enabled = true
  @State private var pointer: JoltPointerSample = .center
  @StateObject private var drag = InteractionLab.makeDrag()
  // Keep throwing setup out of StateObject's autoclosure: Swift 6.1 crashes lowering it.
  @MainActor private static func makeDrag() -> JoltDragModel {
    let bounds = try! JoltDragBounds(x: -100...100, y: 0...0)
    return try! JoltDragModel(
      bounds: bounds, snaps: [.init(x: -100, y: 0), .zero, .init(x: 100, y: 0)])
  }
  private var entry: JoltSwiftUI.JoltRecipe {
    JoltPreset.fadeInUp.recipe(try! .init(distance: 45, duration: 500))
  }
  private var exit: JoltSwiftUI.JoltRecipe {
    JoltPreset.fadeOutRight.recipe(try! .init(distance: 70, duration: 650))
  }
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        Text("JOLT · INTERACTION").font(.caption.bold()).tracking(2).foregroundStyle(accent)
        Text("Stay in motion.").font(.system(size: 30, weight: .bold, design: .rounded))
        Text("Presence · press · pointer · bounded drag").font(.subheadline).foregroundStyle(
          .secondary)
        stage(height: 120) {
          JoltPresence(present, enter: entry, leave: exit) {
            PresenceCard(enabled: enabled) { taps += 1 }
          }
        }
        HStack {
          Button(present ? "Exit" : "Reenter") {
            reentry?.cancel()
            present.toggle()
          }.accessibilityIdentifier("presence-toggle")
          Button(enabled ? "Disable" : "Enable") { enabled.toggle() }.accessibilityIdentifier(
            "press-disable")
          Text("Actions: \(taps)").font(.caption.monospacedDigit()).accessibilityIdentifier(
            "presence-count")
        }.buttonStyle(.bordered)
        Button("Exit + reenter") {
          reentry?.cancel()
          present = false
          reentry = Task { @MainActor in
            do { try await Task.sleep(for: .milliseconds(180)) } catch { return }
            present = true
          }
        }.buttonStyle(.bordered).accessibilityIdentifier("presence-interrupt")
        stage(height: 110) {
          Circle().fill(.indigo).frame(width: 64, height: 64)
            .joltMotion(
              to: try! JoltPose(x: pointer.x * 75, y: pointer.y * 25), transition: .spring(.snappy)
            )
            .accessibilityIdentifier("pointer-dot")
        }.joltPointerFollow { pointer = $0 }.accessibilityIdentifier("pointer-region")
        Text(
          "Pointer \(pointer.x,specifier:"%.2f"), \(pointer.y,specifier:"%.2f") · \(pointer.active ? "active" : "centered")"
        )
        .font(.caption.monospacedDigit()).accessibilityIdentifier("pointer-status")
        Text("Mouse/trackpad on Mac or iPad. Touch-only input stays centered.").font(.caption)
          .foregroundStyle(.secondary)
        stage(height: 120) {
          HStack(spacing: 74) {
            ForEach(0..<3) { _ in
              Circle().stroke(.white.opacity(0.2), lineWidth: 2).frame(width: 26, height: 26)
            }
          }
          RoundedRectangle(cornerRadius: 20).fill(accent).frame(width: 66, height: 66)
            .overlay(Image(systemName: "hand.draw.fill").foregroundStyle(.black))
            .joltDrag(drag).accessibilityLabel("Drag card").accessibilityIdentifier("drag-card")
        }
        HStack {
          Button("Snap left") { drag.move(to: .init(x: -100, y: 0), reducedMotion: reduced) }
            .accessibilityIdentifier("drag-left")
          Button("Snap right") { drag.move(to: .init(x: 100, y: 0), reducedMotion: reduced) }
            .accessibilityIdentifier("drag-right")
          Text("x: \(drag.position.x,specifier:"%.0f")").font(.caption.monospacedDigit())
            .accessibilityIdentifier("drag-status")
        }.buttonStyle(.bordered)
        Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("lab-reduce")
        Text(
          "Exit retains identity. Reentry cancels removal. Drag resumes from its sampled position."
        ).font(.caption).foregroundStyle(.secondary)
      }.padding(24)
    }.background(backdrop).preferredColorScheme(.dark).joltReduceMotion(reduced).onDisappear {
      reentry?.cancel()
    }
  }
}

@MainActor final class CompositionModel: ObservableObject {
  let scope = JoltScope()
  let x: JoltMotionValue
  let bars: [JoltMotionValue]
  let inspector: JoltInspector
  private var observations: [JoltObservation] = []
  private var timeline: JoltTimeline?
  @Published var cue = "Ready"
  @Published var cueCount = 0
  init() {
    let owner = scope
    x = try! owner.value(0)
    bars = (0..<3).map { _ in try! owner.value(0) }
    inspector = try! JoltInspector(development: true, capacity: 40)
    observations = [
      try! inspector.watch(x, label: "card.x"), try! inspector.watch(scope, label: "composition"),
    ]
  }
  func move(_ target: Double, reduced: Bool) {
    try! x.animate(to: target, transition: .spring(.bouncy), reducedMotion: reduced)
  }
  func play(reduced: Bool) {
    if let timeline { scope.release(timeline) }
    bars.forEach { try! $0.set(0) }
    cue = "Waiting for bite"
    cueCount = 0
    let transition = try! JoltTransition.tween(milliseconds: 500)
    timeline = try! scope.retain(
      JoltTimeline(
        tracks: bars.enumerated().map {
          .init($0.element, to: 1, at: Double($0.offset) * 200, transition: transition)
        },
        cues: [
          .init("bite", at: 350) { [weak self] name in
            self?.cue = name
            self?.cueCount += 1
            return JoltEffect { [weak self] in self?.cue = "Effect cleaned up" }
          },
          .init("rest", at: 4000) { [weak self] name in
            self?.cue = name
            self?.cueCount += 1
            return nil
          },
        ], reducedMotion: reduced))
  }
  func cancel() {
    timeline?.cancel()
    cue = "Cancelled · later cues suppressed"
  }
  func sequence(reduced: Bool) {
    if let timeline { scope.release(timeline) }
    bars.forEach { try! $0.set(0) }
    timeline = try! scope.retain(
      JoltTimeline.sequence(
        bars.map { .init($0, to: 1, transition: try! .tween(milliseconds: 350)) }, gap: 80,
        reducedMotion: reduced))
    cue = "Sequential stages"
  }
}
struct CompositionLab: View {
  @StateObject private var model = CompositionModel()
  @State private var reduced = false
  @State private var expanded = false
  @Namespace private var layout
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        Text("JOLT · COMPOSITION").font(.caption.bold()).tracking(2).foregroundStyle(accent)
        Text("Values with ownership.").font(.system(size: 28, weight: .bold, design: .rounded))
        stage(height: 105) {
          RoundedRectangle(cornerRadius: 20).fill(accent).frame(width: 66, height: 66).joltBind(
            .x, to: model.x
          ).accessibilityElement(children: .ignore).accessibilityLabel("Reactive value")
            .accessibilityIdentifier("value-card")
        }
        HStack {
          Button("Spring right") { model.move(100, reduced: reduced) }.accessibilityIdentifier(
            "value-right")
          Button("Interrupt left") { model.move(-100, reduced: reduced) }.accessibilityIdentifier(
            "value-left")
        }.buttonStyle(.bordered)
        HStack(spacing: 22) {
          ForEach(model.bars.indices, id: \.self) { index in
            RoundedRectangle(cornerRadius: 12).fill(.indigo).frame(width: 62, height: 54).joltBind(
              .opacity, to: model.bars[index]
            ).accessibilityElement(children: .ignore).accessibilityLabel("Stage \(index)")
              .accessibilityIdentifier("stage-\(index)")
          }
        }.frame(maxWidth: .infinity).frame(height: 62)
        HStack {
          Button("Stagger + cues") { model.play(reduced: reduced) }.accessibilityIdentifier(
            "stagger-play")
          Button("Sequence") { model.sequence(reduced: reduced) }.accessibilityIdentifier(
            "sequence-play")
          Button("Cancel") { model.cancel() }.accessibilityIdentifier("timeline-cancel")
        }.buttonStyle(.bordered)
        Text("\(model.cue) · Events: \(model.cueCount)").font(.caption.monospacedDigit())
          .accessibilityIdentifier("cue-status")
        stage(height: 155) {
          if expanded {
            HStack {
              Spacer()
              RoundedRectangle(cornerRadius: 22).fill(accent).frame(width: 200, height: 125)
                .joltSharedLayout("shared-card", in: layout).overlay(
                  Text("Expanded").foregroundStyle(.black))
              Spacer().frame(width: 20)
            }
          } else {
            HStack {
              Spacer().frame(width: 20)
              RoundedRectangle(cornerRadius: 22).fill(accent).frame(width: 80, height: 80)
                .joltSharedLayout("shared-card", in: layout).overlay(
                  Text("Card").foregroundStyle(.black))
              Spacer()
            }
          }
        }.joltLayout(value: expanded)
        Button(expanded ? "Collapse layout" : "Expand layout") { expanded.toggle() }.buttonStyle(
          .bordered
        ).accessibilityIdentifier("layout-toggle")
        Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("lab-reduce")
        JoltInspectorPanel(model.inspector).accessibilityIdentifier("inspector-panel")
        Text("The inspector shows sampled scalar values, not GPU presentation timing.").font(
          .caption
        ).foregroundStyle(.secondary)
      }.padding(24)
    }.background(backdrop).preferredColorScheme(.dark).joltReduceMotion(reduced).joltScope(
      model.scope)
  }
}
struct ScrollLab: View {
  @StateObject private var progress = ScrollLab.makeProgress()
  @MainActor private static func makeProgress() -> JoltScrollProgress {
    try! JoltScrollProgress(range: 0...450)
  }
  @State private var reduced = false
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("JOLT · SCROLL").font(.caption.bold()).tracking(2).foregroundStyle(accent)
      Text("Motion follows progress.").font(.system(size: 28, weight: .bold, design: .rounded))
      Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("lab-reduce")
      Text(
        "Progress: \(progress.progress,specifier:"%.2f") · Offset: \(progress.offset,specifier:"%.0f")"
      ).font(.caption.monospacedDigit()).accessibilityIdentifier("scroll-status")
      ZStack {
        RoundedRectangle(cornerRadius: 24).fill(.indigo)
        VStack(spacing: 10) {
          Image(systemName: "mountain.2.fill").font(.largeTitle)
          Text("Scroll-linked header").font(.headline)
        }
        .joltScrollLinked(progress, to: try! .init(y: -25, scale: 0.8, opacity: 0.5))
        .accessibilityElement(children: .combine).accessibilityIdentifier("scroll-header")
      }.frame(height: 135)
      JoltScrollView(progress: progress) {
        VStack(spacing: 14) {
          ForEach(0..<12) { index in
            HStack {
              Text(String(format: "%02d", index + 1)).font(.title.monospacedDigit())
                .foregroundStyle(accent)
              Text("A shared motion recipe")
              Spacer()
            }.padding(22).frame(height: 92).background(
              .white.opacity(0.06), in: RoundedRectangle(cornerRadius: 18))
          }
        }.padding(.vertical, 10)
      }.accessibilityIdentifier("motion-scroll")
    }.padding(24).background(backdrop).preferredColorScheme(.dark).joltReduceMotion(reduced)
  }
}
