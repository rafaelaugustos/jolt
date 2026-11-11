import JoltSwiftUI
import SwiftUI

private let depthAccent = Color(red: 0.86, green: 1, blue: 0.48)

@MainActor final class DepthModel: ObservableObject {
  static let rest = try! JoltShadow(opacity: 0.2, radius: 3, x: 0, y: 2)
  static let raised: [String: Double] = ["y": -18, "opacity": 0.42, "radius": 18, "offset": 16]
  let scope = JoltScope()
  let rotateX: JoltMotionValue
  let rotateY: JoltMotionValue
  let lift: JoltMotionValue
  let shadowOpacity: JoltMotionValue
  let shadowRadius: JoltMotionValue
  let shadowY: JoltMotionValue
  let elevation: JoltMotionStates
  private let tilt = try! JoltTransition.spring(stiffness: 70, damping: 10)
  init() {
    let owner = scope
    rotateX = try! owner.value(0)
    rotateY = try! owner.value(0)
    lift = try! owner.value(0)
    shadowOpacity = try! owner.value(Self.rest.opacity)
    shadowRadius = try! owner.value(Self.rest.radius)
    shadowY = try! owner.value(Self.rest.y)
    let group = try! owner.retain(
      JoltPropertyGroup([
        "y": lift, "opacity": shadowOpacity, "radius": shadowRadius, "offset": shadowY,
      ]))
    elevation = try! owner.retain(
      JoltMotionStates(
        group: group,
        states: [
          "rest": ["y": 0, "opacity": Self.rest.opacity, "radius": Self.rest.radius, "offset": 2],
          "raised": Self.raised,
        ]))
  }
  func tilt(x: Double? = nil, y: Double? = nil, reduced: Bool) {
    if let x { try! rotateX.animate(to: x, transition: tilt, reducedMotion: reduced) }
    if let y { try! rotateY.animate(to: y, transition: tilt, reducedMotion: reduced) }
  }
  func elevate(_ name: String, reduced: Bool) {
    try! elevation.set(name, transition: .spring(.bouncy), reducedMotion: reduced)
  }
}

private struct TiltStatus: View {
  @ObservedObject var rotateX: JoltMotionValue
  @ObservedObject var rotateY: JoltMotionValue
  let perspective: String
  let taps: Int
  var body: some View {
    Text(
      "rotateX \(rotateX.value, specifier: "%.1f") · rotateY \(rotateY.value, specifier: "%.1f") · \(perspective) · Taps \(taps)"
    ).font(.caption.monospacedDigit()).accessibilityIdentifier("tilt-status")
  }
}

private struct LiftStatus: View {
  @ObservedObject var lift: JoltMotionValue
  @ObservedObject var opacity: JoltMotionValue
  @ObservedObject var radius: JoltMotionValue
  @ObservedObject var offset: JoltMotionValue
  let bound: Bool
  var body: some View {
    let rest = DepthModel.rest
    Text(
      "y \(lift.value, specifier: "%.1f") · shadow \(bound ? opacity.value : rest.opacity, specifier: "%.2f") · radius \(bound ? radius.value : rest.radius, specifier: "%.1f") · offset \(bound ? offset.value : rest.y, specifier: "%.1f") · \(bound ? "bound" : "rest")"
    ).font(.caption.monospacedDigit()).accessibilityIdentifier("lift-status")
  }
}

