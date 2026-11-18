import Foundation

/// SVG shape geometry with preserved subpaths. Matches the portable shape normal form M/L/C/Q/Z.
/// Accepts M/L/H/V/C/S/Q/T/A/Z, relative forms and repeated arguments. Limits: 20 KB,
/// 256 normalized commands and coordinates within ±1,000,000 local points.
public struct JoltSVGPath: Equatable, Sendable {
  public let commands: String
  public let points: [Double]
  public let contours: Int
  public init(_ svg: String) throws {
    var parser = SVGParser(svg)
    self = try parser.parse()
  }
  /// Already normalized geometry, useful for shared compilers that parse SVG before runtime.
  public init(commands: String, points: [Double]) throws {
    guard !commands.isEmpty, commands.first == "M", commands.utf8.count <= 256,
      points.allSatisfy({ $0.isFinite && abs($0) <= 1_000_000 })
    else { throw JoltError.invalidMotion }
    var count = 0
    var contours = 0
    var drawing = false
    for command in commands {
      switch command {
      case "M":
        count += 2
        contours += 1
      case "L":
        count += 2
        drawing = true
      case "C":
        count += 6
        drawing = true
      case "Q":
        count += 4
        drawing = true
      case "Z": break
      default: throw JoltError.invalidMotion
      }
    }
    guard count == points.count, drawing else { throw JoltError.invalidMotion }
    self.commands = commands
    self.points = points
    self.contours = contours
  }
  public func isCompatible(with other: Self) -> Bool { commands == other.commands }
  /// Morphs matching topology. Geometry changes require replacement, never an inferred correspondence.
  public func interpolated(to other: Self, progress: Double) throws -> Self {
    guard isCompatible(with: other), progress.isFinite else { throw JoltError.invalidMotion }
    let t = min(1, max(0, progress))
    return try Self(
      commands: commands, points: zip(points, other.points).map { $0 + ($1 - $0) * t })
  }
}

