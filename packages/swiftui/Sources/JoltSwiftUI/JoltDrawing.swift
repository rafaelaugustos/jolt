import JoltCore
import SwiftUI

public typealias JoltSVGPath = JoltCore.JoltSVGPath
public typealias JoltViewBox = JoltCore.JoltViewBox

public enum JoltVectorGeometry: Sendable {
  case svg(JoltSVGPath)
  case path(JoltPath, closed: Bool = false)
  case rectangle(x: Double, y: Double, width: Double, height: Double)
  case ellipse(x: Double, y: Double, width: Double, height: Double)
  fileprivate func validate() throws -> Int {
    switch self {
    case .svg(let path): return path.commands.count
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
    case .svg(let value):
      return Path { result in
        var i = 0
        func point() -> CGPoint {
          defer { i += 2 }
          return .init(x: value.points[i], y: value.points[i + 1])
        }
        for op in value.commands {
          switch op {
          case "M": result.move(to: point())
          case "L": result.addLine(to: point())
          case "C":
            let a = point()
            let b = point()
            let end = point()
            result.addCurve(to: end, control1: a, control2: b)
          case "Q":
            let control = point()
            let end = point()
            result.addQuadCurve(to: end, control: control)
          default: result.closeSubpath()
          }
        }
      }
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
  public enum LineCap: Sendable { case butt, round, square }
  public enum LineJoin: Sendable { case miter, round, bevel }
  public enum FillRule: Sendable { case nonzero, evenodd }
  public let geometry: JoltVectorGeometry, fill: JoltColor?, stroke: JoltColor?, lineWidth: Double
  public let strokeStart: Double, strokeEnd: Double
  public let lineCap: LineCap, lineJoin: LineJoin, fillRule: FillRule
  public init(
    _ geometry: JoltVectorGeometry, fill: JoltColor? = nil, stroke: JoltColor? = nil,
    lineWidth: Double = 2, strokeStart: Double = 0, strokeEnd: Double = 1,
    lineCap: LineCap = .round, lineJoin: LineJoin = .round, fillRule: FillRule = .nonzero
  ) throws {
    _ = try geometry.validate()
    guard lineWidth.isFinite, (0...1000).contains(lineWidth), fill != nil || stroke != nil,
      strokeStart.isFinite, strokeEnd.isFinite, (0...1).contains(strokeStart),
      (0...1).contains(strokeEnd)
    else {
      throw JoltError.invalidMotion
    }
    self.geometry = geometry
    self.fill = fill
    self.stroke = stroke
    self.lineWidth = lineWidth
    self.strokeStart = strokeStart
    self.strokeEnd = strokeEnd
    self.lineCap = lineCap
    self.lineJoin = lineJoin
    self.fillRule = fillRule
  }
  fileprivate func replacing(_ geometry: JoltVectorGeometry) -> Self {
    try! .init(
      geometry, fill: fill, stroke: stroke, lineWidth: lineWidth,
      strokeStart: strokeStart, strokeEnd: strokeEnd, lineCap: lineCap, lineJoin: lineJoin,
      fillRule: fillRule)
  }
}
/// Persistent geometry, independent of animation lifetime. Updates validate the complete scene first.
@MainActor public final class JoltDrawing: ObservableObject, JoltResource {
  @Published public private(set) var shapes: [JoltVectorShape]
  public private(set) var disposed = false
  public let clock: JoltClock
  public var state: JoltPlaybackState { disposed ? .disposed : motion?.state ?? lastState }
  private var motion: JoltMotionValue?
  private var observation: JoltObservation?
  private var morph: (index: Int, from: JoltSVGPath, to: JoltSVGPath)?
  private var paused = false, suspended = false, viewReduced = false
  private var lastState: JoltPlaybackState = .idle
  public init(_ shapes: [JoltVectorShape], clock: JoltClock = .shared) throws {
    try Self.validate(shapes)
    self.shapes = shapes
    self.clock = clock
  }
  private static func validate(_ shapes: [JoltVectorShape]) throws {
    guard shapes.count <= 1024 else { throw JoltError.invalidMotion }
    let count = try shapes.reduce(0) { try $0 + $1.geometry.validate() }
    guard count <= 8192 else { throw JoltError.invalidMotion }
  }
  public func update(_ shapes: [JoltVectorShape]) throws {
    guard !disposed else { throw JoltError.disposed }
    try Self.validate(shapes)
    cancel()
    self.shapes = shapes
  }
  /// One path morph per drawing, replacing from the currently sampled geometry. Styles remain intact.
  /// Incompatible commands/subpaths throw before changing the previous scene or playback.
  public func morphPath(
    at index: Int, to path: JoltSVGPath,
    transition: JoltTransition = .spring(.smooth), reducedMotion: Bool = false
  ) throws {
    guard !disposed else { throw JoltError.disposed }
    guard shapes.indices.contains(index), case .svg(let existing) = shapes[index].geometry,
      existing.isCompatible(with: path)
    else { throw JoltError.invalidMotion }
    // Validate the trajectory before cancelling current work.
    _ = try JoltScalarMotion(from: 0, to: 1, transition: transition)
    cancel()
    guard !disposed, shapes.indices.contains(index), case .svg(let from) = shapes[index].geometry
    else { return }
    let progress = try JoltMotionValue(0, clock: clock)
    if paused { progress.pause() }
    if suspended { progress.suspend() }
    motion = progress
    morph = (index, from, path)
    observation = try progress.subscribe { [weak self] amount in self?.paintMorph(amount) }
    try progress.animate(to: 1, transition: transition, reducedMotion: reducedMotion || viewReduced)
  }
  private func paintMorph(_ progress: Double) {
    guard !disposed, let morph, shapes.indices.contains(morph.index) else { return }
    let geometry = try! morph.from.interpolated(to: morph.to, progress: progress)
    shapes[morph.index] = shapes[morph.index].replacing(.svg(geometry))
  }
  public func cancel() {
    if let motion { paintMorph(motion.replacementSample().position) }
    observation?.dispose()
    observation = nil
    let old = motion
    motion = nil
    morph = nil
    old?.dispose()
    lastState = .cancelled
  }
  func reduceMotion(_ reduced: Bool) {
    viewReduced = reduced
    if reduced, let motion, morph != nil {
      try? motion.animate(to: 1, transition: .tween(milliseconds: 0), reducedMotion: true)
    }
  }
  public func pause() {
    paused = true
    motion?.pause()
  }
  public func play() {
    paused = false
    motion?.play()
  }
  public func suspend() {
    suspended = true
    motion?.suspend()
  }
  public func resume() {
    suspended = false
    motion?.resume()
  }
  public func dispose() {
    guard !disposed else { return }
    cancel()
    disposed = true
    shapes.removeAll()
  }
}
/// One retained Canvas. Coordinates are local points; provide an accessibility label for the illustration.
public struct JoltDrawingView: View {
  @ObservedObject private var drawing: JoltDrawing
  @ObservedObject private var progress: JoltMotionValue
  @ObservedObject private var start: JoltMotionValue
  private let label: String
  private let viewBox: JoltViewBox?
  @JoltSceneActivity private var sceneActive
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  public init(_ drawing: JoltDrawing, strokeProgress: JoltMotionValue, accessibilityLabel: String) {
    self.drawing = drawing
    self.progress = strokeProgress
    self.start = try! .init(0, clock: strokeProgress.clock)
    self.label = accessibilityLabel
    self.viewBox = nil
  }
  public init(
    _ drawing: JoltDrawing, strokeStart: JoltMotionValue, strokeEnd: JoltMotionValue,
    viewBox: JoltViewBox? = nil, accessibilityLabel: String
  ) {
    self.drawing = drawing
    self.start = strokeStart
    self.progress = strokeEnd
    self.label = accessibilityLabel
    self.viewBox = viewBox
  }
  public init(_ drawing: JoltDrawing, viewBox: JoltViewBox? = nil, accessibilityLabel: String) {
    self.init(
      drawing, strokeStart: try! .init(0, clock: drawing.clock),
      strokeEnd: try! .init(1, clock: drawing.clock), viewBox: viewBox,
      accessibilityLabel: accessibilityLabel)
  }
  public var body: some View {
    let amount = min(1, max(0, reduced || appReduced ? progress.target : progress.value))
    let beginning = min(1, max(0, reduced || appReduced ? start.target : start.value))
    Canvas { context, size in
      if let viewBox {
        context.scaleBy(x: size.width / viewBox.width, y: size.height / viewBox.height)
        context.translateBy(x: -viewBox.x, y: -viewBox.y)
      }
      for shape in drawing.shapes {
        let path = shape.geometry.path
        if let fill = shape.fill {
          context.fill(
            path, with: .color(fill.swiftUIColor),
            style: FillStyle(eoFill: shape.fillRule == .evenodd))
        }
        let from = max(beginning, shape.strokeStart)
        let to = min(amount, shape.strokeEnd)
        if let stroke = shape.stroke, to > from {
          context.stroke(
            path.trimmedPath(from: from, to: to), with: .color(stroke.swiftUIColor),
            style: StrokeStyle(
              lineWidth: shape.lineWidth,
              lineCap: shape.lineCap == .round ? .round : shape.lineCap == .butt ? .butt : .square,
              lineJoin: shape.lineJoin == .round
                ? .round : shape.lineJoin == .miter ? .miter : .bevel))
        }
      }
    }.accessibilityElement(children: .ignore).accessibilityLabel(label)
      .onAppear {
        drawing.reduceMotion(reduced || appReduced)
        if sceneActive { drawing.resume() } else { drawing.suspend() }
      }
      .onDisappear { drawing.suspend() }
      .onChange(of: sceneActive) { _, next in
        if next { drawing.resume() } else { drawing.suspend() }
      }
      .onChange(of: reduced || appReduced) { _, next in drawing.reduceMotion(next) }
      .modifier(JoltActivityProvider($sceneActive))
  }
}
