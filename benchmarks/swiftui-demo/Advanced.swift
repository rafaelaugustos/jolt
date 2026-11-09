import JoltSwiftUI
import SwiftUI

private let lime = Color(red: 0.86, green: 1, blue: 0.48)
private let night = Color(red: 0.06, green: 0.08, blue: 0.12)
private func panel<Content: View>(height: CGFloat, @ViewBuilder content: () -> Content) -> some View
{
  ZStack {
    RoundedRectangle(cornerRadius: 20).fill(.white.opacity(0.05))
    content()
  }.frame(height: height)
}
@MainActor final class DynamicsModel: ObservableObject {
  let scope = JoltScope()
  let progress: JoltMotionValue, x: JoltMotionValue, scale: JoltMotionValue, scrub: JoltMotionValue
  let mapped: JoltMappedValue, color: JoltColorValue, group: JoltPropertyGroup,
    states: JoltMotionStates, behaviors: JoltBehaviors
  let timeline: JoltTimeline, activity: JoltRenderActivity
  private var observations: [JoltObservation] = []
  @Published var requestStatus = "Ready"
  init() {
    let owner = scope
    progress = try! owner.value(0)
    x = try! owner.value(0)
    scale = try! owner.value(1)
    scrub = try! owner.value(0)
    mapped = try! owner.retain(
      JoltMappedValue(progress, mapping: JoltNumericMap([0, 0.5, 1], [-100, 0, 100])))
    color = try! owner.retain(
      JoltColorValue(progress, from: .init(argb: 0xff77_66ff), to: .init(argb: 0xffdb_ff7a)))
    group = try! owner.retain(JoltPropertyGroup(["x": x, "scale": scale]))
    states = try! owner.retain(
      JoltMotionStates(
        group: group, states: ["rest": ["x": 0, "scale": 1], "focus": ["x": 80, "scale": 1.3]]))
    behaviors = try! owner.retain(
      JoltBehaviors(
        group: group,
        definitions: [
          "rest": .init(["x": 0, "scale": 1], transition: try! .tween(milliseconds: 500)),
          "pet": .init(
            ["x": -90, "scale": 1.1], priority: 1, transition: try! .tween(milliseconds: 2500)),
          "dress": .init(
            ["x": 90, "scale": 0.8], priority: 2, blocks: ["eat"],
            transition: try! .tween(milliseconds: 3500)),
          "eat": .init(
            ["x": 0, "scale": 1.4], priority: 3, transition: try! .tween(milliseconds: 1000)),
        ], rest: "rest"))
    // Assign the timeline before capturing this model in a cue.
    timeline = try! owner.retain(
      JoltTimeline(
        tracks: [.init(scrub, to: 200, transition: try! .tween(milliseconds: 4000, ease: .linear))],
        autoplay: false))
    activity = try! owner.retain(JoltRenderActivity(.init(change: { _ in }, redraw: {})))
    observations = [try! activity.track(progress), try! activity.track(timeline)]
  }
  func map(to target: Double, reduced: Bool) {
    try! progress.animate(
      to: target, transition: try! .tween(milliseconds: 1000, ease: .linear), reducedMotion: reduced
    )
  }
  func state(_ name: String, reduced: Bool) {
    behaviors.stop()
    try! states.set(name, reducedMotion: reduced)
    requestStatus = "State: " + name
  }
  func request(_ name: String, reduced: Bool) {
    let run = try! behaviors.request(name, reducedMotion: reduced)
    requestStatus = name + ": " + run.status.rawValue
  }
}
private struct BehaviorStatus: View {
  @ObservedObject var behaviors: JoltBehaviors
  var body: some View {
    if let current = behaviors.current {
      RunStatus(run: current)
    } else {
      Text("Behavior: none").accessibilityIdentifier("behavior-status")
    }
  }
  private struct RunStatus: View {
    @ObservedObject var run: JoltBehaviorRun
    var body: some View {
      Text("Behavior: \(run.name) · \(run.status.rawValue)").accessibilityIdentifier(
        "behavior-status")
    }
  }
}
private struct ActivityStatus: View {
  @ObservedObject var activity: JoltRenderActivity
  var body: some View {
    Text("Renderer: \(activity.active ? "active" : "idle") · owners: \(activity.size)").font(
      .caption.monospacedDigit()
    ).accessibilityIdentifier("activity-status")
  }
}
private struct TimelineControls: View {
  @ObservedObject var timeline: JoltTimeline
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Seek: \(timeline.progress,specifier:"%.2f") · \(timeline.state.rawValue)").font(
        .caption.monospacedDigit()
      ).accessibilityIdentifier("seek-status")
      HStack {
        Button("Seek 25%") { try! timeline.seek(to: 0.25) }.accessibilityIdentifier("seek-quarter")
        Button("Seek 75%") { try! timeline.seek(to: 0.75) }.accessibilityIdentifier(
          "seek-threequarters")
        Button("Play") { timeline.play() }.accessibilityIdentifier("seek-play")
        Button("Pause") { timeline.pause() }.accessibilityIdentifier("seek-pause")
      }.buttonStyle(.bordered)
    }
  }
}
struct DynamicsLab: View {
  @StateObject private var model = DynamicsModel()
  @State private var reduced = false
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        Text("JOLT · DYNAMICS").font(.caption.bold()).tracking(2).foregroundStyle(lime)
        Text("One change. Many properties.").font(
          .system(size: 26, weight: .bold, design: .rounded))
        Text("Mapping · OKLab color · groups · states · priority").font(.caption).foregroundStyle(
          .secondary)
        panel(height: 100) {
          Text("MAP").font(.headline).frame(width: 66, height: 66).joltColor(
            .background, to: model.color
          ).clipShape(RoundedRectangle(cornerRadius: 20)).joltBind(.x, to: model.mapped)
            .accessibilityIdentifier("mapped-card")
        }
        HStack {
          Button("Map right") { model.map(to: 1, reduced: reduced) }.accessibilityIdentifier(
            "map-right")
          Button("Map left") { model.map(to: 0, reduced: reduced) }.accessibilityIdentifier(
            "map-left")
        }.buttonStyle(.bordered)
        panel(height: 100) {
          RoundedRectangle(cornerRadius: 18).fill(lime).frame(width: 60, height: 60).joltBind(
            .x, to: model.x
          ).joltBind(.scale, to: model.scale).accessibilityElement(children: .ignore)
            .accessibilityLabel("Grouped card").accessibilityIdentifier("group-card")
        }
        HStack {
          Button("Focus") { model.state("focus", reduced: reduced) }.accessibilityIdentifier(
            "state-focus")
          Button("Rest") { model.state("rest", reduced: reduced) }.accessibilityIdentifier(
            "state-rest")
          Button("Pet") { model.request("pet", reduced: reduced) }.accessibilityIdentifier(
            "behavior-pet")
          Button("Dress") { model.request("dress", reduced: reduced) }.accessibilityIdentifier(
            "behavior-dress")
          Button("Eat") { model.request("eat", reduced: reduced) }.accessibilityIdentifier(
            "behavior-eat")
        }.buttonStyle(.bordered)
        Text(model.requestStatus).font(.caption.monospacedDigit()).accessibilityIdentifier(
          "request-status")
        BehaviorStatus(behaviors: model.behaviors).font(.caption.monospacedDigit())
        Text("Dress interrupts pet, blocks eat, then restores rest.").font(.caption)
          .foregroundStyle(.secondary)
        panel(height: 85) {
          HStack {
            Circle().fill(.indigo).frame(width: 44, height: 44).joltBind(.x, to: model.scrub)
              .accessibilityElement(children: .ignore).accessibilityLabel("Seek marker")
              .accessibilityIdentifier("seek-card")
            Spacer()
          }.padding(.horizontal, 20)
        }
        TimelineControls(timeline: model.timeline)
        ActivityStatus(activity: model.activity)
        Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("advanced-reduce")
      }.padding(24)
    }.background(night).preferredColorScheme(.dark).joltScope(model.scope).joltReduceMotion(reduced)
  }
}

