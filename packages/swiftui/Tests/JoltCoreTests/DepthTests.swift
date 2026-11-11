import XCTest

@testable import JoltCore

final class DepthTests: XCTestCase {
  static func projections() throws -> [[String: Any]] {
    let url = Bundle.module.url(forResource: "depth", withExtension: "json")!
    let data = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
    return data["projections"] as! [[String: Any]]
  }
  static func pose(_ fixture: [String: Any]) throws -> JoltPose {
    let p = fixture["pose"] as! [String: Double]
    return try JoltPose(
      x: p["x"]!, y: p["y"]!, scaleX: p["scaleX"]!, scaleY: p["scaleY"]!, rotate: p["rotate"]!,
      rotateX: p["rotateX"]!, rotateY: p["rotateY"]!)
  }
  static func perspective(_ fixture: [String: Any]) throws -> JoltPerspective? {
    try (fixture["perspective"] as? Double).map { try JoltPerspective(distance: $0) }
  }
  func testProjectedCornersMatchTheWebProjection() throws {
    let fixtures = try Self.projections()
    XCTAssertGreaterThanOrEqual(Set(fixtures.compactMap { $0["perspective"] as? Double }).count, 3)
    XCTAssertTrue(fixtures.contains { $0["perspective"] is NSNull })
    for fixture in fixtures {
      let width = fixture["width"] as! Double
      let height = fixture["height"] as! Double
      let pose = try Self.pose(fixture)
      let perspective = try Self.perspective(fixture)
      guard let expected = fixture["corners"] as? [[Double]] else {
        XCTAssertThrowsError(
          try JoltProjection.corners(
            width: width, height: height, pose: pose, perspective: perspective))
        continue
      }
      let corners = try JoltProjection.corners(
        width: width, height: height, pose: pose, perspective: perspective)
      for (corner, point) in zip(corners, expected) {
        XCTAssertEqual(corner.x, point[0], accuracy: 1e-9, "\(fixture)")
        XCTAssertEqual(corner.y, point[1], accuracy: 1e-9, "\(fixture)")
      }
    }
  }
  func testOneAxisKeepsTheOtherAndFlatPosesStayAffine() throws {
    let tilted = try JoltPose(rotateX: 30, rotateY: -40)
    XCTAssertEqual(tilted.transform, [0, 0, 1, 1, 0, 30, -40])
    let flat = JoltProjection.matrix(
      width: 100, height: 80, pose: try JoltPose(x: 12, scale: 2, rotate: 90), perspective: 600)
    XCTAssertEqual(flat[6], 0)
    XCTAssertEqual(flat[7], 0)
    XCTAssertEqual(flat[8], 1)
    let orthographic = try JoltProjection.corners(
      width: 100, height: 80, pose: try JoltPose(rotateY: 60), perspective: nil)
    XCTAssertEqual(orthographic[1].x - orthographic[0].x, 50, accuracy: 1e-9)
    XCTAssertEqual(orthographic[0].y, 0, accuracy: 1e-9)
  }
  func testValidationLeavesNoPartialValues() throws {
    XCTAssertThrowsError(try JoltPose(rotateX: .nan))
    XCTAssertThrowsError(try JoltPose(rotateY: .infinity))
    XCTAssertThrowsError(try JoltShadow(opacity: 1.2, radius: 4))
    XCTAssertThrowsError(try JoltShadow(opacity: 0.5, radius: -1))
    XCTAssertThrowsError(try JoltShadow(opacity: 0.5, radius: 4, x: .nan))
    XCTAssertThrowsError(try JoltShadow(opacity: 0.5, radius: 4, y: 2e12))
    XCTAssertThrowsError(try JoltPerspective(distance: 0.5))
    XCTAssertThrowsError(try JoltPerspective(distance: 100_001))
    XCTAssertThrowsError(try JoltPerspective(distance: .infinity))
    XCTAssertEqual(try JoltPerspective(distance: 1).distance, 1)
    XCTAssertEqual((600 as JoltPerspective).distance, 600)
    XCTAssertThrowsError(
      try JoltProjection.corners(width: -1, height: 10, pose: .identity, perspective: nil))
    let shadow = try JoltShadow(opacity: 0.4, radius: 12, x: -3, y: 8)
    XCTAssertEqual(try JoltPose(y: -10, shadow: shadow).shadow, shadow)
    XCTAssertNil(JoltPose.identity.shadow)
    XCTAssertEqual(
      JoltShadow.clamped(opacity: 1.6, radius: -5, x: -4, y: 9),
      try JoltShadow(opacity: 1, radius: 0, x: -4, y: 9))
    XCTAssertEqual(
      JoltShadow.clamped(opacity: -0.2, radius: .nan, x: .infinity, y: 0), JoltShadow.none)
  }
  func testFlipPresetsCarryTheirAxis() throws {
    XCTAssertEqual(JoltPreset.flipInX.pose(active: false).rotateX, -90)
    XCTAssertEqual(JoltPreset.flipInX.pose(active: false).opacity, 0)
    XCTAssertEqual(JoltPreset.flipInY.pose(active: false).rotateY, 90)
    XCTAssertEqual(JoltPreset.flipInY.pose(active: true), .identity)
    XCTAssertEqual(JoltPreset.flipInX.opacityTransition, try .tween(milliseconds: 200))
    guard case .spring = JoltPreset.flipInY.transformTransition.kind else { return XCTFail() }
    let recipe = JoltPreset.flipInY.recipe(try JoltPresetParameters(direction: .left))
    XCTAssertEqual(recipe.from.rotateY, 90)
    XCTAssertEqual(recipe.from.x, -24)
  }
}
