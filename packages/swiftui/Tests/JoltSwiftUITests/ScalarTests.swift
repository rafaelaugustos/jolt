import XCTest
@testable import JoltSwiftUI

final class ScalarTests: XCTestCase {
  @MainActor func testFrameBatchAndBorrowedLifetime() throws {
    let clock=JoltClock.testClock(), a=try JoltMotionValue(0, clock: clock), b=try JoltMotionValue(0, clock: clock)
    let sum=try a.add(b), square=try sum.mul(sum)
    var samples: [Double]=[]
    let observation=try square.subscribe { samples.append($0) }
    try a.animate(to: 100, transition: .tween(milliseconds: 1000, ease: .linear))
    try b.animate(to: 50, transition: .tween(milliseconds: 500, ease: .linear))
    XCTAssertEqual(clock.activeCount, 2)
    try clock.advance(by: 250)
    XCTAssertEqual(square.value, 2500, accuracy: 0.001)
    XCTAssertEqual(samples.count, 1)
    XCTAssertEqual(square.velocity, 20000, accuracy: 0.01)
    observation.dispose(); sum.dispose()
    XCTAssertTrue(square.disposed)
    XCTAssertFalse(a.disposed); XCTAssertFalse(b.disposed)
    a.dispose(); b.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testDepthAndDifferentClocks() throws {
    let a=try JoltMotionValue(2, clock: .testClock()), b=try JoltMotionValue(3, clock: .testClock())
    XCTAssertThrowsError(try a.add(b))
    var value: any JoltScalarSource=a
    for _ in 0..<32 { value=try value.add(1) }
    XCTAssertEqual(value.value, 34)
    XCTAssertThrowsError(try value.add(1))
    a.dispose(); b.dispose()
  }
  @MainActor func testVelocityAtRestAndResume() throws {
    let clock=JoltClock.testClock(), a=try JoltMotionValue(0, clock: clock)
    let speed=try a.velocityValue()
    try a.animate(to: 100, transition: .tween(milliseconds: 1000, ease: .linear))
    try clock.advance(by: 250)
    XCTAssertEqual(speed.value, 100, accuracy: 0.001)
    a.pause()
    XCTAssertEqual(speed.value, 0)
    a.play(); try clock.advance(by: 100)
    XCTAssertEqual(speed.value, 100, accuracy: 0.001)
    a.cancel()
    XCTAssertEqual(speed.value, 0)
    a.dispose(); XCTAssertTrue(speed.disposed)
  }
}

extension ScalarTests {
  @MainActor func testPausedIntermediateFreezesItsDescendants() throws {
    let input=try JoltMotionValue(2, clock: .testClock())
    let middle=try input.mul(2), output=try middle.add(1)
    middle.pause()
    try input.set(10)
    XCTAssertEqual(output.value, 5)
    middle.play()
    XCTAssertEqual(output.value, 21)
    input.dispose()
  }
}
