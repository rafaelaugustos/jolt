import Foundation

public struct JoltScrollConsumption: Equatable, Sendable {
  public enum Owner: Sendable { case panel, scroll, none }
  public let panel: Double, offset: Double, remaining: Double
  public let owner: Owner
}
/// One finger delta is consumed once: expand before scrolling, scroll to the origin before collapsing.
public enum JoltScrollHandoff {
  public static func consume(
    delta: Double, panel: Double, bounds: ClosedRange<Double>, offset: Double, extent: Double
  ) throws -> JoltScrollConsumption {
    guard [delta, panel, bounds.lowerBound, bounds.upperBound, offset, extent].allSatisfy(\.isFinite), extent >= 0 else { throw JoltError.invalidMotion }
    var rest=delta, position=panel, scroll=min(extent,max(0,offset))
    var owner=JoltScrollConsumption.Owner.none
    func movePanel() {
      let next=min(bounds.upperBound,max(bounds.lowerBound,position+rest))
      if next != position { owner = .panel }
      rest -= next-position; position=next
    }
    func moveScroll() {
      let next=min(extent,max(0,scroll-rest))
      if next != scroll { owner = .scroll }
      rest += next-scroll; scroll=next
    }
    if delta < 0 { movePanel(); moveScroll() } else { moveScroll(); movePanel() }
    return .init(panel: position, offset: scroll, remaining: rest, owner: owner)
  }
}
