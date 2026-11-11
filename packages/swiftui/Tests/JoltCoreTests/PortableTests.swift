import XCTest

@testable import JoltCore

final class PortableTests: XCTestCase {
  private func fixtures() throws -> [String: Any] {
    let url = Bundle.module.url(forResource: "portable", withExtension: "json")!
    return try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
  }
  func testScalarSpringMatchesPortableNumericalFixtures() throws {
    for fixture in try fixtures()["springs"] as! [[String: Any]] {
      let p = fixture["physics"] as! [String: Double]
      let transition = try JoltTransition.spring(
        mass: p["mass"]!, stiffness: p["stiffness"]!, damping: p["damping"]!)
      let motion = try JoltScalarMotion(
        from: fixture["from"] as! Double, to: fixture["to"] as! Double,
        velocity: fixture["velocity"] as! Double, transition: transition,
        precision: fixture["precision"] as! Double)
      XCTAssertEqual(motion.duration, fixture["duration"] as! Double, accuracy: 1)
      for expected in fixture["samples"] as! [[String: Double]] {
        let actual = motion.sample(at: expected["at"]!)
        XCTAssertEqual(actual.position, expected["position"]!, accuracy: 0.00001)
        // Portable velocity is a symmetric finite difference; Apple reports its analytic derivative.
        XCTAssertEqual(actual.velocity, expected["velocity"]!, accuracy: 0.03)
      }
    }
  }
  func testParameterizedRecipesMatchPortableEndpoints() throws {
    for fixture in try fixtures()["recipes"] as! [[String: Any]] {
      let params = fixture["parameters"] as! [String: Any]
      let parameters = try JoltPresetParameters(
        distance: params["distance"] as? Double, scale: params["scale"] as? Double,
        direction: (params["direction"] as? String).flatMap(JoltDirection.init(rawValue:)),
        duration: params["duration"] as? Double)
      let recipe = JoltPreset(rawValue: fixture["name"] as! String)!.recipe(parameters)
      for (pose, key) in [(recipe.from, "from"), (recipe.to, "to")] {
        let expected = fixture[key] as! [String: Double]
        XCTAssertEqual(pose.x, expected["x"]!, fixture["name"] as! String)
        XCTAssertEqual(pose.y, expected["y"]!, fixture["name"] as! String)
        XCTAssertEqual(pose.scaleX, expected["scale"]!, fixture["name"] as! String)
        XCTAssertEqual(pose.opacity, expected["opacity"]!, fixture["name"] as! String)
        XCTAssertEqual(pose.rotateX, expected["rotateX"] ?? 0, fixture["name"] as! String)
        XCTAssertEqual(pose.rotateY, expected["rotateY"] ?? 0, fixture["name"] as! String)
      }
    }
  }
  func testInvalidAndImmediateScalarMotion() throws {
    XCTAssertThrowsError(try JoltScalarMotion(from: .nan, to: 1))
    XCTAssertThrowsError(try JoltScalarMotion(from: 0, to: 1, precision: 0))
    XCTAssertThrowsError(try JoltPresetParameters(duration: .infinity))
    let motion = try JoltScalarMotion(from: 0, to: 42, transition: .tween(milliseconds: 0))
    XCTAssertEqual(motion.sample(at: 0).position, 42)
    XCTAssertTrue(motion.sample(at: 0).completed)
  }
}
