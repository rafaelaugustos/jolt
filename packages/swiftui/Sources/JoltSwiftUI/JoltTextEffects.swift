import JoltCore
import SwiftUI

public typealias JoltText = JoltCore.JoltText
public typealias JoltTextSplit = JoltCore.JoltTextSplit
public typealias JoltTextPiece = JoltCore.JoltTextPiece
public typealias JoltTextEntranceOptions = JoltCore.JoltTextEntranceOptions
public typealias JoltRollOptions = JoltCore.JoltRollOptions
public typealias JoltRollDirection = JoltCore.JoltRollDirection
public typealias JoltRollDiff = JoltCore.JoltRollDiff
public typealias JoltRollChange = JoltCore.JoltRollChange

/// iOS 18 and macOS 15 draw the pieces of one laid-out Text; earlier systems show the final text.
@MainActor private var piecesRender: Bool {
  if #available(iOS 18, macOS 15, *) { true } else { false }
}

/// A replayable entrance of one string, split by word or grapheme. Each visible piece fades in
/// and rises to its place; the text keeps its native layout and one accessibility element.
@MainActor public final class JoltTextEntrance: ObservableObject, JoltResource {
  public let options: JoltTextEntranceOptions
  public let clock: JoltClock
  @Published public private(set) var text: String
  @Published public private(set) var state: JoltPlaybackState = .idle
  /// Milliseconds since the first piece's clock started, frozen while paused or suspended.
  @Published public private(set) var elapsed: Double = 0
  public private(set) var pieces: [JoltTextPiece]
  /// Milliseconds until the last visible piece arrives.
  public private(set) var duration: Double
  public private(set) var disposed = false
  public private(set) var paused = false
  public private(set) var suspended = false
  private let reducedMotion: Bool
  private var viewReduced = false
  private var subscription: ClockSubscription?
  private var started = 0.0
  private var baseline = 0.0

  /// At most 256 graphemes, and the last piece must arrive within 60 seconds. With `autoplay`
  /// false the entrance waits, hidden, at its first frame until `play()` or `replay()`.
  public init(
    _ text: String, options: JoltTextEntranceOptions = try! .init(), clock: JoltClock = .shared,
    reducedMotion: Bool = false, autoplay: Bool = true
  ) throws {
    let prepared = try Self.prepare(text, options)
    self.text = text
    self.options = options
    self.clock = clock
    self.reducedMotion = reducedMotion
    pieces = prepared.pieces
    duration = prepared.duration
    paused = !autoplay
    start()
  }
  private static func prepare(_ text: String, _ options: JoltTextEntranceOptions) throws -> (
    pieces: [JoltTextPiece], duration: Double
  ) {
    guard text.count <= JoltText.maximumGraphemes else { throw JoltError.invalidMotion }
    let pieces = JoltText.pieces(text, by: options.split)
    let duration = options.duration(of: pieces)
    guard duration <= 60_000 else { throw JoltError.invalidMotion }
    return (pieces, duration)
  }
  public var progress: Double {
    if state == .completed || state == .cancelled || state == .disposed { return 1 }
    return duration > 0 ? min(1, elapsed / duration) : 0
  }
  /// Starts again from the first piece and clears a manual pause.
  public func replay() {
    guard !disposed else { return }
    stopClock()
    elapsed = 0
    paused = false
    state = .idle
    start()
  }
  /// Replaces the text and replays. Invalid text throws and leaves the current entrance as it is.
  public func replay(_ text: String) throws {
    guard !disposed else { throw JoltError.disposed }
    let prepared = try Self.prepare(text, options)
    self.text = text
    pieces = prepared.pieces
    duration = prepared.duration
    replay()
  }
  /// Shows the whole text now. `replay()` can start it again.
  public func cancel() {
    guard !disposed, isPlaying else { return }
    stopClock()
    elapsed = duration
    state = .cancelled
  }
  public func pause() {
    guard !disposed else { return }
    freeze()
    paused = true
    updateState()
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    start()
  }
  public func suspend() {
    guard !disposed, !suspended else { return }
    freeze()
    suspended = true
    updateState()
  }
  public func resume() {
    guard !disposed, suspended else { return }
    suspended = false
    start()
  }
  public func dispose() {
    guard !disposed else { return }
    stopClock()
    disposed = true
    elapsed = duration
    state = .disposed
  }
  var isPlaying: Bool {
    state == .idle || state == .running || state == .paused || state == .suspended
  }
  func reduceMotion(_ value: Bool) {
    viewReduced = value
    if value, isPlaying { settle() }
  }
  private func start() {
    guard !disposed, isPlaying else { return }
    if reducedMotion || viewReduced || clock.reducedMotion || !piecesRender || options.duration == 0
      || duration == 0 || elapsed >= duration
    {
      return settle()
    }
    updateState()
    guard !paused, !suspended, subscription == nil else { return }
    started = clock.now
    baseline = elapsed
    subscription = clock.subscribe { [weak self] now in self?.tick(now) }
  }
  private func tick(_ now: Double) {
    guard state == .running else { return }
    let next = baseline + max(0, now - started)
    if clock.reducedMotion || next >= duration { settle() } else { elapsed = next }
  }
  private func settle() {
    stopClock()
    elapsed = duration
    state = .completed
  }
  private func freeze() {
    if subscription != nil { elapsed = min(duration, baseline + max(0, clock.now - started)) }
    stopClock()
  }
  private func stopClock() {
    subscription?.cancel()
    subscription = nil
  }
  private func updateState() {
    guard isPlaying else { return }
    state = suspended ? .suspended : paused ? .paused : .running
  }
}

