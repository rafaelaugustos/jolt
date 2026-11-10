import Foundation

/// Realized rows measured once per stable layout. Hit thresholds use the dragged row's center.
public struct JoltReorderGeometry: Sendable {
  public let heights: [Double]
  public let starts: [Double]
  public let extent: Double
  public init(heights: [Double], spacing: Double) throws {
    guard heights.count <= 1000, heights.allSatisfy({ $0.isFinite && $0 >= 24 && $0 <= 10000 }),
      spacing.isFinite, spacing >= 0, spacing <= 100
    else { throw JoltError.invalidMotion }
    self.heights = heights
    var starts: [Double] = []
    var next = 0.0
    for height in heights {
      starts.append(next)
      next += height + spacing
    }
    self.starts = starts
    extent = max(0, next - (heights.isEmpty ? 0 : spacing))
  }
  public func destination(from: Int, center: Double) -> Int? {
    guard heights.indices.contains(from), center.isFinite else { return nil }
    return heights.indices.filter { $0 != from && center > starts[$0] + heights[$0] / 2 }.count
  }
  public func index(at offset: Double) -> Int? {
    guard !heights.isEmpty, offset.isFinite else { return nil }
    return starts.indices.last { offset >= starts[$0] } ?? 0
  }
}
