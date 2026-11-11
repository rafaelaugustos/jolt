import JoltSwiftUI
import SwiftUI

private let effectsLime = Color(red: 0.86, green: 1, blue: 0.48)
private let effectsNight = Color(red: 0.06, green: 0.08, blue: 0.12)
private let effectsInk = JoltColor(argb: 0xff10_141f)

@MainActor final class EffectsModel: ObservableObject {
  let scope = JoltScope()
  let shimmer: JoltShimmer
  let loaders: [JoltLoaderStyle: JoltLoader]
  let reveal: JoltReveal
  let angle: JoltMotionValue, stop: JoltMotionValue, tone: JoltMotionValue, amount: JoltMotionValue
  let tint: JoltColorValue
  let gradient: JoltGradient
  let blur: JoltBlur
  @Published var loaded = false
  @Published var busy: Set<JoltLoaderStyle> = []
  @Published var blurred = false
  @Published var swept = false
  @Published var interrupted = 0
  private var origin: JoltPoint?
  init() {
    let owner = scope
    shimmer = try! owner.retain(JoltShimmer())
    var loaders: [JoltLoaderStyle: JoltLoader] = [:]
    for style in JoltLoaderStyle.allCases {
      loaders[style] = try! owner.retain(JoltLoader(style, color: effectsInk, size: 30))
    }
    self.loaders = loaders
    reveal = try! owner.retain(JoltReveal(revealed: false))
    angle = try! owner.value(135)
    stop = try! owner.value(0.3)
    tone = try! owner.value(0)
    amount = try! owner.value(0)
    tint = try! owner.retain(
      JoltColorValue(tone, from: .init(argb: 0xff77_66ff), to: .init(argb: 0xffff_9dce)))
    gradient = try! owner.retain(
      JoltGradient(
        colors: [
          .constant(.init(argb: 0xff1b_1f3a)), .value(tint), .constant(.init(argb: 0xffdb_ff7a)),
        ],
        stops: [0, .value(stop), 1], angle: .value(angle)))
    blur = try! owner.retain(JoltBlur(amount: .value(amount), radius: 24))
  }
  func toggle(_ style: JoltLoaderStyle) {
    if busy.contains(style) { busy.remove(style) } else { busy.insert(style) }
  }
  func sweep(reduced: Bool) {
    swept.toggle()
    let transition = try! JoltTransition.tween(milliseconds: 1600, ease: .easeInOut)
    try! angle.animate(to: swept ? 315 : 135, transition: transition, reducedMotion: reduced)
    try! stop.animate(to: swept ? 0.75 : 0.3, transition: transition, reducedMotion: reduced)
    try! tone.animate(to: swept ? 1 : 0, transition: transition, reducedMotion: reduced)
  }
  func setBlur(_ on: Bool, reduced: Bool) {
    blurred = on
    try! amount.animate(
      to: on ? 1 : 0, transition: try! .tween(milliseconds: 700, ease: .easeInOut),
      reducedMotion: reduced)
  }
  func open(at location: CGPoint, reduced: Bool) {
    origin = try? JoltPoint(location.x, location.y)
    try! reveal.reveal(from: origin, duration: 2400, reducedMotion: reduced) { [weak self] in
      if !$0 { self?.interrupted += 1 }
    }
  }
  func close(at location: CGPoint? = nil, reduced: Bool) {
    if let location { origin = try? JoltPoint(location.x, location.y) }
    try! reveal.conceal(to: origin, duration: 2400, reducedMotion: reduced) { [weak self] in
      if !$0 { self?.interrupted += 1 }
    }
  }
}

