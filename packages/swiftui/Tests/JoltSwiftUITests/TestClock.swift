@testable import JoltSwiftUI

extension JoltClock {
  @MainActor static func testClock(reducedMotion: Bool = false) -> JoltClock {
    let clock = JoltClock(manual: true)
    clock.testingReducedMotion = reducedMotion
    return clock
  }
}
