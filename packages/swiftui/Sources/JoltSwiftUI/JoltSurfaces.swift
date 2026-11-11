import Combine
import JoltCore
import SwiftUI

/// A constant, or a borrowed motion value the paint follows. The caller owns the value's
/// animation; disposing the paint never disposes the value.
public enum JoltNumberSource: ExpressibleByFloatLiteral, ExpressibleByIntegerLiteral {
  case constant(Double)
  case value(JoltMotionValue)
  public init(floatLiteral value: Double) { self = .constant(value) }
  public init(integerLiteral value: Int) { self = .constant(Double(value)) }
}
/// A constant colour, or a borrowed JoltColorValue the paint follows.
public enum JoltColorSource {
  case constant(JoltColor)
  case value(JoltColorValue)
}

/// Follows borrowed sources while a view shows the paint in an active scene. Pausing,
/// suspending or leaving the screen holds the last frame; showing it again catches up.
@MainActor private final class SourceFollower {
  private var observations: [JoltObservation] = []
  private var cancellables: [AnyCancellable] = []
  private(set) var colors: [Int: JoltColor] = [:]
  var following: Bool { !observations.isEmpty || !cancellables.isEmpty }
  func follow(
    numbers: [JoltNumberSource], colors sources: [JoltColorSource],
    _ changed: @escaping @MainActor () -> Void
  ) {
    stop()
    for source in numbers {
      if case .value(let value) = source, !value.disposed,
        let observation = try? value.subscribe({ _ in changed() })
      {
        observations.append(observation)
      }
    }
    for (index, source) in sources.enumerated() {
      guard case .value(let value) = source, !value.disposed else { continue }
      colors[index] = value.value
      cancellables.append(
        value.$value.dropFirst().sink { [weak self] next in
          MainActor.assumeIsolated {
            self?.colors[index] = next
            changed()
          }
        })
    }
  }
  func stop() {
    for observation in observations { observation.dispose() }
    observations.removeAll()
    cancellables.removeAll()
    colors.removeAll()
  }
  static func number(_ source: JoltNumberSource, settled: Bool) -> Double {
    switch source {
    case .constant(let value): value
    case .value(let value): settled ? value.target : value.value
    }
  }
}