@MainActor final class GraphicsModel: ObservableObject {
  let scope = JoltScope()
  let progress: JoltMotionValue, sheen: JoltMotionValue, drawing: JoltDrawing, path: JoltPath,
    drag: JoltDragModel, activity: JoltRenderActivity
  private var observations: [JoltObservation] = []
  @Published var paused = false
  init() {
    let owner = scope
    progress = try! owner.value(0)
    sheen = try! owner.value(0)
    path = try! JoltPath([
      .init(25, 100), .init(95, 25), .init(165, 100), .init(235, 25), .init(295, 100),
    ])
    var shapes = [try! JoltVectorShape(.path(path), stroke: .init(argb: 0xffdb_ff7a), lineWidth: 4)]
    for index in 0..<20 {
      shapes.append(
        try! JoltVectorShape(
          .ellipse(
            x: Double(index % 10) * 30 + 12, y: Double(index / 10) * 22 + 135, width: 10, height: 10
          ), fill: .init(argb: 0xff77_66ff)))
    }
    drawing = try! owner.retain(JoltDrawing(shapes))
    drag = try! owner.retain(
      JoltDragModel(bounds: .init(x: -115...115, y: 0...0), release: .inertia()))
    activity = try! owner.retain(JoltRenderActivity(.init(change: { _ in }, redraw: {})))
    observations = [try! activity.track(progress), try! activity.track(sheen)]
  }
  func play(reduced: Bool) {
    try! progress.set(0)
    try! sheen.set(0)
    try! progress.animate(
      to: 1, transition: try! .tween(milliseconds: 2500, ease: .linear), reducedMotion: reduced)
    try! sheen.animate(
      to: 1, transition: try! .tween(milliseconds: 1800, ease: .linear), reducedMotion: reduced)
  }
  func pause() {
    paused.toggle()
    if paused { scope.pause() } else { scope.play() }
  }
  func release() {
    drag.begin()
    drag.end(velocity: .init(width: 500, height: 0))
  }
}
struct GraphicsLab: View {
  @StateObject private var model = GraphicsModel()
  @State private var reduced = false
  private var paint: JoltTextPaint {
    try! .init(colors: [.init(argb: 0xffdb_ff7a), .init(argb: 0xff77_66ff)], width: 0.25)
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("JOLT · GRAPHICS").font(.caption.bold()).tracking(2).foregroundStyle(lime)
      JoltGradientText(
        "Draw a little wonder.", paint: paint,
        font: .system(size: 30, weight: .bold, design: .rounded), sheenProgress: model.sheen
      ).accessibilityIdentifier("gradient-title")
      Text("Retained vectors · path tangent · finite glyph sheen").font(.caption).foregroundStyle(
        .secondary)
      ZStack(alignment: .topLeading) {
        RoundedRectangle(cornerRadius: 20).fill(.white.opacity(0.05))
        JoltDrawingView(
          model.drawing, strokeProgress: model.progress,
          accessibilityLabel: "A zigzag path and twenty retained circles"
        ).accessibilityIdentifier("drawing")
        Image(systemName: "paperplane.fill").foregroundStyle(.white).font(.title2).frame(
          width: 24, height: 24
        ).offset(x: -12, y: -12).joltPath(model.path, progress: model.progress, orient: true)
          .accessibilityIdentifier("path-marker")
      }.frame(width: 320, height: 185).frame(maxWidth: .infinity)
      HStack {
        Button("Play drawing") { model.play(reduced: reduced) }.accessibilityIdentifier(
          "graphics-play")
        Button(model.paused ? "Resume" : "Pause") { model.pause() }.accessibilityIdentifier(
          "graphics-pause")
        Button("Clear drawing") { model.scope.release(model.drawing) }.accessibilityIdentifier(
          "graphics-clear")
      }.buttonStyle(.bordered)
      DrawingStatus(drawing: model.drawing)
      Text("Release with inertia").font(.headline)
      panel(height: 130) {
        RoundedRectangle(cornerRadius: 20).fill(lime).frame(width: 64, height: 64).overlay(
          Image(systemName: "hand.draw.fill").foregroundStyle(.black)
        ).joltDrag(model.drag).accessibilityIdentifier("inertia-card")
      }
      Text("Drag and release; velocity decays until the boundary.").font(.caption).foregroundStyle(
        .secondary)
      ActivityStatus(activity: model.activity)
      Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("advanced-reduce")
      Spacer(minLength: 0)
    }.padding(24).background(night).preferredColorScheme(.dark).joltScope(model.scope)
      .joltReduceMotion(reduced)
  }
  private struct DrawingStatus: View {
    @ObservedObject var drawing: JoltDrawing
    var body: some View {
      Text("Retained shapes: \(drawing.shapes.count)").font(.caption.monospacedDigit())
        .accessibilityIdentifier("drawing-status")
    }
  }
}
struct ViewportLab: View {
  @StateObject private var once = ViewportLab.makeEntry(once: true)
  @StateObject private var replay = ViewportLab.makeEntry(once: false)
  @MainActor private static func makeEntry(once: Bool) -> JoltViewportEntry {
    try! JoltViewportEntry(threshold: 0.5, once: once)
  }
  @State private var shown = true
  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("JOLT · VIEWPORT").font(.caption.bold()).tracking(2).foregroundStyle(lime)
      Text("Enter when visible.").font(.system(size: 30, weight: .bold, design: .rounded))
      Text("Once: \(once.entries) · Replay: \(replay.entries)").font(.caption.monospacedDigit())
        .accessibilityIdentifier("viewport-status")
      Button(shown ? "Remove cards" : "Mount cards") { shown.toggle() }.buttonStyle(.bordered)
        .accessibilityIdentifier("viewport-toggle")
      ScrollView {
        VStack(spacing: 20) {
          ForEach(0..<5) { index in
            Text("Scroll to the cards · \(index+1)").frame(maxWidth: .infinity).frame(height: 100)
              .background(.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 18))
          }
          if shown {
            Text("ONCE").font(.title.bold()).frame(maxWidth: .infinity).frame(height: 110)
              .background(lime, in: RoundedRectangle(cornerRadius: 20)).foregroundStyle(.black)
              .joltViewportEnter(once).accessibilityIdentifier("viewport-once")
            Text("REPLAY").font(.title.bold()).frame(maxWidth: .infinity).frame(height: 110)
              .background(.indigo, in: RoundedRectangle(cornerRadius: 20)).joltViewportEnter(replay)
              .accessibilityIdentifier("viewport-replay")
          }
          Color.clear.frame(height: 450)
        }.padding(.vertical, 10)
      }.accessibilityIdentifier("viewport-scroll")
      Text(
        "50% geometric intersection. No frame polling; native scroll observations detach on removal."
      ).font(.caption).foregroundStyle(.secondary)
    }.padding(24).background(night).preferredColorScheme(.dark)
  }
}
