import XCTest

@testable import JoltSwiftUI

final class OwnershipTests: XCTestCase {
  @MainActor func testPauseSuspensionAndIdleClock() async throws {
    let clock = JoltClock(manual: true)
    let scope = JoltScope()
    let value = try scope.value(0, clock: clock)
    try value.animate(to: 100, transition: .tween(milliseconds: 1000, ease: .linear))
    XCTAssertEqual(clock.activeCount, 1)
    try clock.advance(by: 200)
    XCTAssertEqual(value.value, 20, accuracy: 0.001)
    value.pause()
    XCTAssertEqual(clock.activeCount, 0)
    scope.suspend()
    scope.resume()
    try clock.advance(by: 300)
    XCTAssertEqual(value.value, 20, accuracy: 0.001)
    value.play()
    try clock.advance(by: 800)
    XCTAssertEqual(value.value, 100)
    XCTAssertEqual(clock.activeCount, 0)
    try value.animate(to: 0)
    scope.dispose()
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertTrue(value.disposed)
  }
  @MainActor func testInvalidReplacementAndVelocityContinuity() async throws {
    let clock = JoltClock(manual: true)
    let value = try JoltMotionValue(0, clock: clock)
    var completed: [Bool] = []
    try value.animate(to: 100, completion: { completed.append($0) })
    try clock.advance(by: 100)
    let before = value.value
    let velocity = value.velocity
    XCTAssertThrowsError(try value.animate(to: .nan))
    XCTAssertEqual(value.value, before)
    XCTAssertEqual(clock.activeCount, 1)
    try value.animate(to: -30)
    XCTAssertEqual(value.value, before, accuracy: 0.0001)
    XCTAssertEqual(value.velocity, velocity, accuracy: 0.0001)
    XCTAssertEqual(completed, [false])
    try clock.advance(by: 10_100)
    XCTAssertEqual(value.value, -30)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testScopeOwnershipAndFollowerCleanup() async throws {
    let clock = JoltClock(manual: true)
    let scope = JoltScope()
    let other = JoltScope()
    let source = try scope.value(0, clock: clock)
    let destination = try scope.value(0, clock: clock)
    let follower = try scope.retain(destination.follow(source))
    XCTAssertThrowsError(try other.retain(destination))
    try source.set(40)
    try clock.advance(by: 60)
    XCTAssertGreaterThan(destination.value, 0)
    XCTAssertLessThan(destination.value, 40)
    scope.suspend()
    let frozen = destination.value
    try source.set(80)
    try clock.advance(by: 1000)
    XCTAssertEqual(destination.value, frozen)
    scope.resume()
    try clock.advance(by: 10_100)
    XCTAssertEqual(destination.value, 80)
    scope.release(follower)
    try source.set(10)
    try clock.advance(by: 10_100)
    XCTAssertEqual(destination.value, 80)
    scope.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testTimelineCuesCancellationAndReplacement() async throws {
    let clock = JoltClock(manual: true)
    let value = try JoltMotionValue(0, clock: clock)
    var cues: [String] = []
    var effects = 0
    var completions: [Bool] = []
    let timeline = try JoltTimeline(
      tracks: [.init(value, to: 100, transition: .tween(milliseconds: 500, ease: .linear))],
      cues: [
        .init("bite", at: 100) { name in
          cues.append(name)
          effects += 1
          return JoltEffect { effects -= 1 }
        },
        .init("later", at: 400) { name in
          cues.append(name)
          return nil
        },
      ], clock: clock, completion: { completions.append($0) })
    try clock.advance(by: 100)
    XCTAssertEqual(cues, ["bite"])
    XCTAssertEqual(effects, 1)
    timeline.pause()
    XCTAssertEqual(clock.activeCount, 0)
    try clock.advance(by: 500)
    XCTAssertEqual(value.value, 20, accuracy: 0.001)
    timeline.play()
    try clock.advance(by: 100)
    XCTAssertEqual(value.value, 40, accuracy: 0.001)
    try value.set(7)
    try clock.advance(by: 20)
    XCTAssertEqual(timeline.state, .cancelled)
    XCTAssertEqual(cues, ["bite"])
    XCTAssertEqual(effects, 0)
    XCTAssertEqual(value.value, 7)
    XCTAssertEqual(completions, [false])
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testCueCanDisposeItsOwnTimeline() async throws {
    let clock = JoltClock(manual: true)
    let value = try JoltMotionValue(0, clock: clock)
    var timeline: JoltTimeline?
    var effects = 0
    var later = 0
    timeline = try JoltTimeline(
      tracks: [.init(value, to: 1, transition: .tween(milliseconds: 500))],
      cues: [
        .init("cancel", at: 100) { _ in
          timeline?.dispose()
          effects += 1
          return JoltEffect { effects -= 1 }
        },
        .init("same-time", at: 100) { _ in
          later += 1
          return nil
        },
      ], clock: clock)
    try clock.advance(by: 100)
    XCTAssertEqual(effects, 0)
    XCTAssertEqual(later, 0)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testSequenceAndStaggerSettleAndValidateBeforeOwnership() async throws {
    let clock = JoltClock(manual: true)
    let a = try JoltMotionValue(0, clock: clock)
    let b = try JoltMotionValue(0, clock: clock)
    let tween = try JoltTransition.tween(milliseconds: 100, ease: .linear)
    let sequence = try JoltTimeline.sequence(
      [.init(a, to: 10, transition: tween), .init(b, to: 20, transition: tween)], gap: 50,
      clock: clock)
    try clock.advance(by: 125)
    XCTAssertEqual(a.value, 10)
    XCTAssertEqual(b.value, 0)
    try clock.advance(by: 75)
    XCTAssertEqual(b.value, 10, accuracy: 0.001)
    try clock.advance(by: 50)
    XCTAssertEqual(sequence.state, .completed)
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertThrowsError(
      try JoltTimeline(
        tracks: [.init(a, to: 0, transition: tween), .init(a, to: 100, at: 50, transition: tween)],
        clock: clock))
    XCTAssertEqual(a.value, 10)
    let stagger = try JoltTimeline.stagger(
      [a, b], to: 0, interval: 50, transition: tween, clock: clock)
    try clock.advance(by: 150)
    XCTAssertEqual(a.value, 0)
    XCTAssertEqual(b.value, 0)
    XCTAssertEqual(stagger.state, .completed)
  }
  @MainActor func testDragBoundsSnapAndInterruptedPresentation() async throws {
    let clock = JoltClock(manual: true)
    let bounds = try JoltDragBounds(x: -100...100, y: 0...0)
    let drag = try JoltDragModel(
      bounds: bounds, snaps: [.init(x: -100, y: 0), .zero, .init(x: 100, y: 0)], clock: clock)
    drag.begin()
    drag.update(translation: .init(width: 200, height: 50))
    XCTAssertEqual(drag.position, .init(x: 100, y: 0))
    drag.update(translation: .init(width: 62, height: 0))
    drag.end()
    try clock.advance(by: 50)
    let atInterruption = drag.position.x
    XCTAssertGreaterThan(atInterruption, 62)
    XCTAssertLessThan(atInterruption, 100)
    drag.begin()
    drag.update(translation: .init(width: -10, height: 0))
    XCTAssertEqual(drag.position.x, atInterruption - 10, accuracy: 0.001)
    drag.end(cancelled: true)
    XCTAssertEqual(clock.activeCount, 0)
    drag.adjust(forward: false, reducedMotion: true)
    XCTAssertEqual(drag.position.x, 0)
    drag.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testScrollProgressClampsAndRefreshesExtent() async throws {
    let source = try JoltScrollProgress()
    source.update(offset: 100, extent: 400)
    XCTAssertEqual(source.progress, 0.25)
    source.update(offset: 100, extent: 200)
    XCTAssertEqual(source.progress, 0.5)
    source.update(offset: -50, extent: 200)
    XCTAssertEqual(source.progress, 0)
    source.update(offset: 500, extent: 200)
    XCTAssertEqual(source.progress, 1)
    source.update(offset: 0, extent: 0)
    XCTAssertEqual(source.progress, 0)
  }
}

extension OwnershipTests {
  @MainActor func testReducedTimelineSettlesWithoutSideEffectsOrClock() async throws {
    let clock = JoltClock(manual: true)
    let value = try JoltMotionValue(0, clock: clock)
    var cues = 0
    let timeline = try JoltTimeline(
      tracks: [.init(value, to: 100, at: 300)],
      cues: [
        .init("bite", at: 100) { _ in
          cues += 1
          return nil
        }
      ], clock: clock, reducedMotion: true)
    XCTAssertEqual(value.value, 100)
    XCTAssertEqual(timeline.state, .completed)
    XCTAssertEqual(cues, 0)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testLateCuePolicyAndUniqueNames() async throws {
    let clock = JoltClock(manual: true)
    let value = try JoltMotionValue(0, clock: clock)
    var cues = 0
    let cue = JoltTimelineCue("bite", at: 100) { _ in
      cues += 1
      return nil
    }
    XCTAssertThrowsError(try JoltTimeline(tracks: [], cues: [cue, cue], clock: clock))
    let timeline = try JoltTimeline(
      tracks: [.init(value, to: 10, transition: .tween(milliseconds: 500))], cues: [cue],
      clock: clock)
    try clock.advance(by: 250)
    XCTAssertEqual(cues, 0)
    timeline.dispose()
    let catchUp = try JoltTimeline(tracks: [], cues: [cue], clock: clock, cueLatePolicy: .catchUp)
    try clock.advance(by: 250)
    XCTAssertEqual(cues, 1)
    XCTAssertEqual(catchUp.state, .completed)
  }
  @MainActor func testReentrantReplacementKeepsNewestCompletion() async throws {
    let clock = JoltClock(manual: true)
    let value = try JoltMotionValue(0, clock: clock)
    var completed: [String] = []
    try value.animate(
      to: 100,
      completion: { done in
        completed.append(done ? "old-completed" : "old-cancelled")
        try! value.animate(
          to: 7, completion: { completed.append($0 ? "new-completed" : "new-cancelled") })
      })
    try clock.advance(by: 100)
    try value.animate(
      to: 30, completion: { completed.append($0 ? "outer-completed" : "outer-cancelled") })
    try clock.advance(by: 10_100)
    XCTAssertEqual(value.value, 7)
    XCTAssertEqual(completed, ["old-cancelled", "outer-cancelled", "new-completed"])
    XCTAssertEqual(clock.activeCount, 0)
  }
}
