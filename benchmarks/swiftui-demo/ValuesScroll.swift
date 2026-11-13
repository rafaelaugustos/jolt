import JoltSwiftUI
import SwiftUI

@MainActor final class ValuesScrollModel: ObservableObject {
  let scope = JoltScope()
  let a: JoltMotionValue
  let b: JoltMotionValue
  let combined: JoltComputedValue
  let rotation: JoltComputedValue
  let header: JoltScrollHeaderController
  @Published var items = Array(0..<60)
  private var inserted = -1
  init() {
    a = try! scope.value(0)
    b = try! scope.value(0)
    combined = try! scope.retain(a.add(b).mul(0.65))
    rotation = try! scope.retain(a.div(70).sin().mul(25))
    header = try! scope.retain(JoltScrollHeaderController(geometry: .init(expanded: 180, minimum: 48, section: 32, parallax: 50)))
  }
  func animate(reduced: Bool) {
    try! a.set(0); try! b.set(0)
    try! a.animate(to: 150, transition: .tween(milliseconds: 1500), reducedMotion: reduced)
    try! b.animate(to: 75, transition: .tween(milliseconds: 2000), reducedMotion: reduced)
  }
  func prepend() async {
    _ = await header.preserveAnchor {
      items.insert(inserted, at: 0); inserted -= 1
    }
  }
}
private struct ValuesScrollStatus: View {
  @ObservedObject var progress: JoltScrollProgress
  @ObservedObject var collapse: JoltScrollProgress
  @ObservedObject var toolbar: JoltScrollProgress
  @Environment(\.joltEffectiveReduceMotion) private var reduced
  var body: some View {
    Text("Offset \(progress.offset, specifier: "%.0f") · collapse \(collapse.progress, specifier: "%.2f") · toolbar \(toolbar.progress, specifier: "%.2f") · reduced \(reduced ? "on" : "off")")
      .font(.caption.monospacedDigit()).accessibilityIdentifier("values-scroll-status")
  }
}
private struct ValuesReading: View {
  @ObservedObject var value: JoltComputedValue
  var body: some View {
    Text("Combined \(value.value, specifier: "%.1f")").font(.caption.monospacedDigit()).accessibilityIdentifier("combined-status")
  }
}
struct ValuesScrollLab: View {
  @StateObject private var model = ValuesScrollModel()
  @State private var reduced = false
  private let accent = Color(red: 0.40, green: 0.89, blue: 0.75)
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("JOLT · SWIFTUI").font(.caption.bold()).foregroundStyle(accent)
      Text("Values & structural scroll").font(.title2.bold())
      HStack {
        Button("Combine") { model.animate(reduced: reduced) }.accessibilityIdentifier("combine-values")
        Button("Interrupt") { try! model.a.animate(to: 0, transition: .spring(.snappy)); try! model.b.animate(to: 0, transition: .spring(.snappy)) }.accessibilityIdentifier("interrupt-values")
        ValuesReading(value: model.combined)
      }.buttonStyle(.bordered)
      ZStack(alignment: .leading) {
        RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.06))
        RoundedRectangle(cornerRadius: 12).fill(accent).frame(width: 44, height: 44)
          .joltBind(.rotate, to: model.rotation).joltBind(.x, to: model.combined).padding(.leading, 12)
      }.frame(height: 76)
      HStack {
        Button("Scroll") { try! model.header.scrollTo(240) }.accessibilityIdentifier("header-scroll")
        Button("Top") { try! model.header.scrollToTop() }.accessibilityIdentifier("header-top")
        Button("Prepend") { Task { await model.prepend() } }.accessibilityIdentifier("header-prepend")
      }.buttonStyle(.bordered)
      Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("values-reduce")
      ValuesScrollStatus(progress: model.header.scroll.progress, collapse: model.header.collapse, toolbar: model.header.toolbar)
      JoltScrollHeader(controller: model.header) {
        LinearGradient(colors: [Color(red: 0.17, green: 0.35, blue: 0.52), .indigo], startPoint: .topLeading, endPoint: .bottomTrailing)
          .overlay(Image(systemName: "mountain.2.fill").font(.system(size: 90)).foregroundStyle(accent.opacity(0.6)))
      } title: {
        Text("Weekend routes").font(.largeTitle.bold()).padding(16).accessibilityIdentifier("header-title")
      } toolbar: {
        Color(red: 0.12, green: 0.20, blue: 0.32)
      } compactTitle: {
        Text("Weekend routes").font(.headline).accessibilityIdentifier("header-compact")
      } section: {
        Text("Pinned section · 60 keyed rows").font(.subheadline.bold()).frame(maxWidth: .infinity, maxHeight: .infinity).background(Color(red: 0.17, green: 0.29, blue: 0.42)).accessibilityIdentifier("header-section")
      } content: {
        VStack(spacing: 0) {
          ForEach(model.items, id: \.self) { id in
            Text("Route \(id)").frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).frame(height: 52)
              .background(id.isMultiple(of: 2) ? Color.white.opacity(0.06) : Color.white.opacity(0.02))
              .joltScrollAnchor(id).accessibilityIdentifier("route-\(id)")
          }
        }
      }.clipShape(RoundedRectangle(cornerRadius: 14))
    }.padding(18).background(Color(red: 0.047, green: 0.071, blue: 0.13))
      .preferredColorScheme(.dark).environment(\.joltReduceMotion, reduced).joltScope(model.scope)
  }
}