private struct SVGParser {
  let bytes: [UInt8]
  var index = 0, hasNumber = false
  var commands = "", points: [Double] = []
  var current = (x: 0.0, y: 0.0), control = (x: 0.0, y: 0.0)
  init(_ text: String) { bytes = Array(text.utf8) }
  mutating func peek() -> UInt8? {
    while index < bytes.count && [9, 10, 13, 32].contains(bytes[index]) { index += 1 }
    return index < bytes.count ? bytes[index] : nil
  }
  mutating func number(flag: Bool = false) throws -> Double {
    if peek() == 44 {
      guard hasNumber else { throw JoltError.invalidMotion }
      index += 1
      _ = peek()
    }
    let start = index
    if flag {
      guard index < bytes.count, bytes[index] == 48 || bytes[index] == 49 else {
        throw JoltError.invalidMotion
      }
      index += 1
    } else {
      if index < bytes.count, bytes[index] == 43 || bytes[index] == 45 { index += 1 }
      var digits = 0
      while index < bytes.count && (48...57).contains(bytes[index]) {
        index += 1
        digits += 1
      }
      if index < bytes.count, bytes[index] == 46 {
        index += 1
        while index < bytes.count && (48...57).contains(bytes[index]) {
          index += 1
          digits += 1
        }
      }
      guard digits > 0 else { throw JoltError.invalidMotion }
      if index < bytes.count, bytes[index] == 69 || bytes[index] == 101 {
        index += 1
        if index < bytes.count, bytes[index] == 43 || bytes[index] == 45 { index += 1 }
        let exponent = index
        while index < bytes.count && (48...57).contains(bytes[index]) { index += 1 }
        guard index > exponent else { throw JoltError.invalidMotion }
      }
    }
    guard let value = Double(String(decoding: bytes[start..<index], as: UTF8.self)),
      value.isFinite, abs(value) <= 1_000_000
    else { throw JoltError.invalidMotion }
    hasNumber = true
    return value
  }
  mutating func point(_ origin: (x: Double, y: Double), _ relative: Bool) throws -> (
    x: Double, y: Double
  ) {
    let x = try number()
    let y = try number()
    return (x + (relative ? origin.x : 0), y + (relative ? origin.y : 0))
  }
  mutating func add(_ command: Character, _ values: [(x: Double, y: Double)] = []) throws {
    guard commands.count < 256 else { throw JoltError.invalidMotion }
    for point in values {
      guard [point.x, point.y].allSatisfy({ $0.isFinite && abs($0) <= 1_000_000 }) else {
        throw JoltError.invalidMotion
      }
      points += [point.x, point.y]
    }
    commands.append(command)
    if let last = values.last { current = last }
  }
  mutating func parse() throws -> JoltSVGPath {
    guard !bytes.isEmpty, bytes.count <= 20_000 else { throw JoltError.invalidMotion }
    var command: UInt8 = 0
    var previous: UInt8 = 0
    var first: (x: Double, y: Double)?
    while let token = peek() {
      if (65...90).contains(token) || (97...122).contains(token) {
        command = token
        index += 1
        hasNumber = false
      } else if command == 0 {
        throw JoltError.invalidMotion
      }
      let upper = command >= 97 ? command - 32 : command
      let relative = command != upper
      let origin = current
      guard first != nil || upper == 77 else { throw JoltError.invalidMotion }
      switch upper {
      case 77:
        let p = try point(origin, relative)
        first = p
        try add("M", [p])
        command = relative ? 108 : 76
      case 76: try add("L", [point(origin, relative)])
      case 72, 86:
        let n = try number()
        try add(
          "L",
          [
            upper == 72
              ? (n + (relative ? origin.x : 0), origin.y)
              : (origin.x, n + (relative ? origin.y : 0))
          ])
      case 67, 83:
        let c1 =
          try upper == 67
          ? point(origin, relative)
          : ((previous == 67 || previous == 83)
            ? (2 * origin.x - control.x, 2 * origin.y - control.y) : origin)
        let c2 = try point(origin, relative)
        let end = try point(origin, relative)
        try add("C", [c1, c2, end])
        control = c2
      case 81, 84:
        let c =
          try upper == 81
          ? point(origin, relative)
          : ((previous == 81 || previous == 84)
            ? (2 * origin.x - control.x, 2 * origin.y - control.y) : origin)
        let end = try point(origin, relative)
        try add("Q", [c, end])
        control = c
      case 65:
        let rx = try number()
        let ry = try number()
        let angle = try number()
        let large = try number(flag: true)
        let sweep = try number(flag: true)
        let end = try point(origin, relative)
        try arc(
          from: origin, to: end, rx: rx, ry: ry, degrees: angle, large: large == 1,
          sweep: sweep == 1)
      case 90:
        try add("Z")
        current = first!
        command = 0
      default: throw JoltError.invalidMotion
      }
      previous = upper
    }
    return try JoltSVGPath(commands: commands, points: points)
  }
  // SVG endpoint-to-center conversion, subdivided into cubic arcs of at most 90 degrees.
  mutating func arc(
    from a: (x: Double, y: Double), to b: (x: Double, y: Double), rx inputX: Double,
    ry inputY: Double, degrees: Double, large: Bool, sweep: Bool
  ) throws {
    var rx = abs(inputX)
    var ry = abs(inputY)
    guard rx > 0, ry > 0, a.x != b.x || a.y != b.y else {
      try add("L", [b])
      return
    }
    let phi = degrees.truncatingRemainder(dividingBy: 360) * .pi / 180
    let c = cos(phi)
    let s = sin(phi)
    let dx = (a.x - b.x) / 2
    let dy = (a.y - b.y) / 2
    let xp = c * dx + s * dy
    let yp = -s * dx + c * dy
    let correction = max(1, hypot(xp / rx, yp / ry))
    rx *= correction
    ry *= correction
    let u = xp / rx
    let v = yp / ry
    let norm = u * u + v * v
    let factor = (large == sweep ? -1.0 : 1.0) * sqrt(max(0, (1 - norm) / norm))
    let cxp = factor * rx * v
    let cyp = -factor * ry * u
    let cx = c * cxp - s * cyp + (a.x + b.x) / 2
    let cy = s * cxp + c * cyp + (a.y + b.y) / 2
    let ux = (xp - cxp) / rx
    let uy = (yp - cyp) / ry
    let vx = (-xp - cxp) / rx
    let vy = (-yp - cyp) / ry
    let start = atan2(uy, ux)
    var delta = atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    if !sweep && delta > 0 { delta -= 2 * .pi }
    if sweep && delta < 0 { delta += 2 * .pi }
    guard [cx, cy, rx, ry, start, delta].allSatisfy(\.isFinite), delta != 0 else {
      throw JoltError.invalidMotion
    }
    let count = Int(ceil(abs(delta) / (.pi / 2)))
    let f = (4.0 / 3) * tan(delta / Double(count) / 4) / delta
    func sample(_ t: Double) -> (x: Double, y: Double, dx: Double, dy: Double) {
      let angle = start + t * delta
      let x = rx * cos(angle)
      let y = ry * sin(angle)
      let dx = -rx * sin(angle) * delta
      let dy = ry * cos(angle) * delta
      return (
        t == 0 ? a.x : t == 1 ? b.x : cx + c * x - s * y,
        t == 0 ? a.y : t == 1 ? b.y : cy + s * x + c * y,
        c * dx - s * dy, s * dx + c * dy
      )
    }
    for i in 0..<count {
      let p = sample(Double(i) / Double(count))
      let q = sample(Double(i + 1) / Double(count))
      try add(
        "C", [(p.x + p.dx * f, p.y + p.dy * f), (q.x - q.dx * f, q.y - q.dy * f), (q.x, q.y)])
    }
  }
}

/// Projection uses independent x/y scaling, matching the portable SVG viewBox contract.
public struct JoltViewBox: Equatable, Sendable {
  public let x: Double, y: Double, width: Double, height: Double
  public init(_ x: Double, _ y: Double, _ width: Double, _ height: Double) throws {
    guard [x, y, width, height].allSatisfy({ $0.isFinite && abs($0) <= 1_000_000 }),
      width > 0, height > 0
    else { throw JoltError.invalidMotion }
    self.x = x
    self.y = y
    self.width = width
    self.height = height
  }
}
