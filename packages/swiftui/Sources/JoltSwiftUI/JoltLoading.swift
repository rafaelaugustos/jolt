import JoltCore
import SwiftUI

public typealias JoltLoaderStyle = JoltCore.JoltLoaderStyle
public typealias JoltLoaderItem = JoltCore.JoltLoaderItem
public typealias JoltRevealCircle = JoltCore.JoltRevealCircle
public typealias JoltGradientLine = JoltCore.JoltGradientLine
public typealias JoltEffects = JoltCore.JoltEffects

/// The views showing one effect, with the scene activity and reduced motion each one reads.
@MainActor final class JoltViewLinks {
  private var links: [UUID: (active: Bool, reduced: Bool)] = [:]
  private(set) var linked = false
  func set(_ id: UUID, active: Bool, reduced: Bool) {
    links[id] = (active, reduced)
    linked = true
  }
  func remove(_ id: UUID) { links.removeValue(forKey: id) }
  var count: Int { links.count }
  /// A view shows the effect in an active scene.
  var shown: Bool { links.values.contains { $0.active } }
  /// A view in an active scene shows the effect with full motion.
  var moving: Bool { links.values.contains { $0.active && !$0.reduced } }
  var reduced: Bool { links.values.contains { $0.reduced } }
}

@MainActor protocol JoltViewLinked: AnyObject {
  func link(_ id: UUID, active: Bool, reduced: Bool)
  func unlink(_ id: UUID)
}

@MainActor private final class LinkBox {
  weak var resource: (any JoltViewLinked)?
}

/// Reports appearance, scene activity and reduced motion of one view to the effect it shows.
struct JoltLinkModifier: ViewModifier {
  let resource: any JoltViewLinked
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  @JoltSceneActivity private var sceneActive
  @State private var id = UUID()
  @State private var box = LinkBox()
  func body(content: Content) -> some View {
    content
      .onAppear { connect() }
      .onDisappear {
        box.resource?.unlink(id)
        box.resource = nil
      }
      .onChange(of: sceneActive) { _, _ in refresh() }
      .onChange(of: reduced || appReduced) { _, _ in refresh() }
      .onChange(of: ObjectIdentifier(resource)) { _, _ in
        guard box.resource != nil else { return }
        box.resource?.unlink(id)
        connect()
      }
      .modifier(JoltActivityProvider($sceneActive))
  }
  private func connect() {
    box.resource = resource
    resource.link(id, active: sceneActive, reduced: reduced || appReduced)
  }
  private func refresh() {
    box.resource?.link(id, active: sceneActive, reduced: reduced || appReduced)
  }
}

/// A repeating cycle on a JoltClock. It holds a clock subscription only while a view shows it
/// in an active scene with full motion, and while neither paused nor suspended.
@MainActor final class JoltLoop {
  let duration: Double
  let clock: JoltClock
  let links = JoltViewLinks()
  private(set) var elapsed = 0.0
  private(set) var paused = false, suspended = false, disposed = false
  private var base = 0.0, started = 0.0
  private var subscription: ClockSubscription?
  var changed: (@MainActor () -> Void)?
  init(duration: Double, clock: JoltClock) throws {
    guard duration.isFinite, duration > 0, duration <= JoltEffects.maximumDuration else {
      throw JoltError.invalidMotion
    }
    self.duration = duration
    self.clock = clock
  }
  var running: Bool { subscription != nil }
  var state: JoltPlaybackState {
    if disposed { return .disposed }
    if paused { return .paused }
    if suspended || (links.linked && !links.shown) { return .suspended }
    return running ? .running : .idle
  }
  private func reconcile() {
    let still = clock.reducedMotion || (links.shown && !links.moving)
    let run = !disposed && !paused && !suspended && links.moving && !clock.reducedMotion
    if !run { freeze() }
    if still && !disposed { elapsed = 0 }
    if run && subscription == nil {
      base = elapsed
      started = clock.now
      subscription = clock.subscribe { [weak self] now in self?.tick(now) }
    }
    changed?()
  }
  private func tick(_ now: Double) {
    guard subscription != nil else { return }
    if clock.reducedMotion {
      reconcile()
      return
    }
    elapsed = (base + max(0, now - started)).truncatingRemainder(dividingBy: duration)
    changed?()
  }
  private func freeze() {
    guard let subscription else { return }
    elapsed = (base + max(0, clock.now - started)).truncatingRemainder(dividingBy: duration)
    subscription.cancel()
    self.subscription = nil
  }
  func link(_ id: UUID, active: Bool, reduced: Bool) {
    guard !disposed else { return }
    links.set(id, active: active, reduced: reduced)
    reconcile()
  }
  func unlink(_ id: UUID) {
    links.remove(id)
    if !disposed { reconcile() }
  }
  func pause() {
    guard !disposed, !paused else { return }
    paused = true
    reconcile()
  }
  func play() {
    guard !disposed else { return }
    paused = false
    reconcile()
  }
  func suspend() {
    guard !disposed, !suspended else { return }
    suspended = true
    reconcile()
  }
  func resume() {
    guard !disposed else { return }
    suspended = false
    reconcile()
  }
  func dispose() {
    guard !disposed else { return }
    freeze()
    disposed = true
    elapsed = 0
    changed?()
    changed = nil
  }
}

