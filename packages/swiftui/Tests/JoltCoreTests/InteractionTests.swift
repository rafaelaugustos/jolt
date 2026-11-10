import XCTest

@testable import JoltCore

final class InteractionTests: XCTestCase {
  private struct Fixtures: Decodable {
    struct Rect: Decodable {
      let x: Double, y: Double, width: Double, height: Double
      func value() throws -> JoltDropRect { try .init(x: x, y: y, width: width, height: height) }
    }
    struct Drop: Decodable { let source: Rect, target: Rect, overlap: Bool, hit: Bool }
    struct Move: Decodable {
      struct Result: Decodable { let key: String, beforeKey: String?, fromIndex: Int, toIndex: Int }
      let from: Int, to: Int, result: Result?
    }
    struct Particle: Decodable {
      let at: Double, fadeOut: Bool, x: Double, y: Double, rotation: Double, opacity: Double
    }
    struct Rig: Decodable {
      let bounded: Bool, weight: Double, rest: Double, current: Double, value: Double
    }
    let drops: [Drop], moves: [Move], particles: [Particle], rigs: [Rig]
  }
  private func fixtures() throws -> Fixtures {
    try JSONDecoder().decode(
      Fixtures.self,
      from: Data(contentsOf: Bundle.module.url(forResource: "interactions", withExtension: "json")!)
    )
  }
  func testDropGeometryAndStableKeyMovesMatchPortableCore() throws {
    for test in try fixtures().drops {
      XCTAssertEqual(
        try test.source.value().hits(test.target.value(), overlap: test.overlap), test.hit)
    }
    for test in try fixtures().moves {
      let result = JoltReorderMove.resolve(["a", "b", "c", "d"], from: test.from, to: test.to)
      XCTAssertEqual(result?.key, test.result?.key)
      XCTAssertEqual(result?.beforeKey, test.result?.beforeKey)
      XCTAssertEqual(result?.fromIndex, test.result?.fromIndex)
      XCTAssertEqual(result?.toIndex, test.result?.toIndex)
    }
    XCTAssertNil(JoltReorderMove.resolve([], from: 0, to: 1))
  }
  func testParticleSamplingMatchesWebBallistics() throws {
    for test in try fixtures().particles {
      let sample = try JoltParticleSample.sample(
        x: 20, y: 30, vx: 40, vy: -100, gravity: 420, spin: .pi, lifetime: 1500,
        milliseconds: test.at, fadeOut: test.fadeOut)
      XCTAssertEqual(sample.x, test.x, accuracy: 1e-9)
      XCTAssertEqual(sample.y, test.y, accuracy: 1e-9)
      XCTAssertEqual(sample.rotation, test.rotation, accuracy: 1e-9)
      XCTAssertEqual(sample.opacity, test.opacity, accuracy: 1e-9)
    }
    XCTAssertThrowsError(
      try JoltParticleSample.sample(
        x: 0, y: 0, vx: 0, vy: 0, gravity: 0, spin: 0, lifetime: 0, milliseconds: 0))
  }
  func testWeightedRotationsMatchPortableRigPolicy() throws {
    for test in try fixtures().rigs {
      let definition = try JoltRigDefinition(
        parts: [
          "arm": .init(
            width: 20, height: 10, rest: .init([.rotate: test.rest]),
            rotation: test.bounded ? -90...90 : nil)
        ], poses: ["a": ["arm": .init([.rotate: -170])], "b": ["arm": .init([.rotate: 20])]])
      let target = try definition.destination(
        [.init("a", weight: test.weight), .init("b", weight: 0.4)],
        current: ["arm": .init([.rotate: test.current])])
      XCTAssertEqual(target["arm"]!.value(.rotate), test.value, accuracy: 1e-9)
    }
  }
}