/// Draws a `JoltTextEntrance` as one SwiftUI Text, styled by the surrounding font, color and
/// alignment modifiers. VoiceOver reads the whole string once while the pieces move.
public struct JoltAnimatedText: View {
  @ObservedObject private var entrance: JoltTextEntrance
  @JoltSceneActivity private var sceneActive
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  @State private var visible = false
  public init(_ entrance: JoltTextEntrance) { self.entrance = entrance }
  public var body: some View {
    content
      .accessibilityLabel(Text(verbatim: entrance.text))
      .onAppear {
        visible = true
        synchronize()
      }
      .onDisappear {
        visible = false
        synchronize()
      }
      .onChange(of: sceneActive) { _, _ in synchronize() }
      .onChange(of: reduced || appReduced, initial: true) { _, next in entrance.reduceMotion(next) }
      .onChange(of: ObjectIdentifier(entrance)) { _, _ in
        entrance.reduceMotion(reduced || appReduced)
        synchronize()
      }
      .transaction { $0.animation = nil }
      .modifier(JoltActivityProvider($sceneActive))
  }
  @ViewBuilder private var content: some View {
    if #available(iOS 18, macOS 15, *), entrance.isPlaying, !reduced, !appReduced {
      JoltPieceText.text(entrance.pieces).textRenderer(
        EntranceRenderer(
          options: entrance.options, pieces: entrance.pieces, elapsed: entrance.elapsed))
    } else {
      Text(verbatim: entrance.text)
    }
  }
  private func synchronize() {
    if visible && sceneActive { entrance.resume() } else { entrance.suspend() }
  }
}

/// A number shown through an application formatter. A new target sets the text, and the
/// accessibility value, at once; only the drawing rolls from what is on screen.
@MainActor public final class JoltRollingNumber: ObservableObject, JoltResource {
  public let options: JoltRollOptions
  public let clock: JoltClock
  public let format: @MainActor (Double) -> String
  @Published public private(set) var value: Double
  @Published public private(set) var text: String
  @Published public private(set) var state: JoltPlaybackState = .idle
  public private(set) var disposed = false
  public private(set) var paused = false
  public private(set) var suspended = false
  @Published private(set) var layers: [RollLayer]
  private let reducedMotion: Bool
  private var viewReduced = false
  private var time = 0.0
  private var started = 0.0
  private var baseline = 0.0
  private var serial = 0
  private var subscription: ClockSubscription?

