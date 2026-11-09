import JoltCore
import SwiftUI

public enum JoltVectorGeometry: Sendable {
  case path(JoltPath, closed: Bool = false)
  case rectangle(x: Double, y: Double, width: Double, height: Double)
  case ellipse(x: Double, y: Double, width: Double, height: Double)
  fileprivate func validate() throws -> Int {
    switch self {
    case .path(let path, _): return path.points.count
    case .rectangle(let x, let y, let width, let height),
      .ellipse(let x, let y, let width, let height):
      guard [x, y, width, height].allSatisfy({ $0.isFinite && abs($0) <= 1_000_000 }), width >= 0,
        height >= 0
      else { throw JoltError.invalidMotion }
      return 4
    }
  }
  fileprivate var path: Path {
    switch self {
    case .path(let value, let closed):
      return Path { result in
        result.move(to: .init(x: value.points[0].x, y: value.points[0].y))
        for point in value.points.dropFirst() { result.addLine(to: .init(x: point.x, y: point.y)) }
        if closed { result.closeSubpath() }
      }
    case .rectangle(let x, let y, let w, let h):
      return Path(CGRect(x: x, y: y, width: w, height: h))
    case .ellipse(let x, let y, let w, let h):
      return Path(ellipseIn: CGRect(x: x, y: y, width: w, height: h))
    }
  }
}
public struct JoltVectorShape: Sendable {
  public let geometry: JoltVectorGeometry, fill: JoltColor?, stroke: JoltColor?, lineWidth: Double
  public init(
    _ geometry: JoltVectorGeometry, fill: JoltColor? = nil, stroke: JoltColor? = nil,
    lineWidth: Double = 2
  ) throws {
    _ = try geometry.validate()
    guard lineWidth.isFinite, (0...1000).contains(lineWidth), fill != nil || stroke != nil else {
      throw JoltError.invalidMotion
    }
    self.geometry = geometry
    self.fill = fill
    self.stroke = stroke
    self.lineWidth = lineWidth
  }
}
/// Persistent geometry, independent of animation lifetime. Updates validate the complete scene first.
@MainActor public final class JoltDrawing: ObservableObject, JoltResource {
  @Published public private(set) var shapes: [JoltVectorShape]
  public private(set) var disposed = false
  public init(_ shapes: [JoltVectorShape]) throws {
    try Self.validate(shapes)
    self.shapes = shapes
  }
  private static func validate(_ shapes: [JoltVectorShape]) throws {
    guard shapes.count <= 1024 else { throw JoltError.invalidMotion }
    let count = try shapes.reduce(0) { try $0 + $1.geometry.validate() }
    guard count <= 8192 else { throw JoltError.invalidMotion }
  }
  public func update(_ shapes: [JoltVectorShape]) throws {
    guard !disposed else { throw JoltError.disposed }
    try Self.validate(shapes)
    self.shapes = shapes
  }
  // Retained geometry has no playback; pausing a scope only pauses its animated values.
  public func pause() {}
  public func play() {}
  public func suspend() {}
  public func resume() {}
  public func dispose() {
    guard !disposed else { return }
    disposed = true
    shapes.removeAll()
  }
}
/// One retained Canvas. Coordinates are local points; provide an accessibility label for the illustration.
public struct JoltDrawingView: View {
  @ObservedObject private var drawing: JoltDrawing
  @ObservedObject private var progress: JoltMotionValue
  private let label: String
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  public init(_ drawing: JoltDrawing, strokeProgress: JoltMotionValue, accessibilityLabel: String) {
    self.drawing = drawing
    self.progress = strokeProgress
    self.label = accessibilityLabel
  }
  public var body: some View {
    let amount = min(1, max(0, reduced || appReduced ? progress.target : progress.value))
    Canvas { context, _ in
      for shape in drawing.shapes {
        let path = shape.geometry.path
        if let fill = shape.fill { context.fill(path, with: .color(fill.swiftUIColor)) }
        if let stroke = shape.stroke {
          context.stroke(
            path.trimmedPath(from: 0, to: amount), with: .color(stroke.swiftUIColor),
            style: StrokeStyle(lineWidth: shape.lineWidth, lineCap: .round, lineJoin: .round))
        }
      }
    }.accessibilityElement(children: .ignore).accessibilityLabel(label)
  }
}
