import XCTest

@testable import JoltCore

final class SVGPathTests: XCTestCase {
  func testPortableShapeNormalForm() throws {
    struct Fixture: Decodable {
      let svg: String, commands: String
      let points: [Double]
      let contours: Int
    }
    let url = Bundle.module.url(forResource: "svg-paths", withExtension: "json")!
    for fixture in try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: url)) {
      let path = try JoltSVGPath(fixture.svg)
      XCTAssertEqual(path.commands, fixture.commands, fixture.svg)
      XCTAssertEqual(path.contours, fixture.contours, fixture.svg)
      XCTAssertEqual(path.points.count, fixture.points.count, fixture.svg)
      for (actual, expected) in zip(path.points, fixture.points) {
        XCTAssertEqual(actual, expected, accuracy: 1e-8, fixture.svg)
      }
    }
  }
  func testSubpathsRelativeCoordinatesAndClosureArePreserved() throws {
    let path = try JoltSVGPath("m10 10h20v20h-20z m5 5 10 0 0 10z")
    XCTAssertEqual(path.commands, "MLLLZMLLZ")
    XCTAssertEqual(path.contours, 2)
    XCTAssertEqual(path.points, [10, 10, 30, 10, 30, 30, 10, 30, 15, 15, 25, 15, 25, 25])
    let curves = try JoltSVGPath("M0 0q10 20 20 0t20 0c1 2 3 4 5 6s3 4 5 6")
    XCTAssertEqual(curves.commands, "MQQCC")
    XCTAssertEqual(Array(curves.points[6..<10]), [30, -20, 40, 0])
    XCTAssertEqual(Array(curves.points.suffix(6)), [47, 8, 48, 10, 50, 12])
  }
  func testArcNormalizationAndTopology() throws {
    let circle = try JoltSVGPath("M0 10a10 10 0 1 0 20 0a10 10 0 1 0-20 0z")
    XCTAssertEqual(circle.commands, "MCCCCZ")
    XCTAssertEqual(Array(circle.points.suffix(2)), [0, 10])
    XCTAssertTrue(circle.points.allSatisfy(\.isFinite))
    let a = try JoltSVGPath("M0 0L10 10Z")
    let b = try JoltSVGPath("m10 10l20 20z")
    XCTAssertEqual(try a.interpolated(to: b, progress: 0.5).points, [5, 5, 20, 20])
    XCTAssertThrowsError(try a.interpolated(to: JoltSVGPath("M0 0Q0 10 20 20Z"), progress: 0.5))
    XCTAssertThrowsError(try a.interpolated(to: b, progress: .nan))
  }
  func testInvalidAndOversizedPathsAreRejected() {
    for path in [
      "", "M0 0", "L0 0", "M0,0L1,", "M,0 0L1 1", "M0 0A1 1 0 2 0 1 1",
      "M0 0L1e309 0", "M0 0X1 2", "M0 0Z1 2", "M0 0 L1000001 0",
      "M0 0" + String(repeating: "L1 1", count: 256), String(repeating: " ", count: 20_001),
    ] {
      XCTAssertThrowsError(try JoltSVGPath(path), path)
    }
    XCTAssertThrowsError(try JoltSVGPath(commands: "ML", points: [0, 0, 1]))
    XCTAssertThrowsError(try JoltViewBox(0, 0, 0, 100))
  }
}