  /// `format` must return at most 256 graphemes for every value the app rolls to.
  public init(
    _ value: Double, format: @escaping @MainActor (Double) -> String = JoltRollingNumber.plain,
    options: JoltRollOptions = try! .init(), clock: JoltClock = .shared,
    reducedMotion: Bool = false
  ) throws {
    let text = try Self.validate(value, format)
    self.value = value
    self.text = text
    self.format = format
    self.options = options
    self.clock = clock
    self.reducedMotion = reducedMotion
    layers = [RollLayer(id: 0, text: text)]
  }
  /// Whole numbers without a fraction, other values as Swift's shortest decimal.
  nonisolated public static func plain(_ value: Double) -> String {
    value == value.rounded() && abs(value) < 1e15 ? String(Int64(value)) : String(value)
  }
  private static func validate(_ value: Double, _ format: @MainActor (Double) -> String) throws
    -> String
  {
    guard value.isFinite else { throw JoltError.invalidMotion }
    let text = format(value)
    guard text.count <= JoltText.maximumGraphemes else { throw JoltError.invalidMotion }
    return text
  }

  /// Rolls the changed graphemes, aligned from the end, toward `value`. A roll in progress keeps
  /// going where the glyph stays the same; elsewhere the glyph on screen leaves from its current
  /// position. `direction` overrides the options for this change.
  public func roll(to value: Double, direction: JoltRollDirection? = nil) throws {
    guard !disposed else { throw JoltError.disposed }
    let next = try Self.validate(value, format)
    let now = currentTime()
    let sign = (direction ?? options.direction).sign(from: self.value, to: value)
    let previous = text
    self.value = value
    text = next
    serial += 1
    guard !instant else {
      layers = [RollLayer(id: serial, text: next)]
      return settle()
    }
    let top = layers[0]
    let diff = JoltText.diff(from: previous, to: next)
    var incoming = RollLayer(id: serial, text: next)
    let shift = incoming.pieces.count - top.pieces.count
    let changed = Set(diff.changes.map(\.next.group))
    for piece in incoming.pieces where !changed.contains(piece.group) {
      if let motion = top.motions[piece.group - shift] { incoming.motions[piece.group] = motion }
    }
    let spring = try JoltScalarMotion(from: 0, to: 1, transition: options.transition)
    var leaving = RollLayer(id: top.id, text: top.text, still: false)
    func depart(_ piece: JoltTextPiece, at start: Double) {
      leaving.motions[piece.group] = RollMotion(
        start: start, spring: spring, from: top.pose(piece.group, at: now),
        to: RollPose(y: -sign, opacity: 0))
    }
    for (index, change) in diff.changes.enumerated() {
      let start =
        now + JoltText.staggeredStart(index, stagger: options.stagger, delay: options.delay)
      incoming.motions[change.next.group] = RollMotion(
        start: start, spring: spring, from: RollPose(y: sign, opacity: 0),
        to: RollPose(y: 0, opacity: 1))
      if let old = change.previous { depart(old, at: start) }
    }
    for (index, old) in diff.removed.enumerated() {
      depart(
        old,
        at: now
          + JoltText.staggeredStart(
            diff.changes.count + index, stagger: options.stagger, delay: options.delay))
    }
    layers = Array(([incoming, leaving] + layers.dropFirst()).prefix(8))
    time = now
    prune()
    if layers.count == 1 && layers[0].motions.isEmpty { return settle() }
    state = .idle
    start()
  }
  /// Shows `value` at once and ends any roll.
  public func set(_ value: Double) throws {
    guard !disposed else { throw JoltError.disposed }
    let next = try Self.validate(value, format)
    stopClock()
    self.value = value
    text = next
    serial += 1
    layers = [RollLayer(id: serial, text: next)]
    state = .idle
  }
  /// Ends the roll on the target text.
  public func cancel() {
    guard !disposed, rolling else { return }
    stopClock()
    layers = [RollLayer(id: layers[0].id, text: text)]
    state = .cancelled
  }
  public func pause() {
    guard !disposed else { return }
    freeze()
    paused = true
    updateState()
  }
  public func play() {
    guard !disposed else { return }
    paused = false
    start()
  }
  public func suspend() {
    guard !disposed, !suspended else { return }
    freeze()
    suspended = true
    updateState()
  }
  public func resume() {
    guard !disposed, suspended else { return }
    suspended = false
    start()
  }
  public func dispose() {
    guard !disposed else { return }
    stopClock()
    disposed = true
    layers = [RollLayer(id: layers[0].id, text: text)]
    state = .disposed
  }
  /// Offsets in line heights and opacity for each moving grapheme of `layer`, keyed by group.
  func poses(_ layer: RollLayer) -> [Int: RollPose] {
    layer.motions.mapValues { $0.pose(at: time) }
  }
  var rolling: Bool { layers.count > 1 || !layers[0].motions.isEmpty }
  func reduceMotion(_ value: Bool) {
    viewReduced = value
    if value, rolling { finish() }
  }
  private var instant: Bool { reducedMotion || viewReduced || clock.reducedMotion || !piecesRender }
  private func currentTime() -> Double {
    subscription == nil ? time : baseline + max(0, clock.now - started)
  }
  private func start() {
    guard !disposed, rolling else { return }
    if instant { return finish() }
    updateState()
    guard !paused, !suspended, subscription == nil else { return }
    started = clock.now
    baseline = time
    subscription = clock.subscribe { [weak self] now in self?.tick(now) }
  }
  private func tick(_ now: Double) {
    guard state == .running else { return }
    if clock.reducedMotion { return finish() }
    time = baseline + max(0, now - started)
    prune()
    if rolling { objectWillChange.send() } else { settle() }
  }
  private func prune() {
    for index in layers.indices {
      layers[index].motions = layers[index].motions.filter { !$0.value.done(at: time) }
    }
    layers = [layers[0]] + layers.dropFirst().filter { !$0.motions.isEmpty }
  }
  private func finish() {
    layers = [RollLayer(id: layers[0].id, text: text)]
    settle()
  }
  private func settle() {
    stopClock()
    state = .completed
  }
  private func freeze() {
    if subscription != nil { time = currentTime() }
    stopClock()
  }
  private func stopClock() {
    subscription?.cancel()
    subscription = nil
  }
  private func updateState() {
    guard rolling else { return }
    state = suspended ? .suspended : paused ? .paused : .running
  }
}

