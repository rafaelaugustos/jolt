import SwiftUI
import XCTest

@testable import JoltSwiftUI

#if os(macOS)
  import AppKit
#endif

final class ActivityTests: XCTestCase {
  #if os(macOS)
    func testClockDisplaysFollowVisibleWindowsOnly() {
      XCTAssertEqual(JoltWindows.displays([]), [])
      XCTAssertEqual(JoltWindows.displays([(false, 1), (false, 2)]), [])
      XCTAssertEqual(JoltWindows.displays([(true, 1), (true, 1), (false, 2)]), [1])
      XCTAssertEqual(JoltWindows.displays([(true, 2), (true, 1), (true, nil)]), [2, 1])
    }
    @MainActor func testWindowVisibilityIgnoresFocusAndHostsOutsideWindows() {
      XCTAssertFalse(JoltWindows.visible(nil))
      let window = NSWindow(
        contentRect: .init(x: 0, y: 0, width: 80, height: 80), styleMask: [.titled],
        backing: .buffered, defer: true)
      window.isReleasedWhenClosed = false
      XCTAssertFalse(JoltWindows.visible(window))
      XCTAssertNil(NSHostingView(rootView: Color.clear.joltActivity()).window)
      XCTAssertEqual(EnvironmentValues().joltActive, EnvironmentValues().scenePhase == .active)
    }
  #endif
  @MainActor func testManualClockStillTicksOnEqualTimestamps() throws {
    let clock = JoltClock.testClock()
    var ticks = 0
    let subscription = clock.subscribe { _ in ticks += 1 }
    try clock.advance(by: 0)
    try clock.advance(by: 0)
    XCTAssertEqual(ticks, 2)
    subscription.cancel()
  }
}
