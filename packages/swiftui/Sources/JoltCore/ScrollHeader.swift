import Foundation

/// Matches Jolt's portable scroll-header geometry, in points.
public struct JoltScrollHeaderGeometry: Equatable, Sendable {
  public let expanded: Double, minimum: Double, section: Double, parallax: Double
  public let titleFade: ClosedRange<Double>, toolbarFade: ClosedRange<Double>
  public var range: Double { expanded-minimum }
  public var spacer: Double { expanded+section }
  public var handoff: Double { (toolbarFade.lowerBound+toolbarFade.upperBound)/2 }
  public var focusHandoff: Double {
    titleFade.upperBound>toolbarFade.lowerBound ? (toolbarFade.lowerBound+Swift.min(titleFade.upperBound,toolbarFade.upperBound))/2 : handoff
  }
  public init(expanded: Double, minimum: Double, section: Double = 0, parallax: Double = 0,
    titleFade: ClosedRange<Double> = 0...0.7, toolbarFade: ClosedRange<Double> = 0.55...0.95) throws {
    guard [expanded,minimum,section,parallax].allSatisfy(\.isFinite), expanded>minimum, minimum>0, section>=0,
      parallax>=0, parallax<=expanded-minimum else { throw JoltError.invalidMotion }
    for interval in [titleFade,toolbarFade] {
      guard interval.lowerBound.isFinite, interval.upperBound.isFinite, interval.lowerBound>=0, interval.upperBound<=1, interval.lowerBound<interval.upperBound else { throw JoltError.invalidMotion }
    }
    self.expanded=expanded; self.minimum=minimum; self.section=section; self.parallax=parallax
    self.titleFade=titleFade; self.toolbarFade=toolbarFade
  }
  public func resizedOffset(_ offset: Double, from before: Self) -> Double {
    guard offset>0 else { return 0 }
    return Swift.max(0,offset+(offset>=before.range ? range-before.range : spacer-before.spacer))
  }
}
