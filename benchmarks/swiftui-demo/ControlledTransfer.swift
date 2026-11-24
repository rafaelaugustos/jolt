import JoltSwiftUI
import SwiftUI

@MainActor private final class ControlledBoard: ObservableObject {
  @Published var columns = [["Atlas", "Birch", "Cedar"], ["Dune", "Elm"]]
  @Published var message = "Drag Atlas into the other list"
  @Published var insertion: Int?
  @Published var rejects = false
  var frames: [String: CGRect] = [:]
  var version = 0, count = 0
  var source: Int { columns[0].contains("Atlas") ? 0 : 1 }
  lazy var zones: JoltDropZones = try! .listTransfer(
    key: "Atlas", destination: "other",
    sourceKeys: { [weak self] in
      guard let self else { return [] }
      return columns[source]
    },
    targetKeys: { [weak self] in
      guard let self else { return [] }
      return columns[1 - source]
    },
    centers: { [weak self] in
      guard let self else { return [] }
      return columns[1 - source].compactMap { key in frames[key].map { (key, $0.midY) } }
    }, revision: { [weak self] in self?.version ?? 0 },
    accept: { [weak self] move in
      guard let self else { return false }
      if rejects { message = "Rejected · Atlas stayed in place" }
      return !rejects
    },
    preview: { [weak self] move in self?.insertion = move?.toIndex },
    commit: { [weak self] move in
      guard let self else { return }
      let side = source
      var updated = columns
      updated[side].remove(at: move.fromIndex)
      updated[1 - side].insert(move.key, at: move.toIndex)
      version += 1
      count += 1
      zones.cancel()
      columns = updated
      message = "Moved Atlas to position \(move.toIndex+1) · \(count) accepted"
    })
  func empty() {
    version += 1
    zones.cancel()
    columns[1 - source] = []
    message = "Empty destination"
  }
}
private struct TransferFrames: PreferenceKey {
  static let defaultValue: [String: CGRect] = [:]
  static func reduce(value: inout [String: CGRect], nextValue: () -> [String: CGRect]) {
    value.merge(nextValue()) { _, next in next }
  }
}
struct ControlledTransferLab: View {
  @StateObject private var board = ControlledBoard()
  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Move between lists").font(.title.bold())
      HStack {
        Button(board.rejects ? "Allow drops" : "Reject drops") { board.rejects.toggle() }
          .accessibilityIdentifier("cross-reject")
        Button("Empty destination") { board.empty() }.accessibilityIdentifier("cross-empty")
      }
      HStack(alignment: .top, spacing: 12) {
        ForEach(0..<2) { side in
          VStack(alignment: .leading, spacing: 6) {
            Text(side == 0 ? "INBOX" : "QUEUE").font(.caption.bold())
            ForEach(board.columns[side], id: \.self) { key in
              let card = Text(key).font(.headline).foregroundStyle(.white)
                .frame(maxWidth: .infinity, minHeight: 44).background(
                  key == "Atlas" ? Color.indigo : Color.teal, in: RoundedRectangle(cornerRadius: 8)
                )
                .accessibilityIdentifier("cross-" + key)
              if key == "Atlas" {
                card.contentShape(Rectangle()).joltDropSource(board.zones)
              } else {
                card.background(
                  GeometryReader { geo in
                    Color.clear.preference(
                      key: TransferFrames.self, value: [key: geo.frame(in: .global)])
                  }
                )
                .overlay(alignment: .top) {
                  if side != board.source
                    && board.insertion == board.columns[side].firstIndex(of: key)
                  {
                    Capsule().fill(.orange).frame(height: 4)
                  }
                }
              }
            }
            if side != board.source && board.insertion == board.columns[side].count {
              Capsule().fill(.orange).frame(height: 4)
            }
            Spacer()
          }
          .padding(8).frame(maxWidth: .infinity, minHeight: 240)
          .background(.teal.opacity(0.13), in: RoundedRectangle(cornerRadius: 12))
          .background(
            GeometryReader { geo in
              Color.clear.preference(
                key: TransferFrames.self, value: ["column-\(side)": geo.frame(in: .global)])
            }
          )
          .zIndex(side == board.source ? 1 : 0)
          .accessibilityElement(children: .contain).accessibilityIdentifier("cross-col-\(side)")
        }
      }.frame(height: 260)
      Text(board.message).font(.callout).accessibilityIdentifier("cross-status")
      Spacer()
    }.padding(20).onPreferenceChange(TransferFrames.self) { values in
      board.frames = values
      try? board.zones.targetBounds("other", values["column-\(1-board.source)"])
    }.onChange(of: board.source) { _, side in
      try? board.zones.targetBounds("other", board.frames["column-\(1-side)"])
    }.onDisappear { board.zones.cancel() }
  }
}