/// A repeating highlight sweep for skeletons and placeholders. Owned explicitly (for example by a
/// JoltScope); it runs only while a view shows it in an active scene with full motion.
@MainActor public final class JoltShimmer: ObservableObject, JoltResource, JoltViewLinked {
  private let loop: JoltLoop
  /// Milliseconds per sweep, including the band entering and leaving the view.
  public var duration: Double { loop.duration }
  public var clock: JoltClock { loop.clock }
  /// Milliseconds into the current sweep.
  public var elapsed: Double { loop.elapsed }
  /// Band offset in widths of the view, -1...1.
  public var offset: Double {
    (try? JoltEffects.shimmerOffset(elapsed: loop.elapsed, duration: loop.duration)) ?? -1
  }
  public var state: JoltPlaybackState { loop.state }
  public var disposed: Bool { loop.disposed }
  public var paused: Bool { loop.paused }
  public var suspended: Bool { loop.suspended }
  /// Views currently showing this shimmer.
  public var viewCount: Int { loop.links.count }
  /// Positive finite milliseconds up to 60 000.
  public init(duration: Double = JoltEffects.shimmerDuration, clock: JoltClock = .shared) throws {
    loop = try JoltLoop(duration: duration, clock: clock)
    loop.changed = { [weak self] in self?.objectWillChange.send() }
  }
  public func pause() { loop.pause() }
  public func play() { loop.play() }
  public func suspend() { loop.suspend() }
  public func resume() { loop.resume() }
  public func dispose() { loop.dispose() }
  func link(_ id: UUID, active: Bool, reduced: Bool) {
    loop.link(id, active: active, reduced: reduced)
  }
  func unlink(_ id: UUID) { loop.unlink(id) }
}

/// A loading indicator: three pulsing dots, five bars or twelve fading dots around a ring.
@MainActor public final class JoltLoader: ObservableObject, JoltResource, JoltViewLinked {
  private let loop: JoltLoop
  public let style: JoltLoaderStyle
  public let color: JoltColor
  /// Maximum side in points; the indicator shrinks to fit the view showing it.
  public let size: Double
  public var duration: Double { loop.duration }
  public var clock: JoltClock { loop.clock }
  /// Milliseconds into the current cycle.
  public var elapsed: Double { loop.elapsed }
  public var state: JoltPlaybackState { loop.state }
  public var disposed: Bool { loop.disposed }
  public var paused: Bool { loop.paused }
  public var suspended: Bool { loop.suspended }
  public var viewCount: Int { loop.links.count }
  /// Size in (0, 16 384] points and a cycle in (0, 60 000] milliseconds.
  public init(
    _ style: JoltLoaderStyle = JoltEffects.loaderStyle, color: JoltColor = JoltEffects.loaderColor,
    size: Double = JoltEffects.loaderSize, duration: Double = JoltEffects.loaderDuration,
    clock: JoltClock = .shared
  ) throws {
    guard size.isFinite, size > 0, size <= JoltEffects.maximumLoaderSize else {
      throw JoltError.invalidMotion
    }
    loop = try JoltLoop(duration: duration, clock: clock)
    self.style = style
    self.color = color
    self.size = size
    loop.changed = { [weak self] in self?.objectWillChange.send() }
  }
  /// The copies drawn in a view of `width` × `height` points, centred in it.
  public func items(width: Double, height: Double, reducedMotion: Bool = false) -> [JoltLoaderItem]
  {
    let side = min(size, width, height)
    guard !disposed, side.isFinite, side > 0 else { return [] }
    return
      (try? JoltEffects.loaderItems(
        style, size: side, elapsed: reducedMotion ? nil : loop.elapsed, duration: loop.duration))
      ?? []
  }
  public func pause() { loop.pause() }
  public func play() { loop.play() }
  public func suspend() { loop.suspend() }
  public func resume() { loop.resume() }
  public func dispose() { loop.dispose() }
  func link(_ id: UUID, active: Bool, reduced: Bool) {
    loop.link(id, active: active, reduced: reduced)
  }
  func unlink(_ id: UUID) { loop.unlink(id) }
}

