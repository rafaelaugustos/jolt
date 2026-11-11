import XCTest

@testable import JoltCore

final class EffectsTests: XCTestCase {
  private struct Fixtures: Decodable {
    struct Definitions: Decodable {
      struct Shimmer: Decodable {
        let duration: Double, angle: Double, stops: [Double], opacity: [Double], travel: [Double]
      }
      struct Kind: Decodable {
        let count: Int, width: Double, height: Double, stagger: Double, property: String
        let values: [Double], times: [Double], rest: Double
      }
      struct Loader: Decodable {
        let style: String, color: UInt32, size: Double, duration: Double, kinds: [String: Kind]
      }
      struct Reveal: Decodable { let duration: Double, ease: String }
      let shimmer: Shimmer, loader: Loader, reveal: Reveal
    }
    struct Item: Decodable {
      let x: Double, y: Double, width: Double, height: Double, rotate: Double
      let scaleX: Double, scaleY: Double, opacity: Double
    }
    struct Loader: Decodable {
      let style: String, size: Double, elapsed: Double?, duration: Double, items: [Item]
    }
    struct Shimmer: Decodable { let elapsed: Double, duration: Double, offset: Double }
    struct Radius: Decodable {
      let width: Double, height: Double, x: Double, y: Double, radius: Double
    }
    struct Eased: Decodable { let progress: Double, value: Double }
    struct Gradient: Decodable { let stops: [Double], projected: [Double] }
    let definitions: Definitions, loaders: [Loader], shimmer: [Shimmer], radii: [Radius]
    let eased: [Eased], gradients: [Gradient]
  }
  private func fixtures() throws -> Fixtures {
    let url = Bundle.module.url(forResource: "effects", withExtension: "json")!
    return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
  }
  func testGeneratedDefinitionsMatchTheSharedModule() throws {
    let definitions = try fixtures().definitions
    XCTAssertEqual(JoltEffects.shimmerDuration, definitions.shimmer.duration)
    XCTAssertEqual(JoltEffects.shimmerAngle, definitions.shimmer.angle)
    XCTAssertEqual(JoltEffects.shimmerStops, definitions.shimmer.stops.map { $0 / 100 })
    XCTAssertEqual(JoltEffects.shimmerOpacity, definitions.shimmer.opacity)
    XCTAssertEqual(LoadingDefinitions.shimmerTravel, definitions.shimmer.travel)
    XCTAssertEqual(JoltEffects.loaderStyle.rawValue, definitions.loader.style)
    XCTAssertEqual(JoltEffects.loaderColor.argb, definitions.loader.color)
    XCTAssertEqual(JoltEffects.loaderSize, definitions.loader.size)
    XCTAssertEqual(JoltEffects.loaderDuration, definitions.loader.duration)
    XCTAssertEqual(JoltEffects.revealDuration, definitions.reveal.duration)
    XCTAssertEqual(JoltEffects.revealEase.rawValue, definitions.reveal.ease)
    XCTAssertEqual(
      Set(definitions.loader.kinds.keys), Set(JoltLoaderStyle.allCases.map(\.rawValue)))
    for style in JoltLoaderStyle.allCases {
      let kind = LoadingDefinitions.loader(style)
      let expected = definitions.loader.kinds[style.rawValue]!
      XCTAssertEqual(kind.count, expected.count)
      XCTAssertEqual(kind.width, expected.width)
      XCTAssertEqual(kind.height, expected.height)
      XCTAssertEqual(kind.stagger, expected.stagger)
      XCTAssertEqual("\(kind.property)", expected.property)
      XCTAssertEqual(kind.values, expected.values)
      XCTAssertEqual(kind.times, expected.times)
      XCTAssertEqual(kind.rest, expected.rest)
    }
  }
  func testLoaderGeometryMatchesPortableFixtures() throws {
    for fixture in try fixtures().loaders {
      let items = try JoltEffects.loaderItems(
        JoltLoaderStyle(rawValue: fixture.style)!, size: fixture.size, elapsed: fixture.elapsed,
        duration: fixture.duration)
      XCTAssertEqual(items.count, fixture.items.count, fixture.style)
      for (actual, expected) in zip(items, fixture.items) {
        let context = "\(fixture.style) \(fixture.elapsed ?? -1)"
        XCTAssertEqual(actual.x, expected.x, accuracy: 1e-9, context)
        XCTAssertEqual(actual.y, expected.y, accuracy: 1e-9, context)
        XCTAssertEqual(actual.width, expected.width, accuracy: 1e-12, context)
        XCTAssertEqual(actual.height, expected.height, accuracy: 1e-12, context)
        XCTAssertEqual(actual.rotate, expected.rotate, accuracy: 1e-12, context)
        XCTAssertEqual(actual.scaleX, expected.scaleX, accuracy: 1e-9, context)
        XCTAssertEqual(actual.scaleY, expected.scaleY, accuracy: 1e-9, context)
        XCTAssertEqual(actual.opacity, expected.opacity, accuracy: 1e-9, context)
      }
    }
  }
  func testShimmerRevealAndGradientMathMatchPortableFixtures() throws {
    let data = try fixtures()
    for fixture in data.shimmer {
      XCTAssertEqual(
        try JoltEffects.shimmerOffset(elapsed: fixture.elapsed, duration: fixture.duration),
        fixture.offset, accuracy: 1e-12)
    }
    for fixture in data.radii {
      XCTAssertEqual(
        try JoltEffects.revealRadius(
          width: fixture.width, height: fixture.height, x: fixture.x, y: fixture.y),
        fixture.radius, accuracy: 1e-9)
    }
    let reveal = try JoltScalarMotion(
      from: 0, to: 1, transition: .tween(milliseconds: 1000, ease: JoltEffects.revealEase))
    for fixture in data.eased {
      XCTAssertEqual(
        reveal.sample(at: fixture.progress * 1000).position, fixture.value, accuracy: 1e-4)
    }
    for fixture in data.gradients {
      XCTAssertEqual(JoltEffects.projectedStops(fixture.stops), fixture.projected)
    }
  }
  func testRevealCirclesInterpolateFromTheCircleOnScreen() throws {
    let far = hypot(180.0, 70.0)
    let opening = try JoltEffects.revealCircle(
      width: 200, height: 100, x: 20, y: 30, opening: true, progress: 0.5)
    XCTAssertEqual(opening.x, 20)
    XCTAssertEqual(opening.radius, far / 2, accuracy: 1e-9)
    let closing = try JoltEffects.revealCircle(
      width: 200, height: 100, x: 20, y: 30, opening: false, progress: 0.25)
    XCTAssertEqual(closing.radius, far * 0.75, accuracy: 1e-9)
    let interrupted = try JoltRevealCircle(x: 100, y: 50, radius: 40)
    let moved = try JoltEffects.revealCircle(
      width: 200, height: 100, x: 0, y: 0, opening: false, from: interrupted, progress: 0.5)
    XCTAssertEqual(moved, try JoltRevealCircle(x: 50, y: 25, radius: 20))
    let overshoot = interrupted.mixed(to: try JoltRevealCircle(x: 0, y: 0, radius: 0), progress: 2)
    XCTAssertEqual(overshoot.radius, 0)
    XCTAssertThrowsError(try JoltRevealCircle(x: .nan, y: 0, radius: 1))
    XCTAssertThrowsError(try JoltRevealCircle(x: 0, y: 0, radius: -1))
    XCTAssertThrowsError(
      try JoltEffects.revealCircle(
        width: 10, height: 10, x: 0, y: 0, opening: true, progress: .infinity))
  }
  func testCSSGradientLineReachesTheCornersSquareToTheAngle() throws {
    let down = try JoltGradientLine(angle: 180, width: 200, height: 100)
    XCTAssertEqual(down.startX, 0.5, accuracy: 1e-12)
    XCTAssertEqual(down.startY, 0, accuracy: 1e-12)
    XCTAssertEqual(down.endY, 1, accuracy: 1e-12)
    let right = try JoltGradientLine(angle: 90, width: 200, height: 100)
    XCTAssertEqual(right.startX, 0, accuracy: 1e-12)
    XCTAssertEqual(right.endX, 1, accuracy: 1e-12)
    XCTAssertEqual(right.endY, 0.5, accuracy: 1e-12)
    let diagonal = try JoltGradientLine(angle: 45, width: 200, height: 100)
    let half = (200 + 100) * sin(Double.pi / 4) / 2
    XCTAssertEqual(diagonal.startX * 200, 100 - half * sin(Double.pi / 4), accuracy: 1e-9)
    XCTAssertEqual(diagonal.startY * 100, 50 + half * cos(Double.pi / 4), accuracy: 1e-9)
    // The corners lie on the bands through the line's ends: (0, 100) at the start, (200, 0) at
    // the end, measured along the line's direction in points.
    let direction = (x: sin(Double.pi / 4), y: -cos(Double.pi / 4))
    func along(_ x: Double, _ y: Double) -> Double {
      (x - diagonal.startX * 200) * direction.x + (y - diagonal.startY * 100) * direction.y
    }
    XCTAssertEqual(along(0, 100), 0, accuracy: 1e-9)
    XCTAssertEqual(along(200, 0), 2 * half, accuracy: 1e-9)
    XCTAssertEqual(
      try JoltGradientLine(angle: 540, width: 30, height: 30),
      try JoltGradientLine(angle: 180, width: 30, height: 30))
    XCTAssertThrowsError(try JoltGradientLine(angle: .nan, width: 1, height: 1))
    XCTAssertThrowsError(try JoltGradientLine(angle: 0, width: -1, height: 1))
  }
  func testEffectMathRejectsInvalidInput() {
    XCTAssertThrowsError(try JoltEffects.loaderItems(.dots, size: .nan))
    XCTAssertThrowsError(try JoltEffects.loaderItems(.dots, size: 48, duration: 0))
    XCTAssertThrowsError(try JoltEffects.loaderItems(.ring, size: 48, duration: 60_001))
    XCTAssertThrowsError(try JoltEffects.loaderItems(.bars, size: 48, elapsed: .infinity))
    XCTAssertThrowsError(try JoltEffects.shimmerOffset(elapsed: 0, duration: -1))
    XCTAssertThrowsError(try JoltEffects.revealRadius(width: -1, height: 1, x: 0, y: 0))
    XCTAssertEqual(try JoltEffects.loaderItems(.dots, size: 0).map(\.width), [0, 0, 0])
  }
}
