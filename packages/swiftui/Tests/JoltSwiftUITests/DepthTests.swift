import SwiftUI
import XCTest

@testable import JoltSwiftUI

final class DepthTests: XCTestCase {
  private func projections() throws -> [[String: Any]] {
    let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
      .appendingPathComponent("../JoltCoreTests/Fixtures/depth.json").standardizedFileURL
    let data = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
    return data["projections"] as! [[String: Any]]
  }
  @MainActor func testAppliedProjectionMatchesTheWebFixtures() throws {
    var compared = 0
    for fixture in try projections() {
      guard let expected = fixture["corners"] as? [[Double]] else { continue }
      let width = fixture["width"] as! Double
      let height = fixture["height"] as! Double
      let p = fixture["pose"] as! [String: Double]
      let pose = try JoltPose(
        x: p["x"]!, y: p["y"]!, scaleX: p["scaleX"]!, scaleY: p["scaleY"]!, rotate: p["rotate"]!,
        rotateX: p["rotateX"]!, rotateY: p["rotateY"]!)
      let effect = JoltDepthEffect(
        channels: .init(pose), distance: fixture["perspective"] as? Double)
      let transform = effect.effectValue(size: CGSize(width: width, height: height))
      let corners = [
        CGPoint(x: 0, y: 0), CGPoint(x: width, y: 0), CGPoint(x: width, y: height),
        CGPoint(x: 0, y: height),
      ].map { $0.applying(transform) }
      for (corner, point) in zip(corners, expected) {
        XCTAssertEqual(corner.x, point[0], accuracy: 1e-6, "\(fixture)")
        XCTAssertEqual(corner.y, point[1], accuracy: 1e-6, "\(fixture)")
      }
      compared += 1
    }
    XCTAssertEqual(compared, 96)
  }
  @MainActor func testFlatPosesKeepTheirAffineTransform() {
    let transform = JoltDepthEffect(
      channels: .init(x: 30, y: -12, scaleX: 2, scaleY: 0.5, rotate: 90), distance: 600
    ).effectValue(size: CGSize(width: 100, height: 40))
    XCTAssertTrue(transform.isAffine)
    let center = CGPoint(x: 50, y: 20).applying(transform)
    XCTAssertEqual(center.x, 80, accuracy: 1e-9)
    XCTAssertEqual(center.y, 8, accuracy: 1e-9)
    let edge = CGPoint(x: 100, y: 20).applying(transform)
    XCTAssertEqual(edge.x, 80, accuracy: 1e-9)
    XCTAssertEqual(edge.y, 108, accuracy: 1e-9)
  }
  @MainActor func testSingleChannelsAndInterpolationKeepTheOtherAxis() {
    XCTAssertEqual(JoltValueProperty.rotateX.channels(30), .init(rotateX: 30))
    XCTAssertEqual(JoltValueProperty.scale.channels(2), .init(scaleX: 2, scaleY: 2))
    XCTAssertTrue(JoltValueProperty.rotateY.tilts)
    XCTAssertFalse(JoltValueProperty.rotate.tilts)
    let start = JoltDepthChannels(rotateX: 40, rotateY: -30)
    let mid = start.mixed(with: .init(rotateX: 0, rotateY: -30), 0.5)
    XCTAssertEqual(mid.storage[5], 20)
    XCTAssertEqual(mid.storage[6], -30)
  }
  @MainActor func testShadowChannelsClampLikeTheSharedDecorations() throws {
    let rest = try JoltShadow(opacity: 0.2, radius: 4, x: 0, y: 2)
    let lifted = JoltShadowChannels(try JoltShadow(opacity: 1, radius: 16, x: 0, y: 12))
    var overshoot = JoltShadowChannels(rest).mixed(with: lifted, 1.25)
    XCTAssertEqual(overshoot.shadow.opacity, 1)
    XCTAssertEqual(overshoot.shadow.y, 14.5, accuracy: 1e-9)
    overshoot.scale(by: -1)
    XCTAssertEqual(overshoot.shadow.opacity, 0)
    XCTAssertEqual(overshoot.shadow.radius, 0)
    XCTAssertEqual(JoltShadowChannels(nil).shadow, .none)
  }
}
