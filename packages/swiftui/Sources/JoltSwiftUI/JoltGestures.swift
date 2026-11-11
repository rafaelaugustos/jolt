import JoltCore
import SwiftUI

public typealias JoltGesturePosition = JoltCore.JoltGesturePosition
public typealias JoltReorderMove = JoltCore.JoltReorderMove
public typealias JoltDropRect = JoltCore.JoltDropRect
public typealias JoltDropPadding = JoltCore.JoltDropPadding
public enum JoltGestureContact: Hashable, Sendable { case pan, pinch, rotation }

/// Incremental contact updates preserve the focal point. Bounds may intentionally limit that preservation.
@MainActor public final class JoltGestureModel: ObservableObject, JoltResource {
  @Published public private(set) var position: JoltGesturePosition
  @Published public private(set) var contacts: Set<JoltGestureContact> = []
  public private(set) var disposed = false
  public private(set) var suspended = false
  public let bounds: JoltDragBounds, scaleRange: ClosedRange<Double>
  public let values: [String: JoltMotionValue]
  private let group: JoltPropertyGroup
  private var observations: [JoltObservation] = []
  private var paused = false
  public init(
    at initial: JoltGesturePosition = try! .init(), bounds: JoltDragBounds,
    scale: ClosedRange<Double> = 0.5...3, clock: JoltClock = .shared
  ) throws {
    guard scale.lowerBound.isFinite, scale.upperBound.isFinite, scale.lowerBound > 0,
      scale.upperBound <= 100
    else { throw JoltError.invalidMotion }
    self.bounds = bounds
    scaleRange = scale
    let initial = try JoltGesturePosition(
      x: min(bounds.x.upperBound, max(bounds.x.lowerBound, initial.x)),
      y: min(bounds.y.upperBound, max(bounds.y.lowerBound, initial.y)),
      scale: min(scale.upperBound, max(scale.lowerBound, initial.scale)), rotate: initial.rotate)
    position = initial
    values = try [
      "x": .init(initial.x, clock: clock), "y": .init(initial.y, clock: clock),
      "scale": .init(initial.scale, clock: clock), "rotate": .init(initial.rotate, clock: clock),
    ]
    group = try .init(values, clock: clock)
    for value in values.values {
      observations.append(try value.subscribe { [weak self] _ in self?.publish() })
    }
  }
  private func publish() {
    // Keep visual constraints even during a spring's overshoot.
    if let next = try? constrained(
      .init(
        x: values["x"]!.value, y: values["y"]!.value,
        scale: max(0.0001, values["scale"]!.value), rotate: values["rotate"]!.value))
    {
      position = next
    }
  }
  private func constrained(_ next: JoltGesturePosition) throws -> JoltGesturePosition {
    try .init(
      x: min(bounds.x.upperBound, max(bounds.x.lowerBound, next.x)),
      y: min(bounds.y.upperBound, max(bounds.y.lowerBound, next.y)),
      scale: min(scaleRange.upperBound, max(scaleRange.lowerBound, next.scale)), rotate: next.rotate
    )
  }
  @discardableResult public func begin(_ contact: JoltGestureContact) -> Bool {
    guard !disposed, !paused, !suspended else { return false }
    group.cancel()
    contacts.insert(contact)
    return true
  }
  public func change(
    pan: CGSize = .zero, magnification: Double = 1, rotation: Double = 0,
    around focal: CGPoint = .zero
  ) throws {
    guard !disposed, !paused, !suspended, magnification.isFinite, magnification > 0,
      rotation.isFinite
    else { throw JoltError.invalidMotion }
    let scale = min(
      scaleRange.upperBound, max(scaleRange.lowerBound, position.scale * magnification))
    let next = try constrained(
      position.transformed(
        scale: scale, rotate: position.rotate + rotation,
        focalX: focal.x, focalY: focal.y, panX: pan.width, panY: pan.height))
    group.cancel()
    try values["x"]!.set(next.x)
    try values["y"]!.set(next.y)
    try values["scale"]!.set(next.scale)
    try values["rotate"]!.set(next.rotate)
  }
  public func end(_ contact: JoltGestureContact) { contacts.remove(contact) }
  public func cancel() {
    contacts.removeAll()
    group.cancel()
  }
  public func settle(
    to target: JoltGesturePosition, transition: JoltTransition = .spring(.snappy),
    reducedMotion: Bool = false
  ) throws {
    guard !disposed, !paused, !suspended else { throw JoltError.disposed }
    let next = try constrained(target)
    contacts.removeAll()
    try group.animate(
      to: ["x": next.x, "y": next.y, "scale": next.scale, "rotate": next.rotate],
      transition: transition, reducedMotion: reducedMotion)
  }
  public func pause() {
    guard !disposed else { return }
    paused = true
    contacts.removeAll()
    group.pause()
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    group.play()
  }
  public func suspend() {
    guard !disposed else { return }
    suspended = true
    contacts.removeAll()
    group.suspend()
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    group.resume()
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    contacts.removeAll()
    group.dispose()
    observations.forEach { $0.dispose() }
    observations.removeAll()
    values.values.forEach { $0.dispose() }
  }
}
private struct GestureMotion: ViewModifier {
  @ObservedObject var model: JoltGestureModel
  @JoltSceneActivity private var sceneActive
  @Environment(\.isEnabled) private var enabled
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  @GestureState private var active = false
  @State private var pan = CGSize.zero
  @State private var scale = 1.0
  @State private var rotation = 0.0
  @State private var visible = false
  @State private var size = CGSize.zero
  private func sync() {
    if visible && enabled && sceneActive {
      model.resume()
    } else {
      model.suspend()
      reset()
    }
  }
  private func reset() {
    pan = .zero
    scale = 1
    rotation = 0
    model.cancel()
  }
  private func focal(_ anchor: UnitPoint) -> CGPoint {
    let p = model.position
    let angle = p.rotate * .pi / 180
    let x = (Double(anchor.x) - 0.5) * Double(size.width) * p.scale
    let y = (Double(anchor.y) - 0.5) * Double(size.height) * p.scale
    return .init(x: p.x + cos(angle) * x - sin(angle) * y, y: p.y + sin(angle) * x + cos(angle) * y)
  }
  private var input: some Gesture {
    let drag = DragGesture(minimumDistance: 3, coordinateSpace: .global)
      .onChanged { event in
        guard model.begin(.pan) else { return }
        try? model.change(
          pan: .init(
            width: event.translation.width - pan.width,
            height: event.translation.height - pan.height))
        pan = event.translation
      }.onEnded { _ in
        pan = .zero
        model.end(.pan)
      }
    let pinch = MagnifyGesture()
      .onChanged { event in
        guard model.begin(.pinch) else { return }
        try? model.change(
          magnification: event.magnification / scale, around: focal(event.startAnchor))
        scale = event.magnification
      }.onEnded { _ in
        scale = 1
        model.end(.pinch)
      }
    let turn = RotateGesture()
      .onChanged { event in
        guard model.begin(.rotation) else { return }
        try? model.change(
          rotation: event.rotation.degrees - rotation, around: focal(event.startAnchor))
        rotation = event.rotation.degrees
      }.onEnded { _ in
        rotation = 0
        model.end(.rotation)
      }
    return drag.simultaneously(with: pinch.simultaneously(with: turn))
      .updating($active) { _, state, _ in state = true }
  }
  func body(content: Content) -> some View {
    content.background {
      #if os(iOS)
        NativeGestureInput(model: model)
      #endif
    }.background(
      GeometryReader { geometry in
        Color.clear.onAppear { size = geometry.size }
          .onChange(of: geometry.size) { _, next in size = next }
      }
    )
    .scaleEffect(model.position.scale).rotationEffect(.degrees(model.position.rotate))
    .offset(x: model.position.x, y: model.position.y).transaction { $0.animation = nil }
    .modifier(PlatformGesture(input: input))
    .accessibilityAdjustableAction { direction in
      try? model.change(
        magnification: direction == .increment ? 1.2 : 1 / 1.2,
        around: .init(x: model.position.x, y: model.position.y))
    }
    .accessibilityAction(named: Text("Rotate left")) {
      try? model.change(rotation: -15, around: .init(x: model.position.x, y: model.position.y))
    }
    .accessibilityAction(named: Text("Rotate right")) {
      try? model.change(rotation: 15, around: .init(x: model.position.x, y: model.position.y))
    }
    .accessibilityAction(named: Text("Reset transform")) {
      try? model.settle(to: .init(), reducedMotion: reduced || appReduced)
    }
    .onAppear {
      visible = true
      sync()
    }.onDisappear {
      visible = false
      sync()
    }
    .onChange(of: sceneActive) { _, _ in sync() }.onChange(of: enabled) { _, _ in sync() }
    .onChange(of: active) { _, next in if !next { reset() } }
    .modifier(JoltActivityProvider($sceneActive))
  }
}
private struct PlatformGesture<Input: Gesture>: ViewModifier {
  let input: Input
  func body(content: Content) -> some View {
    #if os(iOS)
      content
    #else
      // A Button's own gesture can consume drag on older macOS versions.
      // The composed gesture wins once drag/pinch/rotation recognizes; taps remain available.
      content.highPriorityGesture(input)
    #endif
  }
}
extension View {
  public func joltGestures(_ model: JoltGestureModel) -> some View {
    modifier(GestureMotion(model: model))
  }
}
