import SwiftUI
import XCTest

@testable import JoltSwiftUI

final class TextEffectTests: XCTestCase {
  @MainActor private func ink<V: View>(_ view: V) -> Int {
    let renderer = ImageRenderer(
      content: view.environment(\.joltProvidedActivity, true).foregroundStyle(.black)
        .font(.system(size: 24)).frame(width: 320, alignment: .leading).padding(30))
    renderer.scale = 1
    guard let image = renderer.cgImage else { return -1 }
    let width = image.width
    let height = image.height
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let context = CGContext(
      data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    context?.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return stride(from: 3, to: pixels.count, by: 4).filter { pixels[$0] > 0 }.count
  }

  @MainActor func testEntranceStaggersWordsOnTheClockAndCompletes() throws {
    let clock = JoltClock.testClock()
    let entrance = try JoltTextEntrance(
      "Hello, world!", options: .init(by: .word, duration: 400, stagger: 35), clock: clock)
    XCTAssertEqual(entrance.pieces.map(\.text), ["Hello", ",", " ", "world", "!"])
    XCTAssertEqual(entrance.duration, 540)
    XCTAssertEqual(entrance.state, .running)
    XCTAssertEqual(clock.activeCount, 1)
    try clock.advance(by: 200)
    XCTAssertEqual(entrance.elapsed, 200)
    XCTAssertEqual(entrance.progress, 200 / 540, accuracy: 1e-9)
    try clock.advance(by: 400)
    XCTAssertEqual(entrance.state, .completed)
    XCTAssertEqual(entrance.progress, 1)
    XCTAssertEqual(clock.activeCount, 0)
    entrance.replay()
    XCTAssertEqual(entrance.state, .running)
    XCTAssertEqual(entrance.elapsed, 0)
    try entrance.replay("Again")
    XCTAssertEqual(entrance.text, "Again")
    XCTAssertEqual(entrance.duration, 400)
    try clock.advance(by: 400)
    XCTAssertEqual(entrance.state, .completed)
  }

  @MainActor func testEntranceRejectsInvalidTextWithoutTouchingPlayback() throws {
    let clock = JoltClock.testClock()
    let long = String(repeating: "a", count: 257)
    XCTAssertThrowsError(try JoltTextEntrance(long, clock: clock))
    XCTAssertNoThrow(
      try JoltTextEntrance(String(repeating: "👩‍👩‍👧‍👦", count: 256), clock: clock, autoplay: false))
    XCTAssertThrowsError(
      try JoltTextEntrance(
        String(repeating: "a", count: 256), options: .init(stagger: 300), clock: clock))
    let entrance = try JoltTextEntrance("Steady", clock: clock)
    try clock.advance(by: 100)
    XCTAssertThrowsError(try entrance.replay(long))
    XCTAssertEqual(entrance.text, "Steady")
    XCTAssertEqual(entrance.state, .running)
    XCTAssertEqual(entrance.elapsed, 100)
    entrance.dispose()
    XCTAssertThrowsError(try entrance.replay("Later"))
    XCTAssertEqual(entrance.state, .disposed)
    XCTAssertEqual(clock.activeCount, 0)
  }

  @MainActor func testEntrancePauseSurvivesScopeSuspension() throws {
    let clock = JoltClock.testClock()
    let scope = JoltScope()
    let entrance = try scope.retain(JoltTextEntrance("Paused text", clock: clock))
    try clock.advance(by: 120)
    entrance.pause()
    XCTAssertEqual(entrance.state, .paused)
    scope.suspend()
    XCTAssertEqual(entrance.state, .suspended)
    scope.resume()
    XCTAssertEqual(entrance.state, .paused)
    try clock.advance(by: 500)
    XCTAssertEqual(entrance.elapsed, 120)
    XCTAssertEqual(clock.activeCount, 0)
    entrance.play()
    try clock.advance(by: 30)
    XCTAssertEqual(entrance.elapsed, 150)
    scope.dispose()
    XCTAssertEqual(entrance.state, .disposed)
    XCTAssertEqual(clock.activeCount, 0)
  }

  @MainActor func testEntranceWaitsWithoutAutoplayAndHonoursReducedMotion() throws {
    let clock = JoltClock.testClock()
    let waiting = try JoltTextEntrance("Wait", clock: clock, autoplay: false)
    XCTAssertEqual(waiting.state, .paused)
    XCTAssertEqual(clock.activeCount, 0)
    waiting.play()
    XCTAssertEqual(waiting.state, .running)
    waiting.cancel()
    XCTAssertEqual(waiting.state, .cancelled)
    XCTAssertEqual(waiting.progress, 1)
    XCTAssertEqual(clock.activeCount, 0)
    let reduced = try JoltTextEntrance("Now", clock: clock, reducedMotion: true)
    XCTAssertEqual(reduced.state, .completed)
    XCTAssertEqual(clock.activeCount, 0)
    let instant = try JoltTextEntrance("Now", options: .init(duration: 0, delay: 500), clock: clock)
    XCTAssertEqual(instant.state, .completed)
    let running = try JoltTextEntrance("Later", clock: clock)
    clock.testingReducedMotion = true
    try clock.advance(by: 16)
    XCTAssertEqual(running.state, .completed)
    XCTAssertEqual(clock.activeCount, 0)
    let system = JoltClock.testClock(reducedMotion: true)
    XCTAssertEqual(try JoltTextEntrance("System", clock: system).state, .completed)
    let viewReduced = try JoltTextEntrance("View", clock: JoltClock.testClock())
    viewReduced.reduceMotion(true)
    XCTAssertEqual(viewReduced.state, .completed)
  }

  @MainActor func testEntranceDrawsNothingAtItsFirstFrameAndTheWholeTextAtTheEnd() throws {
    let clock = JoltClock.testClock()
    let entrance = try JoltTextEntrance(
      "A sentence long enough to wrap onto a second line", clock: clock, autoplay: false)
    XCTAssertEqual(ink(JoltAnimatedText(entrance)), 0)
    entrance.play()
    try clock.advance(by: 600)
    let partial = ink(JoltAnimatedText(entrance))
    try clock.advance(by: 5000)
    XCTAssertEqual(entrance.state, .completed)
    let complete = ink(JoltAnimatedText(entrance))
    let plain = ink(Text("A sentence long enough to wrap onto a second line"))
    XCTAssertGreaterThan(partial, 0)
    XCTAssertLessThan(partial, complete)
    XCTAssertEqual(complete, plain)
  }

  @MainActor func testRollSetsTextAtOnceAndRollsOnlyChangedGraphemes() throws {
    let clock = JoltClock.testClock()
    let number = try JoltRollingNumber(99, clock: clock)
    XCTAssertEqual(number.text, "99")
    try number.roll(to: 100)
    XCTAssertEqual(number.text, "100")
    XCTAssertEqual(number.value, 100)
    XCTAssertEqual(number.state, .running)
    XCTAssertEqual(number.layers.count, 2)
    XCTAssertEqual(Set(number.layers[0].motions.keys), [0, 1, 2])
    XCTAssertEqual(Set(number.layers[1].motions.keys), [0, 1])
    XCTAssertEqual(number.layers[0].motions[2]?.from, RollPose(y: 1, opacity: 0))
    XCTAssertEqual(number.layers[1].motions[1]?.to, RollPose(y: -1, opacity: 0))
    try clock.advance(by: 3000)
    XCTAssertEqual(number.state, .completed)
    XCTAssertEqual(number.layers.count, 1)
    XCTAssertTrue(number.layers[0].motions.isEmpty)
    XCTAssertEqual(clock.activeCount, 0)
    try number.roll(to: 98)
    XCTAssertEqual(number.layers[0].motions[0]?.from, RollPose(y: -1, opacity: 0))
    XCTAssertEqual(number.layers[1].motions[0]?.to, RollPose(y: 1, opacity: 0))
    XCTAssertEqual(number.layers[1].motions[1]?.to, RollPose(y: 1, opacity: 0))
    try number.roll(to: 98)
    try clock.advance(by: 3000)
    try number.roll(to: 98, direction: .up)
    XCTAssertEqual(number.state, .completed)
    XCTAssertEqual(clock.activeCount, 0)
  }

  @MainActor func testInterruptionLeavesFromTheDisplayedPose() throws {
    let clock = JoltClock.testClock()
    let number = try JoltRollingNumber(
      1240, format: { "$\(Int($0))" }, options: .init(stagger: 30), clock: clock)
    try number.roll(to: 1250)
    try clock.advance(by: 90)
    let shown = number.poses(number.layers[0])
    let tens = try XCTUnwrap(shown[3])
    XCTAssertGreaterThan(tens.opacity, 0)
    XCTAssertLessThan(tens.opacity, 1)
    try number.roll(to: 1260)
    XCTAssertEqual(number.text, "$1260")
    XCTAssertEqual(number.layers.count, 3)
    XCTAssertEqual(number.poses(number.layers[1])[3], tens)
    XCTAssertNil(number.layers[1].motions[4])
    XCTAssertEqual(number.layers[0].motions[3]?.from, RollPose(y: 1, opacity: 0))
    XCTAssertEqual(Set(number.layers[2].motions.keys), [3])
    try clock.advance(by: 3000)
    XCTAssertEqual(number.state, .completed)
    XCTAssertEqual(number.layers.count, 1)
  }

  @MainActor func testRollKeepsMovingGlyphsThatStayTheSame() throws {
    let clock = JoltClock.testClock()
    let number = try JoltRollingNumber(9, clock: clock)
    try number.roll(to: 10)
    try clock.advance(by: 60)
    let tens = number.layers[0].motions[0]
    try number.roll(to: 11)
    XCTAssertEqual(number.layers[0].motions[0]?.start, tens?.start)
    XCTAssertNotNil(number.layers[0].motions[1])
    XCTAssertNil(number.layers[1].motions[0])
  }

  @MainActor func testRollValidationPauseAndReducedMotion() throws {
    let clock = JoltClock.testClock()
    XCTAssertThrowsError(try JoltRollingNumber(.nan, clock: clock))
    let number = try JoltRollingNumber(
      1, format: { String(repeating: "9", count: Int($0)) }, clock: clock)
    try number.roll(to: 3)
    XCTAssertThrowsError(try number.roll(to: 257))
    XCTAssertThrowsError(try number.roll(to: .infinity))
    XCTAssertEqual(number.text, "999")
    XCTAssertEqual(number.state, .running)
    number.pause()
    try clock.advance(by: 5000)
    XCTAssertEqual(number.state, .paused)
    XCTAssertTrue(number.rolling)
    number.play()
    try clock.advance(by: 5000)
    XCTAssertEqual(number.state, .completed)
    try number.set(2)
    XCTAssertEqual(number.text, "99")
    XCTAssertFalse(number.rolling)
    let reduced = try JoltRollingNumber(5, clock: clock, reducedMotion: true)
    try reduced.roll(to: 6)
    XCTAssertEqual(reduced.text, "6")
    XCTAssertEqual(reduced.state, .completed)
    XCTAssertFalse(reduced.rolling)
    let viewReduced = try JoltRollingNumber(5, clock: clock)
    try viewReduced.roll(to: 7)
    viewReduced.reduceMotion(true)
    XCTAssertEqual(viewReduced.state, .completed)
    XCTAssertFalse(viewReduced.rolling)
    viewReduced.dispose()
    XCTAssertThrowsError(try viewReduced.roll(to: 8))
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertEqual(JoltRollingNumber.plain(42), "42")
    XCTAssertEqual(JoltRollingNumber.plain(-0.5), "-0.5")
  }

  @MainActor func testRollingTextDrawsBothGlyphsMidRollAndOnlyTheTargetAfter() throws {
    let clock = JoltClock.testClock()
    let number = try JoltRollingNumber(
      1249.9, format: { String(format: "%.2f", $0) }, clock: clock)
    let before = ink(JoltRollingText(number))
    try number.roll(to: 8888.88)
    try clock.advance(by: 120)
    let rolling = ink(JoltRollingText(number))
    try clock.advance(by: 3000)
    let after = ink(JoltRollingText(number))
    XCTAssertGreaterThan(before, 0)
    XCTAssertGreaterThan(rolling, 0)
    XCTAssertEqual(after, ink(Text("8888.88").monospacedDigit()))
  }
}
