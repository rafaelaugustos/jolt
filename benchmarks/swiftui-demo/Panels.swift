import JoltSwiftUI
import SwiftUI

private let panelAccent = Color(red: 0.86, green: 1, blue: 0.48)
private let panelBackdrop = Color(red: 0.06, green: 0.08, blue: 0.12)
@MainActor private func makePanel() -> JoltSheetModel {
  try! .init(snaps: [.points(230), .fraction(0.85), .content])
}
struct PanelLab: View {
  @StateObject private var sheet = makePanel()
  @State private var reduced = false
  @State private var note = ""
  @State private var returned = 0
  @State private var mounted = true
  @FocusState private var opener: Bool
  @FocusState private var editing: Bool
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("JOLT · SNAP PANELS").font(.caption.bold()).tracking(2).foregroundStyle(panelAccent)
      Text("A place for the details.").font(.system(size: 28, weight: .bold, design: .rounded))
      Text("Drag the handle. Expand before scrolling. Keyboard space is measured in this host.")
        .font(.subheadline).foregroundStyle(.secondary)
      if mounted {
        JoltBottomSheet(
          sheet, label: "Trip details",
          returnFocus: {
            editing = false
            opener = true
            returned += 1
          }
        ) {
          VStack(spacing: 18) {
            Image(systemName: "mountain.2.fill").font(.system(size: 54)).foregroundStyle(
              panelAccent)
            Text("A weekend away").font(.title2.bold())
            Button("Open details") { try! sheet.open(.points(230)) }
              .buttonStyle(.borderedProminent).focused($opener).accessibilityIdentifier(
                "panel-open")
            Text("Focus returned: \(returned)").font(.caption).accessibilityIdentifier(
              "panel-focus")
          }
        } content: {
          VStack(alignment: .leading, spacing: 16) {
            HStack {
              Button("Expand") { sheet.expand() }.accessibilityIdentifier("panel-expand")
              Button("Compact") { try! sheet.snapTo(.points(230)) }.accessibilityIdentifier(
                "panel-compact")
              Button("Close") {
                editing = false
                sheet.dismiss()
              }.accessibilityIdentifier("panel-close")
            }.buttonStyle(.bordered)
            TextField("Add a note", text: $note).textFieldStyle(.roundedBorder)
              .focused($editing).submitLabel(.done).onSubmit { editing = false }
              .accessibilityIdentifier("panel-note")
            Button("Done editing") { editing = false }.accessibilityIdentifier("panel-done")
            ForEach(1...8, id: \.self) { index in
              VStack(alignment: .leading, spacing: 6) {
                Text("Stop \(index)").font(.headline)
                Text("A quiet trail, a warm meal and room to explore.").foregroundStyle(.secondary)
              }.frame(maxWidth: .infinity, alignment: .leading).padding(14)
                .background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
                .accessibilityIdentifier("panel-stop-\(index)")
            }
          }.padding(16)
        }.background(.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 20))
      } else {
        Text("Panel unmounted").frame(maxWidth: .infinity, maxHeight: .infinity)
      }
      Text(
        "Panel: \(sheet.isOpen ? "open" : "closed") · \(Int(sheet.visibleHeight)) pt · \(sheet.state.rawValue)"
      )
      .font(.caption.monospacedDigit()).accessibilityIdentifier("panel-status")
      HStack {
        Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("panel-reduce")
        Button(mounted ? "Unmount" : "Remount") { mounted.toggle() }.accessibilityIdentifier(
          "panel-mount")
      }
      Text("In-app panel · Apple points · no system sheet presentation").font(.caption2)
        .foregroundStyle(.secondary)
    }.padding(24).background(panelBackdrop).preferredColorScheme(.dark)
      .joltReduceMotion(reduced).onDisappear { sheet.dispose() }
  }
}

