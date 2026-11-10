import XCTest

@testable import JoltCore

final class GeometryTests: XCTestCase {
  private enum Snap: Decodable {
    case value(JoltSheetSnap)
    init(from decoder: Decoder) throws {
      let container = try decoder.singleValueContainer()
      if let value = try? container.decode(Double.self) {
        self = .value(.points(value))
        return
      }
      let value = try container.decode(String.self)
      self = .value(value == "content" ? .content : .fraction(Double(value.dropLast())! / 100))
    }
    var snap: JoltSheetSnap {
      switch self {
      case .value(let value): return value
      }
    }
  }
  private struct Fixtures: Decodable {
    struct Sheet: Decodable {
      struct Geometry: Decodable {
        let height: Double, closedY: Double, top: Double, `extension`: Double
      }
      struct Release: Decodable { let y: Double, velocity: Double, dismissible: Bool, index: Int }
      let snaps: [Snap], hostHeight: Double, safeTop: Double, safeBottom: Double
      let contentHeight: Double, keyboardOverlap: Double, extendable: Bool
      let geometry: Geometry, releases: [Release]
    }
    struct Reorder: Decodable {
      let heights: [Double], spacing: Double, from: Int, center: Double, destination: Int
    }
    struct Curve: Decodable {
      struct Segment: Decodable { let kind: String, points: [[Double]] }
      struct Sample: Decodable { let progress: Double, x: Double, y: Double, rotate: Double }
      let start: [Double], segments: [Segment], length: Double, samples: [Sample]
    }
    let sheets: [Sheet], reorder: [Reorder], curves: [Curve]
  }
  private func fixtures() throws -> Fixtures {
    try JSONDecoder().decode(
      Fixtures.self,
      from: Data(contentsOf: Bundle.module.url(forResource: "geometry", withExtension: "json")!))
  }
  func testSheetGeometryAndVelocityProjectionMatchPortableCore() throws {
    for test in try fixtures().sheets {
      let geometry = try JoltSheetGeometry(
        test.snaps.map(\.snap), hostHeight: test.hostHeight,
        contentHeight: test.contentHeight, safeTop: test.safeTop, safeBottom: test.safeBottom,
        keyboardOverlap: test.keyboardOverlap, extendable: test.extendable)
      XCTAssertEqual(geometry.height, test.geometry.height)
      XCTAssertEqual(geometry.closedY, test.geometry.closedY)
      XCTAssertEqual(geometry.top, test.geometry.top)
      XCTAssertEqual(geometry.bottomExtension, test.geometry.extension)
      for release in test.releases {
        let stop = try geometry.release(
          at: release.y, velocity: release.velocity, dismissible: release.dismissible)
        XCTAssertEqual(stop.flatMap { geometry.stops.firstIndex(of: $0) } ?? -1, release.index)
      }
    }
    for points: [JoltSheetSnap] in [
      [], [.points(0)], [.fraction(1.1)], [.content, .content], [.points(.nan)],
    ] {
      XCTAssertThrowsError(try JoltSheetGeometry(points, hostHeight: 600, contentHeight: 200))
    }
    XCTAssertThrowsError(try JoltSheetGeometry([.content], hostHeight: 0, contentHeight: 200))
    XCTAssertThrowsError(try JoltSheetGeometry([.content], hostHeight: 600, contentHeight: -1))
  }
  func testMeasuredReorderCentersMatchWebAndRetainBoundaries() throws {
    for test in try fixtures().reorder {
      let geometry = try JoltReorderGeometry(heights: test.heights, spacing: test.spacing)
      XCTAssertEqual(geometry.destination(from: test.from, center: test.center), test.destination)
    }
    let geometry = try JoltReorderGeometry(heights: [44, 130, 72], spacing: 8)
    XCTAssertEqual(geometry.extent, 262)
    XCTAssertEqual(geometry.index(at: 51), 0)
    XCTAssertEqual(geometry.index(at: 52), 1)
    XCTAssertEqual(geometry.index(at: 1000), 2)
    XCTAssertNil(geometry.destination(from: -1, center: 0))
    XCTAssertThrowsError(try JoltReorderGeometry(heights: [44, .nan], spacing: 8))
  }
  func testQuadraticCubicLengthAndTangentMatchPortablePaths() throws {
    for test in try fixtures().curves {
      let segments = try test.segments.map { segment -> JoltPathSegment in
        let p = try segment.points.map { try JoltPoint($0[0], $0[1]) }
        switch segment.kind {
        case "line": return .line(to: p[0])
        case "quadratic": return .quadratic(control: p[0], to: p[1])
        default: return .cubic(control1: p[0], control2: p[1], to: p[2])
        }
      }
      let path = try JoltPath(from: .init(test.start[0], test.start[1]), segments: segments)
      XCTAssertEqual(path.length, test.length, accuracy: 1e-7)
      for sample in test.samples {
        let pose = try path.sample(sample.progress)
        XCTAssertEqual(pose.x, sample.x, accuracy: 1e-7)
        XCTAssertEqual(pose.y, sample.y, accuracy: 1e-7)
        XCTAssertEqual(pose.rotate, sample.rotate, accuracy: 1e-6)
      }
    }
  }
  func testCurvesEnforceGeometryBudgetsWithoutUnboundedSampling() throws {
    let zero = try JoltPoint(0, 0)
    XCTAssertThrowsError(try JoltPath(from: zero, segments: []))
    XCTAssertThrowsError(
      try JoltPath(from: zero, segments: Array(repeating: .line(to: zero), count: 1025)))
    XCTAssertThrowsError(
      try JoltPath(
        from: zero,
        segments: Array(
          repeating: .cubic(
            control1: .init(1_000_000, 1_000_000), control2: .init(-1_000_000, 1_000_000), to: zero),
          count: 10)))
    let path = try JoltPath(from: zero, segments: [.quadratic(control: zero, to: zero)])
    XCTAssertEqual(path.length, 0)
    XCTAssertEqual(try path.sample(0.5), .identity)
    XCTAssertThrowsError(try path.sample(.nan))
  }
}
