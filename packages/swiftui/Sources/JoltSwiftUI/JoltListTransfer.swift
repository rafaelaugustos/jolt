import SwiftUI

public struct JoltListTransferMove: Equatable, Sendable {
  public let key: String, fromIndex: Int, toIndex: Int, beforeKey: String?
}

/// A drop owner for one keyed source and one linear destination. Centers are global points.
extension JoltDropZones {
  @MainActor public static func listTransfer(
    key: String, destination: String, axis: Axis = .vertical, reverse: Bool = false,
    sourceKeys: @escaping () -> [String], targetKeys: @escaping () -> [String],
    centers: @escaping () -> [(key: String, center: CGFloat)],
    revision: @escaping () -> Int = { 0 },
    accept: @escaping (JoltListTransferMove) -> Bool = { _ in true },
    preview: @escaping (JoltListTransferMove?) -> Void = { _ in },
    commit: @escaping (JoltListTransferMove) -> Void
  ) throws -> JoltDropZones {
    let zones = try JoltDropZones([.init(destination)])
    zones.transfer = JoltListTransferPolicy(
      key: key, axis: axis, reverse: reverse, sourceKeys: sourceKeys,
      targetKeys: targetKeys, centers: centers, revision: revision, accept: accept,
      preview: preview, commit: commit)
    return zones
  }
}

@MainActor final class JoltListTransferPolicy {
  let key: String, axis: Axis, reverse: Bool
  let sourceKeys: () -> [String], targetKeys: () -> [String]
  let centers: () -> [(key: String, center: CGFloat)], revision: () -> Int
  let accept: (JoltListTransferMove) -> Bool, preview: (JoltListTransferMove?) -> Void
  let commit: (JoltListTransferMove) -> Void
  private var original: [String] = [], destination: [String] = [], indices: [String: Int] = [:]
  private var version = 0, active = false, last: JoltListTransferMove?
  init(
    key: String, axis: Axis, reverse: Bool, sourceKeys: @escaping () -> [String],
    targetKeys: @escaping () -> [String], centers: @escaping () -> [(key: String, center: CGFloat)],
    revision: @escaping () -> Int, accept: @escaping (JoltListTransferMove) -> Bool,
    preview: @escaping (JoltListTransferMove?) -> Void,
    commit: @escaping (JoltListTransferMove) -> Void
  ) {
    self.key = key
    self.axis = axis
    self.reverse = reverse
    self.sourceKeys = sourceKeys
    self.targetKeys = targetKeys
    self.centers = centers
    self.revision = revision
    self.accept = accept
    self.preview = preview
    self.commit = commit
  }
  func begin() {
    original = sourceKeys()
    destination = targetKeys()
    version = revision()
    let keys = original + destination
    active = original.contains(key) && !keys.contains("") && Set(keys).count == keys.count
    indices =
      active ? Dictionary(uniqueKeysWithValues: destination.enumerated().map { ($1, $0) }) : [:]
  }
  var valid: Bool {
    active && version == revision() && original == sourceKeys() && destination == targetKeys()
  }
  func proposal(at point: CGFloat?) -> JoltListTransferMove? {
    guard valid, let from = original.firstIndex(of: key) else {
      active = false
      return nil
    }
    var slot = destination.count
    if let point, !destination.isEmpty {
      let rows = centers()
      let sign: CGFloat = reverse ? -1 : 1
      guard !rows.isEmpty else { return nil }
      var previous = -1
      var previousCenter = -CGFloat.infinity
      var insertion: Int?
      for row in rows {
        let center = row.center * sign
        guard let index = indices[row.key], index > previous, center.isFinite,
          center > previousCenter
        else { return nil }
        if insertion == nil && point * sign < center { insertion = index }
        previous = index
        previousCenter = center
      }
      slot = insertion ?? previous + 1
    }
    return .init(
      key: key, fromIndex: from, toIndex: slot,
      beforeKey: destination.indices.contains(slot) ? destination[slot] : nil)
  }
  func display(_ move: JoltListTransferMove?) {
    guard last != move else { return }
    last = move
    preview(move)
  }
  func cancel() {
    active = false
    display(nil)
  }
}
