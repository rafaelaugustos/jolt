import JoltCore
import SwiftUI

public struct JoltTextPaint: Sendable {
  public let colors: [JoltColor], stops: [Double], angle: Double, sheen: JoltColor, width: Double
  public init(
    colors: [JoltColor], stops: [Double]? = nil, angle: Double = 0,
    sheen: JoltColor = .init(argb: 0xbfff_ffff), width: Double = 0.3
  ) throws {
    guard (2...8).contains(colors.count), angle.isFinite, width.isFinite, width > 0, width <= 1
    else { throw JoltError.invalidMotion }
    let locations = stops ?? colors.indices.map { Double($0) / Double(colors.count - 1) }
    guard locations.count == colors.count,
      locations.allSatisfy({ $0.isFinite && (0...1).contains($0) }),
      zip(locations, locations.dropFirst()).allSatisfy({ $0 <= $1 })
    else { throw JoltError.invalidMotion }
    self.colors = colors
    self.stops = locations
    self.angle = angle
    self.sheen = sheen
    self.width = width
  }
  fileprivate func gradient(in size: CGSize) -> LinearGradient {
    let radians = angle.truncatingRemainder(dividingBy: 360) * Double.pi / 180
    let width = max(1, Double(size.width))
    let height = max(1, Double(size.height))
    let length = abs(width * cos(radians)) + abs(height * sin(radians))
    let dx = cos(radians) * length / (2 * width)
    let dy = sin(radians) * length / (2 * height)
    return LinearGradient(
      stops: zip(colors, stops).map { .init(color: $0.swiftUIColor, location: $1) },
      startPoint: .init(x: CGFloat(0.5 - dx), y: CGFloat(0.5 - dy)),
      endPoint: .init(x: CGFloat(0.5 + dx), y: CGFloat(0.5 + dy)))
  }
}
/// Accessible real text with a glyph-clipped optional sheen. The caller owns the finite progress animation.
public struct JoltGradientText: View {
  private let text: String, paint: JoltTextPaint, font: Font, progress: JoltMotionValue?
  public init(
    _ text: String, paint: JoltTextPaint, font: Font = .title, sheenProgress: JoltMotionValue? = nil
  ) {
    self.text = text
    self.paint = paint
    self.font = font
    self.progress = sheenProgress
  }
  public var body: some View {
    Text(text).font(font).foregroundStyle(.clear).overlay {
      GeometryReader { geometry in
        Rectangle().fill(paint.gradient(in: geometry.size)).mask(Text(text).font(font))
      }.accessibilityHidden(true).allowsHitTesting(false)
    }.overlay {
      if let progress {
        Sheen(text: text, paint: paint, font: font, progress: progress).accessibilityHidden(true)
          .allowsHitTesting(false)
      }
    }
  }
  private struct Sheen: View {
    let text: String, paint: JoltTextPaint, font: Font
    @ObservedObject var progress: JoltMotionValue
    @Environment(\.accessibilityReduceMotion) private var reduced
    @Environment(\.joltReduceMotion) private var appReduced
    @Environment(\.scenePhase) private var phase
    var body: some View {
      GeometryReader { geometry in
        if !reduced && !appReduced && phase == .active {
          let width = max(1, geometry.size.width) * paint.width
          let p = min(1, max(0, progress.value))
          LinearGradient(
            colors: [.clear, paint.sheen.swiftUIColor, .clear], startPoint: .leading,
            endPoint: .trailing
          )
          .frame(width: width).offset(x: -width + (geometry.size.width + width) * p)
        }
      }.mask(Text(text).font(font)).transaction { $0.animation = nil }
    }
  }
}
