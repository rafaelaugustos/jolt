import JoltCore
import SwiftUI

public typealias JoltNumericMap = JoltCore.JoltNumericMap
public typealias JoltColor = JoltCore.JoltColor
public typealias JoltPoint = JoltCore.JoltPoint
public typealias JoltPath = JoltCore.JoltPath

/// Borrows its source. Pausing freezes the mapping; resuming catches up without a new clock.
@MainActor public final class JoltMappedValue: ObservableObject, JoltResource {
  @Published public private(set) var value: Double
  @Published public private(set) var valid = true
  public private(set) var disposed = false
  private let source: JoltMotionValue, mapping: JoltNumericMap
  private var observation: JoltObservation?
  private var paused = false, suspended = false
  public init(_ source: JoltMotionValue, mapping: JoltNumericMap) throws {
    guard !source.disposed else { throw JoltError.disposed }
    self.source = source
    self.mapping = mapping
    value = try mapping.sample(source.value).value
    observation = try source.subscribe { [weak self] _ in self?.update() }
  }
  private func update() {
    guard !disposed, !paused, !suspended else { return }
    do {
      let next = try mapping.sample(source.value).value
      valid = true
      if next != value { value = next }
    } catch { valid = false }
  }
  public func pause() { paused = true }
  public func play() {
    paused = false
    update()
  }
  public func suspend() { suspended = true }
  public func resume() {
    suspended = false
    update()
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    observation?.dispose()
    observation = nil
  }
}

@MainActor public final class JoltColorValue: ObservableObject, JoltResource {
  @Published public private(set) var value: JoltColor
  public private(set) var disposed = false
  private let source: JoltMotionValue, from: JoltColor, to: JoltColor
  private var observation: JoltObservation?
  private var paused = false, suspended = false
  public init(_ progress: JoltMotionValue, from: JoltColor, to: JoltColor) throws {
    guard !progress.disposed else { throw JoltError.disposed }
    source = progress
    self.from = from
    self.to = to
    value = try from.mixed(to: to, progress: progress.value)
    observation = try progress.subscribe { [weak self] _ in self?.update() }
  }
  private func update() {
    guard !disposed, !paused, !suspended, let next = try? from.mixed(to: to, progress: source.value)
    else { return }
    if next != value { value = next }
  }
  public func pause() { paused = true }
  public func play() {
    paused = false
    update()
  }
  public func suspend() { suspended = true }
  public func resume() {
    suspended = false
    update()
  }
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    observation?.dispose()
    observation = nil
  }
}
extension JoltColor {
  public var swiftUIColor: Color {
    Color(.sRGB, red: red, green: green, blue: blue, opacity: alpha)
  }
}
private struct MappedModifier: ViewModifier {
  @ObservedObject var value: JoltMappedValue
  let property: JoltValueProperty
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    let scalar = value.value
    let transform = !(reduced || appReduced)
    content.offset(
      x: transform && property == .x ? scalar : 0, y: transform && property == .y ? scalar : 0
    )
    .scaleEffect(
      x: transform && (property == .scale || property == .scaleX) ? scalar : 1,
      y: transform && (property == .scale || property == .scaleY) ? scalar : 1
    )
    .rotationEffect(.degrees(transform && property == .rotate ? scalar : 0))
    .opacity(property == .opacity ? min(1, max(0, scalar)) : 1).transaction { $0.animation = nil }
  }
}
public enum JoltColorProperty: Sendable { case foreground, background }
private struct ColorModifier: ViewModifier {
  @ObservedObject var value: JoltColorValue
  let property: JoltColorProperty
  @ViewBuilder func body(content: Content) -> some View {
    if property == .foreground {
      content.foregroundStyle(value.value.swiftUIColor).transaction { $0.animation = nil }
    } else {
      content.background(value.value.swiftUIColor).transaction { $0.animation = nil }
    }
  }
}
private struct PathModifier: ViewModifier {
  @ObservedObject var progress: JoltMotionValue
  let path: JoltPath, orient: Bool
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    let pose = try! path.sample(reduced || appReduced ? progress.target : progress.value)
    content.rotationEffect(.degrees(orient ? pose.rotate : 0), anchor: .center).offset(
      x: pose.x, y: pose.y
    ).transaction { $0.animation = nil }
  }
}
extension View {
  /// A decorative mapping stays at its identity under reduced motion; opacity still follows data.
  public func joltBind(_ property: JoltValueProperty, to value: JoltMappedValue) -> some View {
    modifier(MappedModifier(value: value, property: property))
  }
  public func joltColor(_ property: JoltColorProperty, to value: JoltColorValue) -> some View {
    modifier(ColorModifier(value: value, property: property))
  }
  public func joltPath(_ path: JoltPath, progress: JoltMotionValue, orient: Bool = false)
    -> some View
  { modifier(PathModifier(progress: progress, path: path, orient: orient)) }
}
