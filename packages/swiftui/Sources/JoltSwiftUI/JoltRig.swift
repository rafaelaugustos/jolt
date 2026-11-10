import JoltCore
import SwiftUI

public typealias JoltRigDefinition = JoltCore.JoltRigDefinition
public typealias JoltRigPart = JoltCore.JoltRigPart
public typealias JoltRigSocket = JoltCore.JoltRigSocket
public typealias JoltRigTransform = JoltCore.JoltRigTransform
public typealias JoltRigLayer = JoltCore.JoltRigLayer
public typealias JoltRigChannel = JoltCore.JoltRigChannel
public typealias JoltAffine = JoltCore.JoltAffine

/// Owns each part's sampled channels and one property-group timeline. Parts are not SwiftUI layout nodes.
@MainActor public final class JoltRig: ObservableObject, JoltResource {
  public let definition: JoltRigDefinition
  @Published public private(set) var revision = 0
  public private(set) var disposed = false
  public var state: JoltPlaybackState { group.state }
  private let values: [String: [JoltRigChannel: JoltMotionValue]]
  private let group: JoltPropertyGroup
  private var observations: [JoltObservation] = []
  private var lastTargets: [String: Double] = [:]
  private var reduced = false
  public init(_ definition: JoltRigDefinition, clock: JoltClock = .shared) throws {
    self.definition = definition
    var parts: [String: [JoltRigChannel: JoltMotionValue]] = [:]
    var channels: [String: JoltMotionValue] = [:]
    for (index, name) in definition.order.enumerated() {
      var values: [JoltRigChannel: JoltMotionValue] = [:]
      for channel in JoltRigChannel.allCases {
        let value = try JoltMotionValue(definition.parts[name]!.rest.value(channel), clock: clock)
        values[channel] = value
        channels["\(index).\(channel.rawValue)"] = value
      }
      parts[name] = values
    }
    values = parts
    group = try .init(channels, clock: clock)
    for value in channels.values {
      observations.append(try value.subscribe { [weak self] _ in self?.revision += 1 })
    }
  }
  public func snapshot() throws -> [String: JoltRigTransform] {
    guard !disposed else { return [:] }
    return try values.mapValues { channels in
      try .init(
        Dictionary(
          uniqueKeysWithValues: channels.map { channel, value in
            let limit = channel == .scaleX || channel == .scaleY ? 100.0 : 1e6
            return (channel, min(limit, max(-limit, value.value)))
          }))
    }
  }
  public func matrices() throws -> [String: JoltAffine] {
    guard !disposed else { return [:] }
    return try definition.matrices(snapshot())
  }
  public func point(_ socket: String) throws -> JoltPoint {
    guard !disposed else { throw JoltError.disposed }
    return try definition.point(socket, transforms: snapshot())
  }
  public func pose(
    _ name: String, transition: JoltTransition = .spring(.smooth), reducedMotion: Bool = false
  ) throws {
    try blend([.init(name)], transition: transition, reducedMotion: reducedMotion)
  }
  public func blend(
    _ layers: [JoltRigLayer], transition: JoltTransition = .spring(.smooth),
    reducedMotion: Bool = false
  ) throws {
    guard !disposed else { throw JoltError.disposed }
    let destination = try definition.destination(layers, current: snapshot())
    var targets: [String: Double] = [:]
    for (index, name) in definition.order.enumerated() {
      for channel in JoltRigChannel.allCases {
        targets["\(index).\(channel.rawValue)"] = destination[name]!.value(channel)
      }
    }
    lastTargets = targets
    try group.animate(to: targets, transition: transition, reducedMotion: reducedMotion || reduced)
  }
  func reduceMotion(_ value: Bool) {
    reduced = value
    if value, !disposed, !lastTargets.isEmpty {
      try? group.animate(to: lastTargets, reducedMotion: true)
    }
  }
  public func pause() { group.pause() }
  public func play() { if !disposed { group.play() } }
  public func suspend() { group.suspend() }
  public func resume() { if !disposed { group.resume() } }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    group.dispose()
    observations.forEach { $0.dispose() }
    observations.removeAll()
    values.values.forEach { $0.values.forEach { $0.dispose() } }
    revision += 1
  }
}
/// One Canvas, with SwiftUI symbols rendered as articulated parts. No per-part hit testing.
public struct JoltRigView<Part: View>: View {
  @ObservedObject private var rig: JoltRig
  private let part: (String) -> Part, label: String
  @Environment(\.scenePhase) private var phase
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  public init(
    _ rig: JoltRig, accessibilityLabel: String, @ViewBuilder part: @escaping (String) -> Part
  ) {
    self.rig = rig
    self.part = part
    label = accessibilityLabel
  }
  public var body: some View {
    let matrices = (try? rig.matrices()) ?? [:]
    Canvas { context, _ in
      for name in rig.definition.order {
        guard let matrix = matrices[name], let symbol = context.resolveSymbol(id: name),
          let part = rig.definition.parts[name]
        else { continue }
        var c = context
        c.concatenate(
          .init(a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, tx: matrix.tx, ty: matrix.ty))
        c.draw(symbol, at: .init(x: part.width / 2, y: part.height / 2))
      }
    } symbols: {
      ForEach(rig.definition.order, id: \.self) { name in
        let geometry = rig.definition.parts[name]!
        part(name).frame(width: geometry.width, height: geometry.height).tag(name)
      }
    }
    .accessibilityLabel(label).accessibilityElement(children: .ignore)
    .onAppear {
      rig.reduceMotion(reduced || appReduced)
      if phase == .active { rig.resume() } else { rig.suspend() }
    }
    .onDisappear { rig.suspend() }
    .onChange(of: phase) { _, next in if next == .active { rig.resume() } else { rig.suspend() } }
    .onChange(of: reduced || appReduced) { _, next in rig.reduceMotion(next) }
  }
}
private struct RigSocketMotion: ViewModifier {
  @ObservedObject var rig: JoltRig
  let name: String
  func body(content: Content) -> some View {
    let point = try? rig.point(name)
    content.position(x: point?.x ?? 0, y: point?.y ?? 0).opacity(point == nil ? 0 : 1)
      .transaction { $0.animation = nil }
  }
}
extension View {
  /// Place in the same untransformed coordinate container as JoltRigView; the accessory is borrowed.
  public func joltRigSocket(_ name: String, in rig: JoltRig) -> some View {
    modifier(RigSocketMotion(rig: rig, name: name))
  }
}
