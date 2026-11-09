import Combine
import JoltCore
import SwiftUI

public struct JoltInspectionEvent: Identifiable, Equatable, Sendable {
  public let id: UUID
  public let label: String
  public let kind: String
  public let time: Double
  public let value: Double?
  public let target: Double?
  public let state: String
}
public struct JoltInspectedValue: Identifiable, Equatable, Sendable {
  public let id: UUID
  public let label: String
  public let value: Double
  public let target: Double
  public let velocity: Double
  public let state: JoltPlaybackState
  /// These are sampled scalar data, never a GPU/presentation measurement.
  public let source = "sampled-scalar"
}
@MainActor private final class InspectedValue {
  weak var value: JoltMotionValue?
  let label: String
  var subscription: AnyCancellable?
  init(_ value: JoltMotionValue, label: String) {
    self.value = value
    self.label = label
  }
}
@MainActor private final class InspectedScope {
  weak var scope: JoltScope?
  let label: String
  var subscription: AnyCancellable?
  init(_ scope: JoltScope, label: String) {
    self.scope = scope
    self.label = label
  }
}
/// Explicit opt-in, bounded subscription diagnostics. Release builds do not attach observers.
@MainActor public final class JoltInspector: ObservableObject {
  public let enabled: Bool
  public let capacity: Int
  @Published public private(set) var events: [JoltInspectionEvent] = []
  private var values: [UUID: InspectedValue] = [:]
  private var scopes: [UUID: InspectedScope] = [:]
  private let clock: JoltClock
  private var clockObservation: AnyCancellable?
  public init(development: Bool = false, capacity: Int = 120, clock: JoltClock = .shared) throws {
    guard (1...4096).contains(capacity) else { throw JoltError.invalidMotion }
    #if DEBUG
      self.enabled = development
    #else
      self.enabled = false
    #endif
    self.capacity = capacity
    self.clock = clock
    if enabled {
      clockObservation = clock.$activeCount.dropFirst().sink { [weak self] count in
        self?.append(
          label: "clock", kind: "activity", value: Double(count), target: nil,
          state: count == 0 ? "idle" : "active")
      }
    }
  }
  public var activeClockClients: Int { enabled ? clock.activeCount : 0 }
  public var resourceCount: Int {
    enabled ? scopes.values.reduce(0) { $0 + ($1.scope?.count ?? 0) } : 0
  }
  public func snapshot() -> [JoltInspectedValue] {
    guard enabled else { return [] }
    return values.compactMap { id, watch in
      guard let value = watch.value else { return nil }
      return .init(
        id: id, label: watch.label, value: value.value, target: value.target,
        velocity: value.velocity, state: value.state)
    }.sorted { $0.label < $1.label }
  }
  /// Retain the observation in the UI owner. Dropping it detaches diagnostics without disposing the value.
  public func watch(_ value: JoltMotionValue, label: String) throws -> JoltObservation {
    guard !label.isEmpty, label.count <= 128 else { throw JoltError.invalidMotion }
    guard enabled else { return JoltObservation {} }
    let id = UUID()
    let watch = InspectedValue(value, label: label)
    values[id] = watch
    var previousTarget = value.target
    var previousState = value.state
    watch.subscription = value.$value.combineLatest(value.$target, value.$state).sink {
      [weak self] sample, target, state in
      let kind = target != previousTarget ? "target" : state != previousState ? "state" : "sample"
      previousTarget = target
      previousState = state
      self?.append(label: label, kind: kind, value: sample, target: target, state: state.rawValue)
    }
    return JoltObservation { [weak self] in
      self?.values.removeValue(forKey: id)?.subscription?.cancel()
    }
  }
  public func watch(_ scope: JoltScope, label: String) throws -> JoltObservation {
    guard !label.isEmpty, label.count <= 128 else { throw JoltError.invalidMotion }
    guard enabled else { return JoltObservation {} }
    let id = UUID()
    let watch = InspectedScope(scope, label: label)
    scopes[id] = watch
    watch.subscription = scope.$count.combineLatest(scope.$suspended, scope.$disposed).sink {
      [weak self] count, suspended, disposed in
      self?.append(
        label: label, kind: "ownership", value: Double(count), target: nil,
        state: disposed ? "disposed" : suspended ? "suspended" : "active")
    }
    return JoltObservation { [weak self] in
      self?.scopes.removeValue(forKey: id)?.subscription?.cancel()
    }
  }
  public func pause(_ id: UUID) { if enabled { values[id]?.value?.pause() } }
  public func play(_ id: UUID) { if enabled { values[id]?.value?.play() } }
  public func cancel(_ id: UUID) { if enabled { values[id]?.value?.cancel() } }
  public func clear() { events.removeAll() }
  public func dispose() {
    clockObservation = nil
    values.removeAll()
    scopes.removeAll()
    events.removeAll()
  }
  private func append(label: String, kind: String, value: Double?, target: Double?, state: String) {
    events.append(
      .init(
        id: UUID(), label: label, kind: kind, time: clock.now, value: value, target: target,
        state: state))
    if events.count > capacity { events.removeFirst(events.count - capacity) }
  }
}
/// A small development panel; no polling timer, GPU timing or presentation-layer claim.
public struct JoltInspectorPanel: View {
  @ObservedObject private var inspector: JoltInspector
  public init(_ inspector: JoltInspector) { self.inspector = inspector }
  public var body: some View {
    if inspector.enabled {
      VStack(alignment: .leading, spacing: 8) {
        Text("Jolt Inspector · sampled scalars").font(.headline)
        Text(
          "Resources: \(inspector.resourceCount) · Clock clients: \(inspector.activeClockClients)"
        ).font(.caption.monospacedDigit())
        ForEach(inspector.snapshot()) { sample in
          VStack(alignment: .leading) {
            Text(
              "\(sample.label): \(sample.value, specifier:"%.2f") → \(sample.target, specifier:"%.2f") · \(sample.state.rawValue)"
            ).font(.caption.monospacedDigit())
            HStack {
              Button("Pause") { inspector.pause(sample.id) }
              Button("Play") { inspector.play(sample.id) }
              Button("Cancel") { inspector.cancel(sample.id) }
            }.buttonStyle(.bordered).controlSize(.mini)
          }
        }
        Text("History: \(inspector.events.count)/\(inspector.capacity)").font(.caption)
      }.padding().background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
    }
  }
}
