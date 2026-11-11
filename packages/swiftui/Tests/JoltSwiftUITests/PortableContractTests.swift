import XCTest

@testable import JoltSwiftUI

final class PortableContractTests: XCTestCase {
  @MainActor private func linear() throws -> JoltTransition {
    try .tween(milliseconds: 1000, ease: .linear)
  }
  @MainActor func testMemberReplacementCancelsARunningGroupAtOnce() async throws {
    let clock = JoltClock.testClock()
    let x = try JoltMotionValue(0, clock: clock)
    let y = try JoltMotionValue(0, clock: clock)
    let group = try JoltPropertyGroup(["x": x, "y": y], clock: clock)
    var results: [Bool] = []
    try group.animate(to: ["x": 100, "y": 200], transition: linear()) { results.append($0) }
    try clock.advance(by: 250)
    try y.set(5)
    XCTAssertEqual(results, [false])
    XCTAssertEqual(group.state, .cancelled)
    try clock.advance(by: 1000)
    XCTAssertEqual(x.value, 25, accuracy: 0.001)
    XCTAssertEqual(y.value, 5)
    XCTAssertEqual(results, [false])
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testMemberReplacementCancelsAPausedGroupOnce() async throws {
    let clock = JoltClock.testClock()
    let x = try JoltMotionValue(0, clock: clock)
    let y = try JoltMotionValue(0, clock: clock)
    let group = try JoltPropertyGroup(["x": x, "y": y], clock: clock)
    var results: [Bool] = []
    try group.animate(to: ["x": 100, "y": 200], transition: linear()) { results.append($0) }
    try clock.advance(by: 250)
    group.pause()
    try x.animate(to: -50, transition: linear())
    XCTAssertEqual(results, [false])
    XCTAssertEqual(group.state, .cancelled)
    XCTAssertEqual(y.state, .cancelled)
    group.play()
    try clock.advance(by: 1000)
    XCTAssertEqual(x.value, -50)
    XCTAssertEqual(y.value, 50, accuracy: 0.001)
    XCTAssertEqual(results, [false])
    XCTAssertEqual(clock.activeCount, 0)
    group.dispose()
    XCTAssertEqual(results, [false])
  }
  @MainActor func testOverlappingGroupsCancelTheOlderGroupOnce() async throws {
    let clock = JoltClock.testClock()
    let x = try JoltMotionValue(0, clock: clock)
    let y = try JoltMotionValue(0, clock: clock)
    let z = try JoltMotionValue(0, clock: clock)
    let first = try JoltPropertyGroup(["x": x, "y": y], clock: clock)
    let second = try JoltPropertyGroup(["y": y, "z": z], clock: clock)
    var older: [Bool] = []
    var newer: [Bool] = []
    try first.animate(to: ["x": 100, "y": 100], transition: linear()) { older.append($0) }
    try clock.advance(by: 250)
    try second.animate(to: ["y": -100, "z": -100], transition: linear()) { newer.append($0) }
    XCTAssertEqual(older, [false])
    XCTAssertEqual(first.state, .cancelled)
    first.cancel()
    try clock.advance(by: 1000)
    XCTAssertEqual(x.value, 25, accuracy: 0.001)
    XCTAssertEqual(y.value, -100)
    XCTAssertEqual(z.value, -100)
    XCTAssertEqual(newer, [true])
    try first.animate(to: ["x": 0, "y": 0], transition: linear()) { older.append($0) }
    try clock.advance(by: 1000)
    XCTAssertEqual(older, [false, true])
    XCTAssertEqual(newer, [true])
    XCTAssertEqual(second.state, .completed)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testMemberDisposalAndRepeatedCommandsSettleOnce() async throws {
    let clock = JoltClock.testClock()
    let x = try JoltMotionValue(0, clock: clock)
    let y = try JoltMotionValue(0, clock: clock)
    let group = try JoltPropertyGroup(["x": x, "y": y], clock: clock)
    var results: [Bool] = []
    try group.animate(to: ["x": 10, "y": 10], transition: linear()) { results.append($0) }
    try clock.advance(by: 1000)
    group.cancel()
    group.cancel()
    XCTAssertEqual(results, [true])
    XCTAssertEqual(group.state, .completed)
    try group.animate(to: ["x": 20, "y": 20], transition: linear()) { results.append($0) }
    try clock.advance(by: 500)
    y.dispose()
    XCTAssertEqual(results, [true, false])
    XCTAssertEqual(group.state, .cancelled)
    group.cancel()
    group.play()
    try clock.advance(by: 1000)
    XCTAssertEqual(x.value, 15, accuracy: 0.001)
    XCTAssertThrowsError(try group.animate(to: ["x": 0, "y": 0]))
    group.dispose()
    XCTAssertEqual(results, [true, false])
    XCTAssertEqual(clock.activeCount, 0)
  }
  func testPointerSamplesMatchTheBoundedPortableMapping() {
    let size = CGSize(width: 200, height: 100)
    XCTAssertEqual(
      JoltPointerSample.resolve(.init(x: 150, y: 25), in: size, enabled: true),
      .init(x: 0.5, y: -0.5, active: true))
    XCTAssertEqual(
      JoltPointerSample.resolve(.init(x: 0, y: 100), in: size, enabled: true),
      .init(x: -1, y: 1, active: true))
    let outside: [CGPoint?] = [
      CGPoint(x: 201, y: 50), CGPoint(x: 100, y: -1), CGPoint(x: CGFloat.nan, y: 0), nil,
    ]
    for location in outside {
      XCTAssertEqual(JoltPointerSample.resolve(location, in: size, enabled: true), .center)
    }
    XCTAssertEqual(
      JoltPointerSample.resolve(
        .init(x: 50, y: 50), in: .init(width: 0, height: 100), enabled: true),
      .center)
    XCTAssertEqual(
      JoltPointerSample.resolve(.init(x: 50, y: 50), in: size, enabled: false), .center)
  }
}
