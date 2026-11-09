import XCTest

@testable import JoltSwiftUI

final class InspectorTests: XCTestCase {
  @MainActor func testOptInBoundedHistoryAndBorrowedCleanup() async throws {
    let clock = JoltClock(manual: true)
    let scope = JoltScope()
    let value = try scope.value(0, clock: clock)
    let disabled = try JoltInspector(clock: clock)
    let inactive = try disabled.watch(value, label: "ignored")
    let inspector = try JoltInspector(development: true, capacity: 8, clock: clock)
    let observation = try inspector.watch(value, label: "x")
    let ownership = try inspector.watch(scope, label: "card")
    XCTAssertEqual(clock.activeCount, 0)
    try value.animate(to: 100, transition: .tween(milliseconds: 100, ease: .linear))
    for _ in 0..<10 { try clock.advance(by: 10) }
    #if DEBUG
      XCTAssertEqual(inspector.events.count, 8)
      XCTAssertEqual(inspector.resourceCount, 1)
      XCTAssertEqual(inspector.snapshot().first?.value, 100)
      XCTAssertEqual(inspector.activeClockClients, 0)
    #else
      XCTAssertFalse(inspector.enabled)
      XCTAssertTrue(inspector.events.isEmpty)
      XCTAssertTrue(inspector.snapshot().isEmpty)
    #endif
    XCTAssertTrue(disabled.events.isEmpty)
    XCTAssertTrue(disabled.snapshot().isEmpty)
    observation.dispose()
    ownership.dispose()
    inactive.dispose()
    inspector.dispose()
    XCTAssertFalse(value.disposed)
    XCTAssertFalse(scope.disposed)
    try value.set(7)
    XCTAssertTrue(inspector.events.isEmpty)
    scope.dispose()
  }
}
