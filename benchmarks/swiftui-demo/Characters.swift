import Combine
import JoltSwiftUI
import SwiftUI

private let accent = Color(red: 0.86, green: 1, blue: 0.48)
private let backdrop = Color(red: 0.06, green: 0.08, blue: 0.12)
@MainActor private func makeGestureModel() -> JoltGestureModel {
  try! .init(bounds: .init(x: -100...100, y: -70...70), scale: 0.6...2)
}
@MainActor private final class KeyframeModel: ObservableObject {
  let scope = JoltScope(), value: JoltMotionValue
  @Published var timeline: JoltTimeline?
  init() { value = try! scope.value(0) }
  func start(reduced: Bool) {
    if let timeline { scope.release(timeline) }
    timeline = try! scope.retain(
      JoltTimeline.keyframes(
        [
          .init(
            value,
            [
              try! .init(-100, at: 0, ease: .easeIn), try! .init(100, at: 0.6, ease: .easeOut),
              try! .init(0, at: 1),
            ])
        ], duration: 1800, iterations: 2, autoreverses: true, reducedMotion: reduced))
  }
}
private struct KeyStatus: View {
  @ObservedObject var timeline: JoltTimeline
  var body: some View {
    Text("Keyframes: \(timeline.state.rawValue) · \(timeline.progress,specifier:"%.2f")")
      .accessibilityIdentifier("key-status")
  }
}
private struct GestureStatus: View {
  @ObservedObject var model: JoltGestureModel
  var body: some View {
    Text(
      "x \(model.position.x,specifier:"%.0f") · scale \(model.position.scale,specifier:"%.2f") · angle \(model.position.rotate,specifier:"%.0f")"
    )
    .font(.caption.monospacedDigit()).accessibilityIdentifier("gesture-status")
  }
}
struct KeyGestureLab: View {
  @StateObject private var model = KeyframeModel()
  @StateObject private var gesture = makeGestureModel()
  @State private var reduced = false
  @State private var gestureShown = true
  @State private var taps = 0
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("JOLT · KEYFRAMES + GESTURES").font(.caption.bold()).tracking(2).foregroundStyle(accent)
      Text("Compose the movement.").font(.system(size: 29, weight: .bold, design: .rounded))
      ZStack {
        RoundedRectangle(cornerRadius: 20).fill(.white.opacity(0.05))
        Capsule().fill(accent).frame(width: 70, height: 48).joltBind(.x, to: model.value)
          .accessibilityLabel("Keyframe marker").accessibilityIdentifier("key-marker")
      }.frame(height: 100)
      HStack {
        Button("Play twice") { model.start(reduced: reduced) }.accessibilityIdentifier("key-play")
        Button("Pause") { model.timeline?.pause() }.accessibilityIdentifier("key-pause")
        Button("Resume") { model.timeline?.play() }.accessibilityIdentifier("key-resume")
      }.buttonStyle(.bordered)
      if let timeline = model.timeline {
        KeyStatus(timeline: timeline)
      } else {
        Text("Keyframes: ready").accessibilityIdentifier("key-status")
      }
      Text("Drag, pinch and rotate").font(.headline)
      ZStack {
        RoundedRectangle(cornerRadius: 20).fill(.white.opacity(0.05))
        if gestureShown {
          Button {
            taps += 1
          } label: {
            VStack(spacing: 4) {
              Image(systemName: "arrow.up.right").font(.largeTitle)
              Text("TRANSFORM").font(.caption.bold())
            }
            .frame(width: 110, height: 110).background(
              .indigo, in: RoundedRectangle(cornerRadius: 20))
          }.buttonStyle(.plain).contentShape(Rectangle()).joltGestures(gesture)
            .accessibilityLabel("Transform card").accessibilityIdentifier("gesture-card")
        }
      }.frame(height: 260)
      GestureStatus(model: gesture)
      Text("Taps: \(taps)").font(.caption).accessibilityIdentifier("gesture-taps")
      HStack {
        Button("Zoom +") {
          try! gesture.change(
            magnification: 1.25, around: .init(x: gesture.position.x, y: gesture.position.y))
        }.accessibilityIdentifier("gesture-zoom")
        Button("Turn 30°") {
          try! gesture.change(
            rotation: 30, around: .init(x: gesture.position.x, y: gesture.position.y))
        }.accessibilityIdentifier("gesture-turn")
        Button("Reset") { try! gesture.settle(to: .init(), reducedMotion: reduced) }
          .accessibilityIdentifier("gesture-reset")
        Button(gestureShown ? "Hide" : "Mount") { gestureShown.toggle() }.accessibilityIdentifier(
          "gesture-toggle")
      }.buttonStyle(.bordered)
      Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("character-reduce")
      Text("Finite segments · bounded transforms · accessible controls. Apple points and degrees.")
        .font(.caption).foregroundStyle(.secondary)
    }.padding(24).background(backdrop).preferredColorScheme(.dark).joltReduceMotion(reduced)
      .joltScope(model.scope).onDisappear { gesture.dispose() }
  }
}
@MainActor private final class TransferModel: ObservableObject {
  let scope = JoltScope()
  let reorder: JoltReorderModel
  @Published var status = "Drop: ready"
  @Published var effects = 0
  lazy var drops: JoltDropZones = try! scope.retain(
    JoltDropZones(
      [
        .init("basket", label: "Basket"),
        .init("locked", label: "Locked shelf", priority: 10, accepts: { false }),
      ], onReject: { [weak self] _ in self?.status = "Drop: rejected" },
      onDrop: { [weak self] event in
        self?.status = "Drop: accepted · " + event.id
        self?.effects += 1
        return JoltEffect { [weak self] in self?.effects -= 1 }
      }))
  init() {
    reorder = try! scope.retain(
      JoltReorderModel((1...12).map { "Item \($0)" }, rowHeight: 50, spacing: 4))
  }
}
private struct OrderStatus: View {
  @ObservedObject var model: JoltReorderModel
  var body: some View {
    Text("Order: " + model.keys.prefix(4).joined(separator: ", ")).font(.caption)
      .accessibilityIdentifier("order-status")
  }
}
struct TransferLab: View {
  @StateObject private var model = TransferModel()
  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("JOLT · REORDER + DROP").font(.caption.bold()).tracking(2).foregroundStyle(accent)
      Text("Move with intent.").font(.system(size: 30, weight: .bold, design: .rounded))
      HStack(spacing: 16) {
        Text("GIFT").font(.headline).frame(width: 70, height: 60).background(
          accent, in: RoundedRectangle(cornerRadius: 14)
        )
        .foregroundStyle(.black).joltDropSource(model.drops).accessibilityIdentifier("drop-source")
        .zIndex(1)
        Spacer(minLength: 0)
        VStack(spacing: 12) {
          Text("BASKET").font(.caption.bold()).frame(width: 130, height: 65).background(
            .indigo, in: RoundedRectangle(cornerRadius: 14)
          )
          .joltDropTarget("basket", in: model.drops).accessibilityIdentifier("drop-basket")
          Text("LOCKED").font(.caption.bold()).frame(width: 130, height: 65).background(
            .pink.opacity(0.35), in: RoundedRectangle(cornerRadius: 14)
          )
          .joltDropTarget("locked", in: model.drops).accessibilityIdentifier("drop-locked")
        }
      }.frame(height: 180)
      Text(model.status + " · effects \(model.effects)").font(.caption).accessibilityIdentifier(
        "drop-status")
      HStack {
        Button("Send to basket") { _ = try! model.drops.request("basket") }.accessibilityIdentifier(
          "drop-send")
        Button("Return") {
          model.drops.cancel()
          model.status = "Drop: returned"
        }.accessibilityIdentifier("drop-return")
      }.buttonStyle(.bordered)
      Text("Reorder by handle").font(.headline)
      JoltReorderList(model.reorder) { key in
        Text(key).padding(.leading, 12).frame(maxWidth: .infinity, alignment: .leading)
          .accessibilityIdentifier("row-" + key)
      }.frame(height: 220).background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 16))
      OrderStatus(model: model.reorder)
      HStack {
        Button("First item down") {
          if let first = model.reorder.keys.first { model.reorder.move(first, to: 1) }
        }.accessibilityIdentifier("order-down")
        Button("Reset list") { try! model.reorder.replace((1...12).map { "Item \($0)" }) }
          .accessibilityIdentifier("order-reset")
      }.buttonStyle(.bordered)
      Text("12 realized rows. Edge scrolling, stable IDs and keyboard/accessibility actions.").font(
        .caption
      ).foregroundStyle(.secondary)
    }.padding(24).background(backdrop).preferredColorScheme(.dark).joltScope(model.scope)
  }
}
@MainActor private final class CharacterModel: ObservableObject {
  let scope = JoltScope(), rig: JoltRig, particles: JoltParticles, cueValue: JoltMotionValue
  private var timeline: JoltTimeline?
  @Published var status = "Pose: rest"
  init() {
    rig = try! scope.retain(
      JoltRig(
        .init(
          parts: [
            "body": .init(width: 110, height: 130, rest: .init([.x: 70, .y: 100])),
            "head": .init(
              parent: "body", width: 100, height: 95, rest: .init([.x: 5, .y: -65]),
              rotation: -20...20),
            "arm": .init(
              parent: "body", width: 95, height: 28, pivotX: 0, pivotY: 0.5,
              rest: .init([.x: 85, .y: 38]), rotation: -90...30),
          ],
          poses: [
            "rest": [:], "wave": ["arm": .init([.rotate: -65]), "head": .init([.rotate: -12])],
            "bow": ["body": .init([.y: 112, .rotate: 8]), "head": .init([.rotate: 16])],
          ],
          sockets: ["hand": .init(part: "arm", x: 0.95, y: 0.5, relative: true)])))
    particles = try! scope.retain(JoltParticles(.confetti))
    cueValue = try! scope.value(0)
  }
  func pose(_ name: String, reduced: Bool) {
    try! rig.pose(name, reducedMotion: reduced)
    status = "Pose: " + name
  }
  func blend(reduced: Bool) {
    try! rig.blend([.init("wave", weight: 0.5), .init("bow", weight: 0.5)], reducedMotion: reduced)
    status = "Pose: blended"
  }
  func celebrate(reduced: Bool) {
    if let timeline { scope.release(timeline) }
    try! cueValue.set(0)
    timeline = try! scope.retain(
      JoltTimeline(
        tracks: [.init(cueValue, to: 1, transition: try! .tween(milliseconds: 4000))],
        cues: [
          .init("celebrate", at: 200) { [weak self] _ in
            guard let self else { return nil }
            try! self.particles.burst(count: 100, reducedMotion: reduced)
            return JoltEffect { [weak self] in self?.particles.cancel() }
          }
        ], reducedMotion: reduced, cueLatePolicy: .catchUp))
  }
  func emit(reduced: Bool) {
    if let timeline { scope.release(timeline) }
    timeline = nil
    try! particles.emit(rate: 24, duration: 1400, seed: 7, reducedMotion: reduced)
    status = "Emitter: finite"
  }
  func cancel() {
    timeline?.cancel()
    particles.cancel()
    status = "Effect: cancelled"
  }
  func celebrateThenCancel(reduced: Bool) {
    celebrate(reduced: reduced)
    let pending = timeline
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
      guard let self, self.timeline === pending else { return }
      self.cancel()
    }
  }
}
private struct ParticleStatus: View {
  @ObservedObject var model: JoltParticles
  @State private var peak = 0
  var body: some View {
    Text("Particles: \(model.particles.count) · \(model.state.rawValue) · peak \(peak)").font(
      .caption.monospacedDigit()
    ).accessibilityIdentifier("particle-status")
      .onChange(of: model.state) { old, new in
        if new == .running && old != .running { peak = model.particles.count }
      }
      .onChange(of: model.particles.count) { _, count in peak = max(peak, count) }
  }
}
struct CharacterLab: View {
  @StateObject private var model = CharacterModel()
  @State private var reduced = false
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("JOLT · RIG + PARTICLES").font(.caption.bold()).tracking(2).foregroundStyle(accent)
      Text("A little personality.").font(.system(size: 30, weight: .bold, design: .rounded))
      ZStack(alignment: .topLeading) {
        RoundedRectangle(cornerRadius: 20).fill(.white.opacity(0.05))
        JoltRigView(model.rig, accessibilityLabel: "Articulated companion") { name in
          if name == "head" {
            ZStack {
              RoundedRectangle(cornerRadius: 35).fill(accent)
              HStack(spacing: 28) {
                Circle().frame(width: 9, height: 13)
                Circle().frame(width: 9, height: 13)
              }.foregroundStyle(.black)
            }
          } else {
            RoundedRectangle(cornerRadius: name == "arm" ? 14 : 35).fill(
              name == "arm" ? accent : .indigo)
          }
        }
        Text("✿").font(.system(size: 42)).foregroundStyle(.pink).joltRigSocket(
          "hand", in: model.rig
        ).accessibilityIdentifier("rig-flower")
        JoltParticlesView(model.particles)
      }.frame(width: 320, height: 330)
      Text(model.status).accessibilityIdentifier("rig-status")
      HStack {
        Button("Wave") { model.pose("wave", reduced: reduced) }.accessibilityIdentifier("rig-wave")
        Button("Blend poses") { model.blend(reduced: reduced) }.accessibilityIdentifier("rig-blend")
        Button("Rest") { model.pose("rest", reduced: reduced) }.accessibilityIdentifier("rig-rest")
      }.buttonStyle(.bordered)
      HStack {
        Button("Celebrate") { model.celebrate(reduced: reduced) }.accessibilityIdentifier(
          "particle-burst")
        Button("Cancel effect") { model.cancel() }.accessibilityIdentifier("particle-cancel")
        Button("Celebrate, cancel") { model.celebrateThenCancel(reduced: reduced) }
          .accessibilityIdentifier("particle-burst-cancel")
        Button("Emit") { model.emit(reduced: reduced) }.accessibilityIdentifier("particle-emit")
      }.buttonStyle(.bordered)
      ParticleStatus(model: model.particles)
      Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("character-reduce")
      Text(
        "One Canvas per renderer. Flower follows the hand socket; effects follow timeline cancellation."
      ).font(.caption).foregroundStyle(.secondary)
    }.padding(24).background(backdrop).preferredColorScheme(.dark).joltReduceMotion(reduced)
      .joltScope(model.scope)
  }
}