private struct ShimmerStatus: View {
  @ObservedObject var shimmer: JoltShimmer
  let reduced: Bool
  var body: some View {
    Text("Shimmer: \(shimmer.state.rawValue)\(reduced ? " · reduced motion" : "")")
      .font(.caption.monospacedDigit()).accessibilityIdentifier("shimmer-status")
  }
}
private struct LoaderStatus: View {
  @ObservedObject var dots: JoltLoader
  @ObservedObject var bars: JoltLoader
  @ObservedObject var ring: JoltLoader
  var body: some View {
    Text(
      [dots, bars, ring].map { "\($0.style.rawValue) \($0.state.rawValue)" }.joined(
        separator: " · ")
    ).font(.caption.monospacedDigit()).accessibilityIdentifier("loader-status")
  }
}
private struct RevealStatus: View {
  @ObservedObject var reveal: JoltReveal
  let interrupted: Int
  var body: some View {
    let radius = Int(reveal.circle?.radius ?? 0)
    Text("Reveal: \(reveal.phase.rawValue) · r \(radius) pt · interrupted \(interrupted)")
      .font(.caption.monospacedDigit()).accessibilityIdentifier("reveal-status")
  }
}
private struct GradientStatus: View {
  @ObservedObject var gradient: JoltGradient
  let reduced: Bool
  var body: some View {
    let frame = reduced ? gradient.settled : gradient.frame
    Text(
      "Gradient: \(Int(frame.angle.rounded()))° · stops "
        + frame.stops.map { String(format: "%.2f", $0) }.joined(separator: " ")
    ).font(.caption.monospacedDigit()).accessibilityIdentifier("gradient-status")
  }
}
private struct BlurStatus: View {
  @ObservedObject var blur: JoltBlur
  let reduced: Bool
  var body: some View {
    let amount = reduced ? blur.settledAmount : blur.amount
    Text("Blur: \(String(format: "%.1f", amount * blur.radius)) pt")
      .font(.caption.monospacedDigit()).accessibilityIdentifier("blur-status")
  }
}

