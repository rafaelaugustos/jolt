import Combine
import JoltCore
import SwiftUI

/// Scalar input to a serializable graph. Built-in motion and computed values are supported.
@MainActor public protocol JoltScalarSource: AnyObject {
  var value: Double { get }
  var velocity: Double { get }
  var clock: JoltClock { get }
  var disposed: Bool { get }
}
extension JoltMotionValue: JoltScalarSource {}

@MainActor enum ScalarOperand {
  case none, number(Double), source(any JoltScalarSource)
}

/// Borrows inputs; one ordered evaluation after source writes, with no additional display link.
@MainActor public final class JoltComputedValue: ObservableObject, JoltResource, JoltScalarSource {
  @Published private var revision = 0
  public let clock: JoltClock
  public private(set) var disposed = false
  public var value: Double { reading.value }
  public var velocity: Double { disposed || paused || suspended ? 0 : reading.velocity }
  private var reading: JoltScalarReading {
    if disposed || paused || suspended { return .init(held.value) }
    let overrides=Dictionary(uniqueKeysWithValues: frozen.compactMap { index, source in source.paused || source.suspended ? (index, JoltScalarReading(source.held.value)) : nil })
    return (try? program.sample(roots.map { .init($0.value, velocity: $0.paused || $0.suspended || $0.disposed ? 0 : $0.velocity) }, overrides: overrides)) ?? .init(0)
  }
  fileprivate let left: any JoltScalarSource, operand: ScalarOperand, operation: JoltScalarOperation
  fileprivate let mapInput: [Double]?, mapOutput: [Double]?, mapClamp: Bool?, maximum: Double?
  fileprivate let depth: Int
  private let roots: [JoltMotionValue], program: JoltScalarProgram
  private let frozen: [(Int, JoltComputedValue)]
  private var held: JoltScalarReading, notified: JoltScalarReading
  private var observations: [JoltObservation] = []
  private var observers: [UUID: @MainActor () -> Void] = [:]
  private var paused = false, suspended = false
  fileprivate init(_ left: any JoltScalarSource, _ operation: JoltScalarOperation, _ operand: ScalarOperand = .none,
    maximum: Double? = nil, input: [Double]? = nil, output: [Double]? = nil, clamp: Bool? = nil) throws {
    let inputs: [any JoltScalarSource]
    if case .source(let right) = operand { inputs = [left, right] } else { inputs = [left] }
    guard inputs.allSatisfy({ !$0.disposed && $0.clock === left.clock }) else { throw JoltError.invalidMotion }
    depth = (inputs.map { ($0 as? JoltComputedValue)?.depth ?? 0 }.max() ?? 0) + 1
    guard depth <= 32 else { throw JoltError.invalidMotion }
    self.left=left; self.operand=operand; self.operation=operation; self.maximum=maximum
    mapInput=input; mapOutput=output; mapClamp=clamp; clock=left.clock
    let compiled = try compileScalar(left, operation, operand, maximum: maximum, input: input, output: output, clamp: clamp)
    roots=compiled.roots; program=compiled.program; frozen=compiled.frozen
    held=try program.sample(roots.map { .init($0.value, velocity: $0.paused || $0.suspended ? 0 : $0.velocity) })
    notified=held
    for source in inputs {
      let callback: @MainActor () -> Void = { [weak self, weak source] in
        guard let self, let source else { return }
        if source.disposed { self.dispose(); return }
        self.clock.derive(ObjectIdentifier(self)) { [weak self] in self?.update() }
      }
      if let source=source as? JoltMotionValue { observations.append(source.observeScalar(callback)) }
      else if let source=source as? JoltComputedValue { observations.append(source.observeScalar(callback)) }
      else { throw JoltError.invalidMotion }
    }
  }
  private func update() {
    guard !disposed else { return }
    let next=reading
    guard next != notified else { return }
    notified=next; held=next; revision &+= 1
    for (id, callback) in Array(observers) where observers[id] != nil { callback() }
  }
  fileprivate func observeScalar(_ callback: @escaping @MainActor () -> Void) -> JoltObservation {
    let id=UUID(); observers[id]=callback
    return JoltObservation { [weak self] in self?.observers.removeValue(forKey: id) }
  }
  public func subscribe(_ callback: @escaping @MainActor (Double) -> Void) throws -> JoltObservation {
    guard !disposed else { throw JoltError.disposed }
    return observeScalar { [weak self] in if let self, !self.disposed { callback(self.value) } }
  }
  public func pause() { guard !disposed else { return }; held=reading; paused=true; update() }
  public func play() { paused=false; update() }
  public func suspend() { guard !disposed else { return }; held=reading; suspended=true; update() }
  public func resume() { suspended=false; update() }
  public func dispose() {
    guard !disposed else { return }
    held=reading; disposed=true
    for observation in observations { observation.dispose() }; observations=[]
    revision &+= 1
    for callback in Array(observers.values) { callback() }; observers.removeAll()
  }
}