struct RollPose: Equatable {
  let y: Double
  let opacity: Double
}
struct RollMotion {
  let start: Double
  let spring: JoltScalarMotion
  let from: RollPose
  let to: RollPose
  func pose(at time: Double) -> RollPose {
    let p = spring.sample(at: time - start).position
    return RollPose(
      y: from.y + (to.y - from.y) * p,
      opacity: min(1, max(0, from.opacity + (to.opacity - from.opacity) * p)))
  }
  func done(at time: Double) -> Bool { time - start >= spring.duration }
}
struct RollLayer: Identifiable {
  let id: Int
  let text: String
  let pieces: [JoltTextPiece]
  /// The current layer draws its still graphemes; a leaving layer draws only moving ones.
  let still: Bool
  var motions: [Int: RollMotion] = [:]
  init(id: Int, text: String, still: Bool = true) {
    self.id = id
    self.text = text
    self.still = still
    pieces = JoltText.graphemes(text)
  }
  func pose(_ group: Int, at time: Double) -> RollPose {
    motions[group]?.pose(at: time) ?? RollPose(y: 0, opacity: 1)
  }
}

/// Draws a `JoltRollingNumber`. Leaving glyphs are laid out at `alignment` within this view's
/// frame, so match the alignment its container uses when the width changes. `tabular` gives
/// every digit the same advance.
public struct JoltRollingText: View {
  @ObservedObject private var number: JoltRollingNumber
  private let tabular: Bool
  private let alignment: HorizontalAlignment
  @JoltSceneActivity private var sceneActive
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  @State private var visible = false
  public init(
    _ number: JoltRollingNumber, tabular: Bool = true, alignment: HorizontalAlignment = .trailing
  ) {
    self.number = number
    self.tabular = tabular
    self.alignment = alignment
  }
  public var body: some View {
    content
      .accessibilityElement(children: .ignore)
      .accessibilityValue(Text(verbatim: number.text))
      .accessibilityAddTraits(.isStaticText)
      .onAppear {
        visible = true
        synchronize()
      }
      .onDisappear {
        visible = false
        synchronize()
      }
      .onChange(of: sceneActive) { _, _ in synchronize() }
      .onChange(of: reduced || appReduced, initial: true) { _, next in number.reduceMotion(next) }
      .onChange(of: ObjectIdentifier(number)) { _, _ in
        number.reduceMotion(reduced || appReduced)
        synchronize()
      }
      .transaction { $0.animation = nil }
      .modifier(JoltActivityProvider($sceneActive))
  }
  @ViewBuilder private var content: some View {
    if #available(iOS 18, macOS 15, *), number.rolling, !reduced, !appReduced {
      let layers = number.layers
      layer(layers[0])
        .overlay(alignment: Alignment(horizontal: alignment, vertical: .firstTextBaseline)) {
          ZStack(alignment: Alignment(horizontal: alignment, vertical: .firstTextBaseline)) {
            ForEach(layers.dropFirst()) { layer($0).fixedSize() }
          }
        }
    } else {
      digits(Text(verbatim: number.text))
    }
  }
  @available(iOS 18, macOS 15, *)
  private func layer(_ layer: RollLayer) -> some View {
    digits(JoltPieceText.text(layer.pieces)).textRenderer(
      RollRenderer(poses: number.poses(layer), still: layer.still))
  }
  private func digits(_ text: Text) -> Text { tabular ? text.monospacedDigit() : text }
  private func synchronize() {
    if visible && sceneActive { number.resume() } else { number.suspend() }
  }
}