@MainActor private final class GeometryModel: ObservableObject {
  let scope = JoltScope(), progress: JoltMotionValue, reorder: JoltReorderModel
  let path = try! JoltPath(
    from: .init(-125, 40),
    segments: [
      .quadratic(control: .init(-65, -100), to: .init(0, 0)),
      .cubic(control1: .init(65, 100), control2: .init(70, -100), to: .init(125, -40)),
    ])
  @Published var expanded = false
  init() {
    progress = try! scope.value(0)
    reorder = try! scope.retain(JoltReorderModel((1...9).map { "Stop \($0)" }, measuresRows: true))
  }
  func play(_ end: Double, reduced: Bool) {
    try! progress.animate(
      to: end, transition: try! .tween(milliseconds: 2400, ease: .linear), reducedMotion: reduced)
  }
}
private struct GeometryStatus: View {
  @ObservedObject var progress: JoltMotionValue
  var body: some View {
    Text("Path: \(progress.value, specifier: "%.2f") · \(progress.state.rawValue)")
      .font(.caption.monospacedDigit()).accessibilityIdentifier("curve-status")
  }
}
private struct MeasuredStatus: View {
  @ObservedObject var model: JoltReorderModel
  var body: some View {
    Text("Order: " + model.keys.prefix(3).joined(separator: ", "))
      .font(.caption).accessibilityIdentifier("measured-status")
  }
}
struct GeometryLab: View {
  @StateObject private var model = GeometryModel()
  @State private var reduced = false
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("JOLT · MEASURED GEOMETRY").font(.caption.bold()).tracking(2).foregroundStyle(
        panelAccent)
      Text("Follow the shape.").font(.system(size: 30, weight: .bold, design: .rounded))
      ZStack {
        Canvas { context, size in
          var path = Path()
          for (index, point) in model.path.points.enumerated() {
            let position = CGPoint(x: size.width / 2 + point.x, y: size.height / 2 + point.y)
            if index == 0 { path.move(to: position) } else { path.addLine(to: position) }
          }
          context.stroke(
            path, with: .color(panelAccent.opacity(0.35)),
            style: StrokeStyle(lineWidth: 3, dash: [5, 4]))
        }
        Image(systemName: "arrow.right.circle.fill").font(.system(size: 32))
          .foregroundStyle(panelAccent).joltPath(model.path, progress: model.progress, orient: true)
          .accessibilityLabel("Curve marker").accessibilityIdentifier("curve-marker")
      }.frame(height: 170).background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 18))
      HStack {
        Button("Follow curve") { model.play(1, reduced: reduced) }.accessibilityIdentifier(
          "curve-play")
        Button("Reverse") { model.play(0, reduced: reduced) }.accessibilityIdentifier(
          "curve-reverse")
        Button("Cancel") { model.progress.cancel() }.accessibilityIdentifier("curve-cancel")
      }.buttonStyle(.bordered)
      GeometryStatus(progress: model.progress)
      Text("Rows measured from their content").font(.headline)
      JoltReorderList(model.reorder) { key in
        VStack(alignment: .leading, spacing: 5) {
          Text(key).font(.headline)
          if key == "Stop 2" {
            Text(
              model.expanded
                ? "A longer stop with more room to explore.\nBring water and take a break.\nThe measured height follows this text.\nNo fixed row height is assumed."
                : "A longer stop with room to explore.\nBring water and take a break."
            ).font(.subheadline).foregroundStyle(.secondary)
          } else if key == "Stop 3" {
            Text("Coffee by the river.").font(.subheadline).foregroundStyle(.secondary)
          }
        }.padding(12).accessibilityElement(children: .combine).accessibilityIdentifier(
          "measured-" + key)
      }.frame(height: 240).background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 18))
      MeasuredStatus(model: model.reorder)
      HStack {
        Button("Change text") { model.expanded.toggle() }.accessibilityIdentifier("measured-resize")
        Button("Reset order") { try! model.reorder.replace((1...9).map { "Stop \($0)" }) }
          .accessibilityIdentifier("measured-reset")
      }.buttonStyle(.bordered)
      Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("geometry-reduce")
      Text(
        "Quadratic + cubic · arc-length progress · tangent orientation\n9 realized rows · resize cancels an active drag"
      ).font(.caption2).foregroundStyle(.secondary)
    }.padding(24).background(panelBackdrop).preferredColorScheme(.dark).joltReduceMotion(reduced)
      .joltScope(model.scope)
  }
}
