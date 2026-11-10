import XCTest

@testable import JoltCore

final class MotionTests: XCTestCase {
  func testPortableRecipeInventoryAndUnits() throws {
    XCTAssertEqual(Definitions.shared.schema, 1)
    XCTAssertEqual(Set(Definitions.shared.presets.keys), Set(JoltPreset.allCases.map(\.rawValue)))
    XCTAssertEqual(Set(Definitions.shared.springs.keys), Set(JoltSpring.allCases.map(\.rawValue)))
    XCTAssertEqual(Set(Definitions.shared.curves.keys), Set(JoltEase.allCases.map(\.rawValue)))
    XCTAssertEqual(JoltPreset.fadeInUp.pose(active: false).y, 24)
    XCTAssertEqual(JoltPreset.fadeInUp.pose(active: true), .identity)
    XCTAssertEqual(JoltPreset.popIn.pose(active: false).scaleX, 0.5)
    XCTAssertEqual(JoltPreset.fadeOutLeft.pose(active: true).x, -24)
    XCTAssertEqual(JoltPreset.fadeOutLeft.pose(active: true).opacity, 0)
    XCTAssertEqual(JoltPreset.popIn.opacityTransition, try .tween(milliseconds: 150))
    for preset in JoltPreset.allCases {
      _ = preset.pose(active: false)
      _ = preset.pose(active: true)
      _ = preset.transformTransition
      _ = preset.opacityTransition
    }
  }
  func testInvalidDefinitionsDoNotReplaceValidTargets() throws {
    let pose = try JoltPose(x: 80, rotate: 25)
    XCTAssertThrowsError(try JoltPose(x: .infinity))
    XCTAssertThrowsError(try JoltPose(scale: .nan))
    XCTAssertThrowsError(try JoltPose(opacity: 1.1))
    XCTAssertEqual(pose.x, 80)
    XCTAssertThrowsError(try JoltTransition.tween(milliseconds: -1))
    XCTAssertThrowsError(try JoltTransition.cubicBezier(milliseconds: 100, points: [-1, 0, 1, 1]))
    XCTAssertThrowsError(try JoltTransition.spring(stiffness: 0, damping: 20))
    XCTAssertThrowsError(try JoltTransition.spring(stiffness: 100, damping: 0))
  }
  func testCurvesAndSpringPhysicalParametersMatchSharedDefinition() throws {
    guard
      case .tween(let duration, let points) = try JoltTransition.tween(
        milliseconds: 600, ease: .easeOut
      ).kind
    else { return XCTFail() }
    XCTAssertEqual(duration, 600)
    XCTAssertEqual(points, [0, 0, 0.58, 1])
    guard case .spring(let mass, let stiffness, let damping) = JoltTransition.spring(.smooth).kind
    else { return XCTFail() }
    XCTAssertEqual(mass, 1)
    XCTAssertEqual(stiffness, pow(2 * .pi / 0.5, 2), accuracy: 1e-9)
    XCTAssertEqual(damping, 2 * 2 * .pi / 0.5, accuracy: 1e-9)
  }
}