struct EffectsLab: View {
  @StateObject private var model = EffectsModel()
  @State private var reduced = false
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 12) {
        Text("JOLT · EFFECTS").font(.caption.bold()).tracking(2).foregroundStyle(effectsLime)
        Text("Loading, revealed.").font(.system(size: 28, weight: .bold, design: .rounded))
        Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("effects-reduce")
        skeleton
        HStack {
          Button(model.loaded ? "Show placeholders" : "Load content") { model.loaded.toggle() }
            .buttonStyle(.bordered).accessibilityIdentifier("skeleton-toggle")
          ShimmerStatus(shimmer: model.shimmer, reduced: reduced)
        }
        HStack(spacing: 10) {
          ForEach(JoltLoaderStyle.allCases, id: \.self) { style in busyButton(style) }
        }
        LoaderStatus(
          dots: model.loaders[.dots]!, bars: model.loaders[.bars]!, ring: model.loaders[.ring]!)
        revealArea
        HStack {
          Button("Conceal") { model.close(reduced: reduced) }.buttonStyle(.bordered)
            .accessibilityIdentifier("reveal-conceal")
          RevealStatus(reveal: model.reveal, interrupted: model.interrupted)
        }
        VStack(alignment: .leading, spacing: 4) {
          Text("Aurora").font(.title3.bold())
          Text("Angle, stop and tint follow motion values").font(.caption)
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading).frame(height: 84)
        .joltGradient(model.gradient, in: RoundedRectangle(cornerRadius: 22))
        .accessibilityElement(children: .combine).accessibilityIdentifier("gradient-card")
        HStack {
          Button(model.swept ? "Sweep back" : "Sweep") { model.sweep(reduced: reduced) }
            .buttonStyle(.bordered).accessibilityIdentifier("gradient-sweep")
          GradientStatus(gradient: model.gradient, reduced: reduced)
        }
        HStack(spacing: 14) {
          Image(systemName: "mountain.2.fill").font(.system(size: 34)).foregroundStyle(effectsLime)
          VStack(alignment: .leading) {
            Text("Soft focus").font(.headline)
            Text("amount × 24 pt, content blur").font(.caption).foregroundStyle(.secondary)
          }
          Spacer()
        }
        .padding(14).frame(height: 70)
        .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 18))
        .joltBlur(model.blur).accessibilityElement(children: .combine)
        .accessibilityIdentifier("blur-card")
        HStack {
          Toggle(
            "Blur",
            isOn: Binding(
              get: { model.blurred }, set: { model.setBlur($0, reduced: reduced) })
          ).fixedSize().accessibilityIdentifier("blur-toggle")
          Spacer()
          BlurStatus(blur: model.blur, reduced: reduced)
        }
      }.padding(24)
    }
    .accessibilityIdentifier("effects-scroll").background(effectsNight)
    .preferredColorScheme(.dark).joltScope(model.scope).joltReduceMotion(reduced)
  }
  @ViewBuilder private var skeleton: some View {
    if model.loaded {
      VStack(alignment: .leading, spacing: 10) {
        let lines = ["Ada · Lunch at noon?", "Grace · Shipping today", "Linus · Merged"]
        ForEach(lines, id: \.self) { line in
          HStack {
            Circle().fill(effectsLime).frame(width: 30, height: 30)
            Text(line).font(.subheadline)
          }.frame(height: 30)
        }
      }.frame(height: 110, alignment: .top).accessibilityIdentifier("skeleton-content")
    } else {
      VStack(alignment: .leading, spacing: 10) {
        ForEach(0..<3, id: \.self) { index in
          HStack(spacing: 12) {
            Circle().frame(width: 30, height: 30)
            VStack(alignment: .leading, spacing: 6) {
              Capsule().frame(width: index == 1 ? 120 : 170, height: 10)
              Capsule().frame(width: 90, height: 8)
            }
          }.frame(height: 30)
        }
      }
      .foregroundStyle(Color(white: 0.22)).frame(height: 110, alignment: .top)
      .joltShimmer(model.shimmer)
      .accessibilityElement(children: .ignore).accessibilityLabel("Loading messages")
      .accessibilityIdentifier("skeleton")
    }
  }
  private func busyButton(_ style: JoltLoaderStyle) -> some View {
    let busy = model.busy.contains(style)
    return Button {
      model.toggle(style)
    } label: {
      Text(style.rawValue.capitalized).font(.headline).foregroundStyle(.black)
        .opacity(busy ? 0 : 1)
        .frame(maxWidth: .infinity).frame(height: 44)
        .overlay {
          if busy { JoltLoaderView(model.loaders[style]!) }
        }
        .background(effectsLime, in: RoundedRectangle(cornerRadius: 14))
    }
    .buttonStyle(.plain)
    .accessibilityLabel(busy ? "Saving with \(style.rawValue)" : "Save with \(style.rawValue)")
    .accessibilityIdentifier("busy-\(style.rawValue)")
  }
  private var revealArea: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 22).fill(.white.opacity(0.04))
        .accessibilityElement().accessibilityLabel("Reveal area")
        .accessibilityIdentifier("reveal-area")
      Text("Tap anywhere to reveal").font(.caption).foregroundStyle(.secondary)
      ZStack(alignment: .bottomLeading) {
        LinearGradient(
          colors: [Color(red: 0.47, green: 0.4, blue: 1), effectsLime], startPoint: .topLeading,
          endPoint: .bottomTrailing)
        VStack(alignment: .leading, spacing: 4) {
          Text("Revealed from your tap").font(.headline).foregroundStyle(.black)
          Text("Tap the surface to conceal it there").font(.caption).foregroundStyle(.black)
        }.padding(16)
      }
      .clipShape(RoundedRectangle(cornerRadius: 22))
      .contentShape(Rectangle())
      .onTapGesture(coordinateSpace: .local) { model.close(at: $0, reduced: reduced) }
      .accessibilityElement(children: .combine).accessibilityIdentifier("reveal-surface")
      .joltReveal(model.reveal)
    }
    .frame(height: 150)
    .contentShape(Rectangle())
    .onTapGesture(coordinateSpace: .local) { model.open(at: $0, reduced: reduced) }
  }
}
