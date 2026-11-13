import Foundation

public struct JoltScalarReading: Codable, Equatable, Sendable {
  public let value: Double
  public let velocity: Double
  public init(_ value: Double, velocity: Double = 0) { self.value = value; self.velocity = velocity }
}
public enum JoltScalarOperation: String, Codable, Sendable {
  case input, constant, map, add, sub, mul, div, min, max, clamp, abs, sin, cos, velocity
  /// Derived velocity is analytic; at a tie/clamp endpoint it is zero. Division by zero settles to zero.
  public func sample(_ a: JoltScalarReading, _ b: JoltScalarReading = .init(0), maximum: Double = 0) -> JoltScalarReading {
    let x = a.value, xv = a.velocity, y = b.value, yv = b.velocity
    let value: Double, speed: Double
    switch self {
    case .add: value = x+y; speed = xv+yv
    case .sub: value = x-y; speed = xv-yv
    case .mul: value = x*y; speed = xv*y+x*yv
    case .div: value = y == 0 ? 0 : x/y; speed = y == 0 ? 0 : (xv*y-x*yv)/(y*y)
    case .min: value = Swift.min(x,y); speed = x<y ? xv : x>y ? yv : 0
    case .max: value = Swift.max(x,y); speed = x>y ? xv : x<y ? yv : 0
    case .clamp: value = Swift.min(maximum, Swift.max(y,x)); speed = x<=y || x>=maximum ? 0 : xv
    case .abs: value = Swift.abs(x); speed = (x<0 ? -1 : x>0 ? 1 : 0)*xv
    case .sin: value = Foundation.sin(x); speed = Foundation.cos(x)*xv
    case .cos: value = Foundation.cos(x); speed = -Foundation.sin(x)*xv
    case .velocity: value = xv; speed = 0
    default: value = x; speed = xv
    }
    return .init(value.isFinite ? value : 0, velocity: value.isFinite && speed.isFinite ? speed : 0)
  }
}

/// Serialized instructions shared with the NativeScript kernels. Inputs and references are validated once.
public struct JoltScalarInstruction: Codable, Sendable {
  public var op: JoltScalarOperation
  public var a: Int?
  public var b: Int?
  public var value: Double?
  public var maximum: Double?
  public var input: [Double]?
  public var output: [Double]?
  public var clamp: Bool?
  public init(_ op: JoltScalarOperation, a: Int? = nil, b: Int? = nil, value: Double? = nil,
    maximum: Double? = nil, input: [Double]? = nil, output: [Double]? = nil, clamp: Bool? = nil) {
    self.op=op; self.a=a; self.b=b; self.value=value; self.maximum=maximum
    self.input=input; self.output=output; self.clamp=clamp
  }
}
public struct JoltScalarProgram: Sendable {
  public let instructions: [JoltScalarInstruction]
  private let maps: [JoltNumericMap?]
  private let inputs: Int
  public init(_ instructions: [JoltScalarInstruction], inputs: Int) throws {
    guard !instructions.isEmpty, instructions.count <= 1024, inputs > 0 else { throw JoltError.invalidMotion }
    var maps: [JoltNumericMap?] = []
    for (index, node) in instructions.enumerated() {
      if node.op == .constant {
        guard let value=node.value, value.isFinite else { throw JoltError.invalidMotion }
      } else {
        guard let a=node.a, a>=0, a<(node.op == .input ? inputs : index) else { throw JoltError.invalidMotion }
      }
      if let b=node.b, b<0 || b>=index { throw JoltError.invalidMotion }
      if node.op == .map {
        maps.append(try JoltNumericMap(node.input ?? [], node.output ?? [], clamp: node.clamp ?? true))
      } else { maps.append(nil) }
    }
    self.instructions=instructions; self.inputs=inputs; self.maps=maps
  }
  public func sample(_ sources: [JoltScalarReading], overrides: [Int: JoltScalarReading] = [:]) throws -> JoltScalarReading {
    guard sources.count == inputs else { throw JoltError.invalidMotion }
    var slots: [JoltScalarReading] = []; slots.reserveCapacity(instructions.count)
    for (i,node) in instructions.enumerated() {
      if let held=overrides[i] { slots.append(held); continue }
      switch node.op {
      case .input: slots.append(sources[node.a!])
      case .constant: slots.append(.init(node.value!))
      case .map:
        let source=slots[node.a!], mapped=try maps[i]!.sample(source.value)
        slots.append(.init(mapped.value, velocity: mapped.slope*source.velocity))
      default: slots.append(node.op.sample(slots[node.a!], node.b.map { slots[$0] } ?? .init(0), maximum: node.maximum ?? 0))
      }
    }
    return slots.last!
  }
}
