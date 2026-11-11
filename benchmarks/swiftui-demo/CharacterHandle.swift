import JoltSwiftUI
import SwiftUI

private let accent = Color(red: 0.38, green: 0.89, blue: 0.76)
private let backdrop = Color(red: 0.06, green: 0.08, blue: 0.12)
private let column = Color(red: 0.11, green: 0.19, blue: 0.28)

@MainActor private final class HandleBoardModel: ObservableObject {
  let scope = JoltScope()
  @Published var home = "backlog"
  @Published var status = "Drag the grip; the card body keeps its button"
  @Published var opened = 0
  lazy var zones: JoltDropZones = try! scope.retain(
    JoltDropZones(
      [
        .init("backlog", label: "Backlog", padding: try! .init(bottom: 60)),
        .init("done", label: "Done", padding: try! .init(bottom: 60)),
        .init("locked", label: "Locked", accepts: { false }),
      ],
      onReject: { [weak self] event in
        self?.status = event.map { "Rejected by \($0.id) · spring returns" } ?? "No target · returned"
      },
      onDrop: { [weak self] event in
        self?.status = "Dropped in \(event.id) · \(event.method == .drag ? "drag" : "request")"
        Task { @MainActor [weak self] in self?.settle(event.id) }
        return nil
      }))
  private func settle(_ id: String) {
    home = id
    zones.cancel()
  }
}

/// The drop source moves by its grip; Backlog and Done accept 60 pt below their frames.
struct CharacterHandleLab: View {
  @StateObject private var model = HandleBoardModel()
  @State private var reduced = false
  private var gapAbove: Bool {
    model.zones.dragging && model.zones.hovered == model.home && model.zones.offset.height < -24
  }
  private func gap(_ id: String, top: Bool) -> some View {
    let open =
      top
      ? gapAbove && id == model.home
      : model.zones.dragging && model.zones.hovered == id && id != model.home
    return RoundedRectangle(cornerRadius: 12).strokeBorder(
      accent, style: StrokeStyle(lineWidth: 2, dash: [6, 4])
    )
    .frame(height: open ? 56 : 0).opacity(open ? 1 : 0)
  }
  private var card: some View {
    HStack(spacing: 0) {
      Image(systemName: "line.3.horizontal").font(.headline).frame(width: 36).frame(
        maxHeight: .infinity
      )
      .background(Color(red: 0.25, green: 0.72, blue: 0.6)).accessibilityLabel("Move card")
      .accessibilityIdentifier("handle-grip").joltDropHandle(model.zones)
      VStack(alignment: .leading, spacing: 6) {
        Text("Notes").font(.headline)
        Button("Open · \(model.opened)") { model.opened += 1 }.buttonStyle(.bordered).tint(.black)
          .accessibilityIdentifier("handle-open")
      }.padding(10).frame(maxWidth: .infinity, alignment: .leading)
    }
    .foregroundStyle(.black).frame(height: 84).background(accent)
    .clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityElement(children: .contain)
    .accessibilityIdentifier("handle-card").joltDropSource(model.zones).zIndex(1)
  }
  private func lane(_ id: String, title: String, first: String) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(title).font(.caption.bold()).tracking(1.5).foregroundStyle(.secondary)
      gap(id, top: true)
      Text(first).frame(maxWidth: .infinity, minHeight: 40, alignment: .leading).padding(
        .horizontal, 10
      )
      .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
      if model.home == id { card }
      gap(id, top: false)
    }
    .padding(8).background(column, in: RoundedRectangle(cornerRadius: 14))
    .overlay(
      RoundedRectangle(cornerRadius: 14).stroke(
        model.zones.hovered == id ? accent : .white.opacity(0.15), lineWidth: 2)
    )
    .accessibilityElement(children: .contain).joltDropTarget(id, in: model.zones)
    .accessibilityIdentifier("handle-" + id).zIndex(
      model.home == id ? 1 : 0)
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text("JOLT · DROP HANDLE").font(.caption.bold()).tracking(2).foregroundStyle(accent)
      Text("Drop into order.").font(.system(size: 30, weight: .bold, design: .rounded))
      HStack(alignment: .top, spacing: 12) {
        lane("backlog", title: "BACKLOG", first: "Spec")
        VStack(spacing: 0) {
          lane("done", title: "DONE", first: "Ship")
          Text("+60 pt hit padding").font(.caption2).foregroundStyle(.secondary).frame(
            maxWidth: .infinity, minHeight: 60
          )
          .overlay(
            RoundedRectangle(cornerRadius: 12).strokeBorder(
              .white.opacity(0.3), style: StrokeStyle(lineWidth: 1, dash: [4, 4])))
        }
      }.zIndex(1)
      Text("LOCKED").font(.caption.bold()).frame(maxWidth: .infinity, minHeight: 56).background(
        .pink.opacity(0.35), in: RoundedRectangle(cornerRadius: 14)
      )
      .joltDropTarget("locked", in: model.zones).accessibilityIdentifier("handle-locked")
      Text(
        "\(model.status) · over \(model.zones.hovered ?? "nothing") · offset \(Int(model.zones.offset.width)), \(Int(model.zones.offset.height)) pt"
      )
      .font(.caption.monospacedDigit()).lineLimit(2, reservesSpace: true)
      .accessibilityIdentifier("handle-status")
      HStack {
        Button("Send") {
          _ = try? model.zones.request(
            model.home == "done" ? "backlog" : "done", reducedMotion: reduced)
        }.accessibilityIdentifier("handle-send")
        Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("handle-reduce")
      }.buttonStyle(.bordered)
      Text("Points. The gap above the card moves its layout; the drag keeps it under the pointer.")
        .font(.caption).foregroundStyle(.secondary)
    }.padding(24).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
      .background(backdrop).preferredColorScheme(.dark).joltReduceMotion(reduced)
      .joltScope(model.scope)
  }
}
