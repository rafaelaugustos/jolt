import XCTest

@testable import JoltCore

final class MathTests: XCTestCase {
  struct Fixtures: Decodable {
    struct Map: Decodable {
      struct Sample: Decodable { let input: Double, value: Double, slope: Double }
      let input: [Double], output: [Double], clamp: Bool, samples: [Sample]
    }
    struct Color: Decodable {
      struct Sample: Decodable { let progress: Double, argb: UInt32 }
      let from: UInt32, to: UInt32, samples: [Sample]
    }
    struct Decay: Decodable {
      struct Sample: Decodable { let at: Double, position: Double, velocity: Double }
      let from: Double, velocity: Double, friction: Double, precision: Double, to: Double,
        duration: Double, samples: [Sample]
    }
    struct Path: Decodable {
      struct Sample: Decodable { let progress: Double, x: Double, y: Double, rotate: Double }
      let points: [[Double]], length: Double, samples: [Sample]
    }
    let maps: [Map], colors: [Color], decays: [Decay], paths: [Path]
  }
  private func fixtures() throws -> Fixtures {
    try JSONDecoder().decode(
      Fixtures.self,
      from: Data(contentsOf: Bundle.module.url(forResource: "math", withExtension: "json")!))
  }
  func testPortableMappingDerivativeAndExtrapolation() throws {
    for item in try fixtures().maps {
      let map = try JoltNumericMap(item.input, item.output, clamp: item.clamp)
      for expected in item.samples {
        let sample = try map.sample(expected.input)
        XCTAssertEqual(sample.value, expected.value, accuracy: 1e-10)
        XCTAssertEqual(sample.slope, expected.slope, accuracy: 1e-10)
      }
    }
    XCTAssertThrowsError(try JoltNumericMap([0, 0], [0, 1]))
    XCTAssertThrowsError(try JoltNumericMap([0, 2, 1], [0, 1, 2]))
    XCTAssertThrowsError(try JoltNumericMap([0, 1], [0, .infinity]))
    XCTAssertThrowsError(
      try JoltNumericMap([0, 1], [0, Double.greatestFiniteMagnitude], clamp: false).sample(2))
  }
  func testPremultipliedOKLabMatchesPortableARGBBytes() throws {
    for item in try fixtures().colors {
      for expected in item.samples {
        XCTAssertEqual(
          try JoltColor(argb: item.from).mixed(
            to: .init(argb: item.to), progress: expected.progress
          ).argb, expected.argb)
      }
    }
    XCTAssertThrowsError(try JoltColor(argb: 0).mixed(to: .init(argb: 0xffff_ffff), progress: .nan))
  }
  func testDecayMatchesPortableEquationsAndClampsAtBounds() throws {
    for item in try fixtures().decays {
      let motion = try JoltDecayMotion(
        from: item.from, velocity: item.velocity, friction: item.friction, precision: item.precision
      )
      XCTAssertEqual(motion.to, item.to, accuracy: 1e-8)
      XCTAssertEqual(motion.duration, item.duration)
      for expected in item.samples {
        let sample = motion.sample(at: expected.at)
        XCTAssertEqual(sample.position, expected.position, accuracy: 1e-8)
        XCTAssertEqual(sample.velocity, expected.velocity, accuracy: 1e-8)
      }
    }
    let bounded = try JoltDecayMotion(from: 0, velocity: 800, bounds: -100...100)
    XCTAssertEqual(bounded.to, 100)
    XCTAssertLessThan(bounded.duration, 200)
    XCTAssertEqual(bounded.sample(at: 1000).position, 100)
    XCTAssertEqual(bounded.sample(at: 1000).velocity, 0)
    XCTAssertThrowsError(try JoltDecayMotion(from: 200, velocity: 20, bounds: 0...100))
    XCTAssertThrowsError(try JoltDecayMotion(from: 0, velocity: 100, friction: 1))
    XCTAssertThrowsError(try JoltDecayMotion(from: 0, velocity: 100, friction: 0.99999999))
  }
  func testPolylineArcLengthAndUnwrappedHeadingMatchPortablePath() throws {
    for item in try fixtures().paths {
      let path = try JoltPath(item.points.map { try JoltPoint($0[0], $0[1]) })
      XCTAssertEqual(path.length, item.length, accuracy: 1e-8)
      for expected in item.samples {
        let sample = try path.sample(expected.progress)
        XCTAssertEqual(sample.x, expected.x, accuracy: 1e-8)
        XCTAssertEqual(sample.y, expected.y, accuracy: 1e-8)
        XCTAssertEqual(sample.rotate, expected.rotate, accuracy: 1e-8)
      }
    }
    XCTAssertThrowsError(try JoltPath([]))
    XCTAssertThrowsError(try JoltPoint(.nan, 0))
  }
}