/// A linear gradient painted behind a view and clipped to a shape: 2–8 colours, one stop per
/// colour in 0...1 and a CSS angle in degrees (180 runs top to bottom, 90 left to right).
/// Bound stops are clamped and kept in order. The colour count is fixed for its lifetime.
@MainActor public final class JoltGradient: ObservableObject, JoltResource, JoltViewLinked {
  public struct Frame: Equatable, Sendable {
    public let colors: [JoltColor]
    public let stops: [Double]
    public let angle: Double
  }
  /// The frame on screen.
  @Published public private(set) var frame: Frame
  /// The frame with bound angle and stops at their motion targets, shown under reduced motion.
  @Published public private(set) var settled: Frame
  public private(set) var disposed = false
  public private(set) var paused = false
  public private(set) var suspended = false
  public var following: Bool { follower.following }
  private var colors: [JoltColorSource], stops: [JoltNumberSource], angle: JoltNumberSource
  private let follower = SourceFollower()
  let links = JoltViewLinks()
  /// Stops default to even spacing; the angle defaults to 180 (top to bottom).
  public init(
    colors: [JoltColorSource], stops: [JoltNumberSource]? = nil, angle: JoltNumberSource = 180
  ) throws {
    let stops = stops ?? Self.even(colors.count)
    try Self.validate(colors, stops, angle, count: nil)
    self.colors = colors
    self.stops = stops
    self.angle = angle
    let empty = Frame(colors: [], stops: [], angle: 0)
    frame = empty
    settled = empty
    refresh()
  }
  public convenience init(colors: [JoltColor], stops: [Double]? = nil, angle: Double = 180) throws {
    try self.init(
      colors: colors.map { .constant($0) }, stops: stops?.map { .constant($0) },
      angle: .constant(angle))
  }
  /// Replaces the supplied components after validating all of them. Colours keep their count.
  public func update(
    colors: [JoltColorSource]? = nil, stops: [JoltNumberSource]? = nil,
    angle: JoltNumberSource? = nil
  ) throws {
    guard !disposed else { throw JoltError.disposed }
    try Self.validate(
      colors ?? self.colors, stops ?? self.stops, angle ?? self.angle, count: self.colors.count)
    if let colors { self.colors = colors }
    if let stops { self.stops = stops }
    if let angle { self.angle = angle }
    connect(restart: true)
    refresh()
  }
  private static func even(_ count: Int) -> [JoltNumberSource] {
    count < 2 ? [] : (0..<count).map { .constant(Double($0) / Double(count - 1)) }
  }
  private static func validate(
    _ colors: [JoltColorSource], _ stops: [JoltNumberSource], _ angle: JoltNumberSource,
    count: Int?
  ) throws {
    guard (2...8).contains(colors.count), count.map({ $0 == colors.count }) ?? true,
      stops.count == colors.count
    else { throw JoltError.invalidMotion }
    for color in colors {
      if case .value(let value) = color, value.disposed { throw JoltError.disposed }
    }
    var constants: [Double] = []
    for stop in stops {
      switch stop {
      case .constant(let value):
        guard value.isFinite, (0...1).contains(value) else { throw JoltError.invalidMotion }
        constants.append(value)
      case .value(let value):
        guard !value.disposed else { throw JoltError.disposed }
      }
    }
    if constants.count == stops.count, zip(constants, constants.dropFirst()).contains(where: >) {
      throw JoltError.invalidMotion
    }
    switch angle {
    case .constant(let value): guard value.isFinite else { throw JoltError.invalidMotion }
    case .value(let value): guard !value.disposed else { throw JoltError.disposed }
    }
  }
  private func refresh() {
    guard !disposed else { return }
    let paint = colors.enumerated().map { index, source in
      switch source {
      case .constant(let color): color
      case .value(let value): follower.colors[index] ?? value.value
      }
    }
    func make(_ settled: Bool) -> Frame {
      Frame(
        colors: paint,
        stops: JoltEffects.projectedStops(
          stops.map { SourceFollower.number($0, settled: settled) }),
        angle: SourceFollower.number(angle, settled: settled))
    }
    let live = make(false)
    let target = make(true)
    if live != frame { frame = live }
    if target != settled { settled = target }
  }
  private func connect(restart: Bool = false) {
    let go = !disposed && !paused && !suspended && links.shown
    if go && (restart || !follower.following) {
      follower.follow(numbers: stops + [angle], colors: colors) { [weak self] in self?.refresh() }
      refresh()
    } else if !go {
      follower.stop()
    }
  }
  func link(_ id: UUID, active: Bool, reduced: Bool) {
    guard !disposed else { return }
    links.set(id, active: active, reduced: reduced)
    connect()
  }
  func unlink(_ id: UUID) {
    links.remove(id)
    connect()
  }
  public func pause() {
    guard !disposed else { return }
    paused = true
    connect()
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    connect()
  }
  public func suspend() {
    guard !disposed else { return }
    suspended = true
    connect()
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    connect()
  }
  /// Stops following its sources and removes the gradient from every view.
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    follower.stop()
    objectWillChange.send()
  }
  /// SwiftUI paint for a `width` × `height` box.
  public static func paint(_ frame: Frame, width: Double, height: Double) -> LinearGradient {
    let line = try? JoltGradientLine(angle: frame.angle, width: width, height: height)
    return LinearGradient(
      stops: zip(frame.colors, frame.stops).map {
        Gradient.Stop(color: $0.swiftUIColor, location: $1)
      },
      startPoint: .init(x: line?.startX ?? 0.5, y: line?.startY ?? 0),
      endPoint: .init(x: line?.endX ?? 0.5, y: line?.endY ?? 1))
  }
}

