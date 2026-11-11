import SwiftUI
import XCTest

@testable import JoltSwiftUI

final class EffectRenderTests: XCTestCase {
  private typealias Pixel = (red: Int, green: Int, blue: Int, alpha: Int)
  @MainActor private func render(_ view: some View, width: Int, height: Int) -> (Int, Int) -> Pixel
  {
    let renderer = ImageRenderer(
      content: view.frame(width: CGFloat(width), height: CGFloat(height))
        .environment(\.joltProvidedActivity, true))
    renderer.scale = 1
    var data = [UInt8](repeating: 0, count: width * height * 4)
    let context = CGContext(
      data: &data, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
      space: CGColorSpace(name: CGColorSpace.sRGB)!,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.draw(renderer.cgImage!, in: CGRect(x: 0, y: 0, width: width, height: height))
    return { x, y in
      let index = (y * width + x) * 4
      return (Int(data[index]), Int(data[index + 1]), Int(data[index + 2]), Int(data[index + 3]))
    }
  }
  @MainActor func testGradientCornersAndBandsFollowTheCSSAngleInPoints() throws {
    let gradient = try JoltGradient(
      colors: [.init(argb: 0xff00_0000), .init(argb: 0xffff_ffff)], angle: 45)
    let pixel = render(Color.clear.joltGradient(gradient), width: 200, height: 100)
    XCTAssertLessThan(pixel(0, 99).red, 8)
    XCTAssertGreaterThan(pixel(199, 0).red, 247)
    let centre = pixel(100, 50).red
    XCTAssertEqual(pixel(70, 20).red, centre, accuracy: 2)
    XCTAssertEqual(pixel(130, 80).red, centre, accuracy: 2)
    XCTAssertLessThan(pixel(0, 0).red, centre - 20)
  }
  @MainActor func testShimmerPaintsOnlyOpaqueContentAndHidesUnderReducedMotion() throws {
    let clock = JoltClock.testClock()
    let shimmer = try JoltShimmer(clock: clock)
    shimmer.link(UUID(), active: true, reduced: false)
    try clock.advance(by: 750)
    XCTAssertEqual(shimmer.offset, 0)
    let skeleton = HStack(spacing: 0) {
      Rectangle().fill(Color(white: 0.2)).frame(width: 100, height: 100)
      Color.clear.frame(width: 100, height: 100)
    }
    let swept = render(skeleton.joltShimmer(shimmer), width: 200, height: 100)
    let still = render(
      skeleton.joltShimmer(shimmer).joltReduceMotion(true), width: 200, height: 100)
    XCTAssertGreaterThan(swept(60, 50).red, still(60, 50).red + 20)
    XCTAssertEqual(swept(150, 50).alpha, 0)
    XCTAssertEqual(still(150, 50).alpha, 0)
    XCTAssertEqual(still(60, 50).red, 51, accuracy: 2)
  }
  @MainActor func testRevealClipsToItsCircleAndHidesWhenConcealed() throws {
    let clock = JoltClock.testClock()
    let reveal = JoltReveal(revealed: false, clock: clock)
    let surface = Color(red: 1, green: 0, blue: 0).joltReveal(reveal)
    XCTAssertEqual(render(surface, width: 100, height: 100)(50, 50).alpha, 0)
    reveal.resize(width: 100, height: 100)
    reveal.link(UUID(), active: true, reduced: false)
    try reveal.reveal(from: JoltPoint(0, 0), duration: 1000)
    try clock.advance(by: 500)
    let half = render(surface, width: 100, height: 100)
    XCTAssertEqual(half(10, 10).alpha, 255)
    XCTAssertEqual(half(95, 95).alpha, 0)
    try clock.advance(by: 500)
    XCTAssertNil(reveal.circle)
    XCTAssertEqual(render(surface, width: 100, height: 100)(95, 95).alpha, 255)
  }
}