struct DepthLab: View {
  @StateObject private var model = DepthModel()
  @State private var distance = 300.0
  @State private var reduced = false
  @State private var dark = true
  @State private var bound = true
  @State private var taps = 0
  private var perspective: JoltPerspective? {
    distance == 0 ? nil : try! JoltPerspective(distance: distance)
  }
  private func stage<Content: View>(height: CGFloat, @ViewBuilder content: () -> Content)
    -> some View
  {
    ZStack {
      RoundedRectangle(cornerRadius: 20).fill(dark ? .white.opacity(0.07) : .black.opacity(0.04))
      content()
    }.frame(height: height)
  }
  private func distanceButton(_ title: String, _ value: Double, id: String) -> some View {
    Button(title) { distance = value }.buttonStyle(.bordered)
      .tint(distance == value ? depthAccent : .secondary).accessibilityIdentifier(id)
  }
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 12) {
        Text("JOLT · DEPTH").font(.caption.bold()).tracking(2).foregroundStyle(
          dark ? depthAccent : .green)
        Text("Tilt and lift.").font(.system(size: 28, weight: .bold, design: .rounded))
        Text("rotateX · rotateY · perspective · shadow").font(.subheadline).foregroundStyle(
          .secondary)
        HStack {
          distanceButton("300 pt", 300, id: "depth-near")
          distanceButton("900 pt", 900, id: "depth-far")
          distanceButton("Flat", 0, id: "depth-flat")
        }
        stage(height: 200) {
          RoundedRectangle(cornerRadius: 22).stroke(
            .secondary.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [5, 4])
          ).frame(width: 180, height: 120).accessibilityElement().accessibilityLabel("Layout frame")
            .accessibilityIdentifier("tilt-frame")
          Button {
            taps += 1
          } label: {
            VStack(spacing: 6) {
              Image(systemName: "square.3.layers.3d").font(.title)
              Text("Tilt").font(.headline)
            }.frame(width: 180, height: 120).background(
              depthAccent, in: RoundedRectangle(cornerRadius: 22)
            ).foregroundStyle(.black)
          }.buttonStyle(.plain)
            .joltBind([.rotateX: model.rotateX, .rotateY: model.rotateY])
            .accessibilityIdentifier("tilt-card")
        }.joltPerspective(perspective)
        TiltStatus(
          rotateX: model.rotateX, rotateY: model.rotateY,
          perspective: distance == 0 ? "flat" : "\(Int(distance)) pt", taps: taps)
        HStack {
          Button("Tilt X") { model.tilt(x: 45, reduced: reduced) }.accessibilityIdentifier("tilt-x")
          Button("Tilt Y") { model.tilt(y: -55, reduced: reduced) }.accessibilityIdentifier(
            "tilt-y")
          Button("Level X") { model.tilt(x: 0, reduced: reduced) }.accessibilityIdentifier(
            "level-x")
          Button("Reset") { model.tilt(x: 0, y: 0, reduced: reduced) }.accessibilityIdentifier(
            "tilt-reset")
        }.buttonStyle(.bordered)
        stage(height: 130) {
          VStack(spacing: 4) {
            Text("Lift").font(.headline)
            Text("y and shadow on one spring").font(.caption)
          }.frame(width: 220, height: 76).background(
            depthAccent, in: RoundedRectangle(cornerRadius: 18)
          ).foregroundStyle(.black)
            .joltShadow(
              DepthModel.rest, color: .black, opacity: bound ? model.shadowOpacity : nil,
              radius: bound ? model.shadowRadius : nil, y: bound ? model.shadowY : nil
            )
            .joltBind(.y, to: model.lift).accessibilityElement(children: .ignore)
            .accessibilityLabel("Lift card").accessibilityIdentifier("lift-card")
        }
        LiftStatus(
          lift: model.lift, opacity: model.shadowOpacity, radius: model.shadowRadius,
          offset: model.shadowY, bound: bound)
        HStack {
          Button("Raise") { model.elevate("raised", reduced: reduced) }.accessibilityIdentifier(
            "lift-raise")
          Button("Rest") { model.elevate("rest", reduced: reduced) }.accessibilityIdentifier(
            "lift-rest")
          Button(bound ? "Unbind shadow" : "Bind shadow") { bound.toggle() }
            .accessibilityIdentifier("lift-bind")
        }.buttonStyle(.bordered)
        Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("depth-reduce")
        Toggle("Dark appearance", isOn: $dark).accessibilityIdentifier("depth-dark")
        Text(
          "The dashed outline is the card's layout frame. Each view projects around its own centre."
        ).font(.caption).foregroundStyle(.secondary)
      }.padding(24)
    }.background(dark ? Color(red: 0.06, green: 0.08, blue: 0.12) : Color(white: 0.97))
      .preferredColorScheme(dark ? .dark : .light).joltScope(model.scope)
      .joltReduceMotion(reduced)
  }
}