/// Content blur with the Web's meaning: the applied radius is `amount` (0...1) times `radius`
/// (1...64 points, default 24). A bound amount is clamped to 0...1.
@MainActor public final class JoltBlur: ObservableObject, JoltResource, JoltViewLinked {
  public let radius: Double
  /// The amount on screen.
  @Published public private(set) var amount: Double
  /// The amount at a bound value's target, shown under reduced motion.
  @Published public private(set) var settledAmount: Double
  public private(set) var disposed = false
  public private(set) var paused = false
  public private(set) var suspended = false
  public var appliedRadius: Double { disposed ? 0 : amount * radius }
  public var following: Bool { follower.following }
  private var source: JoltNumberSource
  private let follower = SourceFollower()
  let links = JoltViewLinks()
  public init(amount: JoltNumberSource = 0, radius: Double = 24) throws {
    guard radius.isFinite, (1...64).contains(radius) else { throw JoltError.invalidMotion }
    try Self.validate(amount)
    self.radius = radius
    source = amount
    self.amount = 0
    settledAmount = 0
    refresh()
  }
  /// Replaces the amount: a constant in 0...1 or a borrowed value.
  public func update(amount: JoltNumberSource) throws {
    guard !disposed else { throw JoltError.disposed }
    try Self.validate(amount)
    source = amount
    connect(restart: true)
    refresh()
  }
  private static func validate(_ amount: JoltNumberSource) throws {
    switch amount {
    case .constant(let value):
      guard value.isFinite, (0...1).contains(value) else { throw JoltError.invalidMotion }
    case .value(let value): guard !value.disposed else { throw JoltError.disposed }
    }
  }
  private func refresh() {
    guard !disposed else { return }
    let live = min(1, max(0, SourceFollower.number(source, settled: false)))
    let target = min(1, max(0, SourceFollower.number(source, settled: true)))
    if live != amount { amount = live }
    if target != settledAmount { settledAmount = target }
  }
  private func connect(restart: Bool = false) {
    let go = !disposed && !paused && !suspended && links.shown
    if go && (restart || !follower.following) {
      follower.follow(numbers: [source], colors: []) { [weak self] in self?.refresh() }
      refresh()
    } else if !go {
      follower.stop()
    }
  }
  func link(_ id: UUID, active: Bool, reduced: Bool) {
    guard !disposed else { return }
    links.set(id, active: active, reduced: reduced)
    connect()
  }
  func unlink(_ id: UUID) {
    links.remove(id)
    connect()
  }
  public func pause() {
    guard !disposed else { return }
    paused = true
    connect()
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    connect()
  }
  public func suspend() {
    guard !disposed else { return }
    suspended = true
    connect()
  }
  public func resume() {
    guard !disposed else { return }
    suspended = false
    connect()
  }
  /// Stops following the amount and removes the blur from every view.
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    follower.stop()
    objectWillChange.send()
  }
}

private struct GradientModifier<S: Shape>: ViewModifier {
  @ObservedObject var gradient: JoltGradient
  let shape: S
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    content.background {
      GeometryReader { geometry in
        if !gradient.disposed {
          shape.fill(
            JoltGradient.paint(
              reduced || appReduced ? gradient.settled : gradient.frame,
              width: geometry.size.width, height: geometry.size.height))
        }
      }
      .allowsHitTesting(false).accessibilityHidden(true).transaction { $0.animation = nil }
    }
    .modifier(JoltLinkModifier(resource: gradient))
  }
}

private struct BlurModifier: ViewModifier {
  @ObservedObject var blur: JoltBlur
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    let amount = blur.disposed ? 0 : reduced || appReduced ? blur.settledAmount : blur.amount
    content.animation(nil) { $0.blur(radius: amount * blur.radius, opaque: false) }
      .modifier(JoltLinkModifier(resource: blur))
  }
}

extension View {
  /// Paints the gradient behind this view inside `shape`. Under reduced motion bound angle and
  /// stops show their motion targets; colours keep following their values.
  public func joltGradient<S: Shape>(_ gradient: JoltGradient, in shape: S) -> some View {
    modifier(GradientModifier(gradient: gradient, shape: shape))
  }
  public func joltGradient(_ gradient: JoltGradient) -> some View {
    joltGradient(gradient, in: Rectangle())
  }
  /// Blurs this view's own content. Under reduced motion a bound amount shows its target.
  public func joltBlur(_ blur: JoltBlur) -> some View { modifier(BlurModifier(blur: blur)) }
}