@available(iOS 18, macOS 15, *)
private struct JoltPieceAttribute: TextAttribute {
  let group: Int
}

@available(iOS 18, macOS 15, *)
private enum JoltPieceText {
  /// One Text whose runs carry their piece, so layout, wrapping and bidi stay native.
  static func text(_ pieces: [JoltTextPiece]) -> Text {
    var interpolation = LocalizedStringKey.StringInterpolation(
      literalCapacity: 0, interpolationCount: pieces.count)
    for piece in pieces {
      interpolation.appendInterpolation(
        Text(verbatim: piece.text).customAttribute(JoltPieceAttribute(group: piece.group)))
    }
    return Text(LocalizedStringKey(stringInterpolation: interpolation))
  }
}

@available(iOS 18, macOS 15, *)
private struct EntranceRenderer: TextRenderer {
  let options: JoltTextEntranceOptions
  let pieces: [JoltTextPiece]
  let elapsed: Double
  var displayPadding: EdgeInsets {
    EdgeInsets(top: max(0, -options.y), leading: 0, bottom: max(0, options.y), trailing: 0)
  }
  func draw(layout: Text.Layout, in context: inout GraphicsContext) {
    for line in layout {
      for run in line {
        guard let group = run[JoltPieceAttribute.self]?.group, pieces.indices.contains(group)
        else {
          context.draw(run)
          continue
        }
        let progress = options.progress(of: pieces[group], at: elapsed)
        guard progress < 1 else {
          context.draw(run)
          continue
        }
        guard progress > 0 else { continue }
        var piece = context
        piece.opacity *= progress
        piece.translateBy(x: 0, y: options.y * (1 - progress))
        piece.draw(run)
      }
    }
  }
}

@available(iOS 18, macOS 15, *)
private struct RollRenderer: TextRenderer {
  let poses: [Int: RollPose]
  let still: Bool
  func draw(layout: Text.Layout, in context: inout GraphicsContext) {
    for line in layout {
      let bounds = line.typographicBounds.rect
      let window = bounds.insetBy(dx: -bounds.height, dy: -bounds.height * 0.1)
      for run in line {
        guard let pose = run[JoltPieceAttribute.self].flatMap({ poses[$0.group] }) else {
          if still { context.draw(run) }
          continue
        }
        guard pose.opacity > 0 else { continue }
        var glyph = context
        glyph.clip(to: Path(window))
        glyph.opacity *= pose.opacity
        glyph.translateBy(x: 0, y: pose.y * bounds.height)
        glyph.draw(run)
      }
    }
  }
}