private struct ShimmerModifier: ViewModifier {
  @ObservedObject var shimmer: JoltShimmer
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    let hidden = reduced || appReduced || shimmer.disposed
    content.overlay {
      GeometryReader { geometry in
        if !hidden {
          let width = Double(geometry.size.width)
          let height = Double(geometry.size.height)
          let line = try? JoltGradientLine(
            angle: JoltEffects.shimmerAngle, width: width, height: height)
          LinearGradient(
            stops: zip(JoltEffects.shimmerStops, JoltEffects.shimmerOpacity).map {
              Gradient.Stop(color: .white.opacity($1), location: $0)
            },
            startPoint: .init(x: line?.startX ?? 0, y: line?.startY ?? 0.5),
            endPoint: .init(x: line?.endX ?? 1, y: line?.endY ?? 0.5)
          )
          .frame(width: geometry.size.width, height: geometry.size.height)
          .offset(x: shimmer.offset * width)
        }
      }
      .blendMode(.sourceAtop).allowsHitTesting(false).accessibilityHidden(true)
      .transaction { $0.animation = nil }
    }
    .compositingGroup()
    .modifier(JoltLinkModifier(resource: shimmer))
  }
}

extension View {
  /// Sweeps a highlight over this view, painted only where its content is opaque. The view and
  /// the band render in one compositing group. Hidden under reduced motion; held while the scene
  /// is inactive, the view is off screen, or the shimmer is paused or suspended.
  public func joltShimmer(_ shimmer: JoltShimmer) -> some View {
    modifier(ShimmerModifier(shimmer: shimmer))
  }
}

/// Draws a loader centred in the space it is offered, at most `loader.size` points square.
/// Without a label it is hidden from accessibility: label the busy control instead.
public struct JoltLoaderView: View {
  @ObservedObject private var loader: JoltLoader
  private let label: String?
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  public init(_ loader: JoltLoader, accessibilityLabel: String? = nil) {
    self.loader = loader
    self.label = accessibilityLabel
  }
  public var body: some View {
    let still = reduced || appReduced
    let color = loader.color.swiftUIColor
    Canvas { context, size in
      let width = Double(size.width)
      let height = Double(size.height)
      let items = loader.items(width: width, height: height, reducedMotion: still)
      let side = min(loader.size, width, height)
      let left = (width - side) / 2
      let top = (height - side) / 2
      for item in items {
        let rect = CGRect(
          x: -item.width / 2, y: -item.height / 2, width: item.width, height: item.height)
        let shape = Path(roundedRect: rect, cornerRadius: min(item.width, item.height) / 2)
          .applying(
            CGAffineTransform(translationX: left + item.x, y: top + item.y).scaledBy(
              x: item.scaleX, y: item.scaleY))
        var layer = context
        layer.opacity = item.opacity
        layer.fill(shape, with: .color(color))
      }
    }
    .allowsHitTesting(false)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(label ?? "")
    .accessibilityAddTraits(.updatesFrequently)
    .accessibilityHidden(label == nil)
    .modifier(JoltLinkModifier(resource: loader))
  }
}