@MainActor private func compileScalar(_ left: any JoltScalarSource, _ operation: JoltScalarOperation, _ operand: ScalarOperand,
  maximum: Double?, input: [Double]?, output: [Double]?, clamp: Bool?) throws -> (roots: [JoltMotionValue], program: JoltScalarProgram, frozen: [(Int, JoltComputedValue)]) {
  var frozen: [(Int,JoltComputedValue)]=[]
  var roots: [JoltMotionValue]=[], instructions: [JoltScalarInstruction]=[], known: [ObjectIdentifier:Int]=[:]
  func append(_ instruction: JoltScalarInstruction) -> Int { instructions.append(instruction); return instructions.count-1 }
  func argument(_ operand: ScalarOperand) throws -> Int? {
    switch operand {
    case .none: return nil
    case .number(let number): guard number.isFinite else { throw JoltError.invalidMotion }; return append(.init(.constant, value: number))
    case .source(let source): return try walk(source)
    }
  }
  func walk(_ source: any JoltScalarSource) throws -> Int {
    let id=ObjectIdentifier(source)
    if let index=known[id] { return index }
    let index: Int
    if let source=source as? JoltComputedValue {
      let a=try walk(source.left), b=try argument(source.operand)
      index=append(.init(source.operation, a: a, b: b, maximum: source.maximum, input: source.mapInput, output: source.mapOutput, clamp: source.mapClamp))
      frozen.append((index, source))
    } else if let source=source as? JoltMotionValue {
      let root=roots.count; roots.append(source); index=append(.init(.input, a: root))
    } else { throw JoltError.invalidMotion }
    known[id]=index; return index
  }
  let a=try walk(left), b=try argument(operand)
  _ = append(.init(operation, a: a, b: b, maximum: maximum, input: input, output: output, clamp: clamp))
  return (roots, try JoltScalarProgram(instructions, inputs: roots.count), frozen)
}

extension JoltScalarSource {
  public func add(_ value: Double) throws -> JoltComputedValue { try .init(self, .add, .number(value)) }
  public func add(_ value: any JoltScalarSource) throws -> JoltComputedValue { try .init(self, .add, .source(value)) }
  public func sub(_ value: Double) throws -> JoltComputedValue { try .init(self, .sub, .number(value)) }
  public func sub(_ value: any JoltScalarSource) throws -> JoltComputedValue { try .init(self, .sub, .source(value)) }
  public func mul(_ value: Double) throws -> JoltComputedValue { try .init(self, .mul, .number(value)) }
  public func mul(_ value: any JoltScalarSource) throws -> JoltComputedValue { try .init(self, .mul, .source(value)) }
  public func div(_ value: Double) throws -> JoltComputedValue { try .init(self, .div, .number(value)) }
  public func div(_ value: any JoltScalarSource) throws -> JoltComputedValue { try .init(self, .div, .source(value)) }
  public func min(_ value: Double) throws -> JoltComputedValue { try .init(self, .min, .number(value)) }
  public func min(_ value: any JoltScalarSource) throws -> JoltComputedValue { try .init(self, .min, .source(value)) }
  public func max(_ value: Double) throws -> JoltComputedValue { try .init(self, .max, .number(value)) }
  public func max(_ value: any JoltScalarSource) throws -> JoltComputedValue { try .init(self, .max, .source(value)) }
  public func clamp(_ minimum: Double, _ maximum: Double) throws -> JoltComputedValue {
    guard minimum.isFinite, maximum.isFinite, minimum<=maximum else { throw JoltError.invalidMotion }
    return try .init(self, .clamp, .number(minimum), maximum: maximum)
  }
  public func abs() throws -> JoltComputedValue { try .init(self, .abs) }
  public func sin() throws -> JoltComputedValue { try .init(self, .sin) }
  public func cos() throws -> JoltComputedValue { try .init(self, .cos) }
  /// Named explicitly because `velocity` is already the scalar reading on JoltMotionValue.
  public func velocityValue() throws -> JoltComputedValue { try .init(self, .velocity) }
  public func to(_ input: [Double], _ output: [Double], clamp: Bool = true) throws -> JoltComputedValue {
    let reversed=(input.last ?? 0)<(input.first ?? 0)
    return try .init(self, .map, input: reversed ? input.reversed() : input, output: reversed ? output.reversed() : output, clamp: clamp)
  }
}
private struct ComputedModifier: ViewModifier {
  @ObservedObject var value: JoltComputedValue
  let property: JoltValueProperty
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  func body(content: Content) -> some View {
    content.modifier(JoltDepthModifier(channels: reduced || appReduced || property == .opacity ? .init() : property.channels(value.value), consumes: property.tilts))
      .opacity(property == .opacity ? Swift.min(1, Swift.max(0, value.value)) : 1).transaction { $0.animation=nil }
  }
}
extension View {
  public func joltBind(_ property: JoltValueProperty, to value: JoltComputedValue) -> some View {
    modifier(ComputedModifier(value: value, property: property))
  }
}
