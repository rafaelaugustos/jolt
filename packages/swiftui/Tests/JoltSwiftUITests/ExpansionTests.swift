import XCTest

@testable import JoltSwiftUI

final class ExpansionTests: XCTestCase {
  @MainActor func testScopeDeinitDoesNotDisposeAResourceReadoptedBeforeCleanup() async throws {
    var original: JoltScope? = JoltScope()
    let value = try original!.value(0, clock: JoltClock.testClock())
    original = nil
    let replacement = JoltScope()
    try replacement.retain(value)
    await Task.yield()
    XCTAssertFalse(value.disposed)
    try value.set(40)
    XCTAssertEqual(value.value, 40)
    replacement.dispose()
    XCTAssertTrue(value.disposed)
  }
  @MainActor func testAutoplayDisabledSurvivesScopeBackgroundCycle() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    let scope = JoltScope()
    let scene = try scope.retain(
      JoltTimeline(tracks: [.init(value, to: 100)], clock: clock, autoplay: false))
    scope.suspend()
    scope.resume()
    try clock.advance(by: 2000)
    XCTAssertEqual(value.value, 0)
    XCTAssertTrue(scene.paused)
    XCTAssertEqual(clock.activeCount, 0)
    scene.play()
    try clock.advance(by: 11000)
    XCTAssertEqual(value.value, 100)
  }
  @MainActor func testSystemPolicyChangesSettlePlaybackAndSkipSideEffects() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    var cues = 0
    let scene = try JoltTimeline(
      tracks: [.init(value, to: 100, transition: .tween(milliseconds: 1000))],
      cues: [
        .init("effect", at: 700) { _ in
          cues += 1
          return nil
        }
      ], clock: clock)
    try clock.advance(by: 100)
    XCTAssertEqual(clock.activeCount, 1)
    clock.testingReducedMotion = true
    try clock.advance(by: 16)
    XCTAssertEqual(value.value, 100)
    XCTAssertEqual(scene.state, .completed)
    XCTAssertEqual(cues, 0)
    XCTAssertEqual(clock.activeCount, 0)
    try value.animate(to: 0)
    XCTAssertEqual(value.value, 0)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testTimelineCannotStealReentrantReplacementFromCancellation() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    try value.animate(to: 100) { completed in if !completed { try! value.animate(to: 7) } }
    let scene = try JoltTimeline(tracks: [.init(value, to: 40)], clock: clock)
    XCTAssertEqual(scene.state, .cancelled)
    try clock.advance(by: 11000)
    XCTAssertEqual(value.value, 7)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testRendererFinalFrameReadsCommittedSampleAndSeek() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    var observed = -1.0
    let activity = try JoltRenderActivity(
      .init(change: { _ in }, redraw: { observed = value.value }))
    let watch = try activity.track(value)
    try value.animate(to: 100, transition: .tween(milliseconds: 1000, ease: .linear))
    try clock.advance(by: 1000)
    XCTAssertEqual(observed, 100)
    watch.dispose()
    let scene = try JoltTimeline(
      tracks: [.init(value, to: 0, transition: .tween(milliseconds: 1000, ease: .linear))],
      clock: clock, autoplay: false)
    let track = try activity.track(scene)
    try scene.seek(to: 0.25)
    XCTAssertEqual(observed, 75, accuracy: 0.001)
    XCTAssertFalse(activity.active)
    track.dispose()
    activity.dispose()
  }
  @MainActor func testDerivedAndColorBorrowSourcesAndCatchUpWithoutClock() async throws {
    let clock = JoltClock.testClock()
    let scope = JoltScope()
    let source = try JoltMotionValue(0, clock: clock)
    let map = try scope.retain(JoltMappedValue(source, mapping: JoltNumericMap([0, 1], [10, 30])))
    let color = try scope.retain(
      JoltColorValue(source, from: .init(argb: 0xffff_0000), to: .init(argb: 0xff00_00ff)))
    try source.set(0.5)
    XCTAssertEqual(map.value, 20)
    let half = color.value
    scope.pause()
    try source.set(1)
    XCTAssertEqual(map.value, 20)
    XCTAssertEqual(color.value, half)
    scope.suspend()
    scope.resume()
    XCTAssertEqual(map.value, 20)
    scope.play()
    XCTAssertEqual(map.value, 30)
    XCTAssertEqual(color.value.argb, 0xff00_00ff)
    XCTAssertEqual(clock.activeCount, 0)
    scope.dispose()
    try source.set(0)
    XCTAssertEqual(map.value, 30)
    XCTAssertFalse(source.disposed)
  }
  @MainActor func testGroupValidatesAtomicallyAndReplacementUsesOneClock() async throws {
    let clock = JoltClock.testClock()
    let x = try JoltMotionValue(0, clock: clock)
    let y = try JoltMotionValue(0, clock: clock)
    let group = try JoltPropertyGroup(["x": x, "y": y], clock: clock)
    let linear = try JoltTransition.tween(milliseconds: 1000, ease: .linear)
    var results: [Bool] = []
    try group.animate(to: ["x": 100, "y": 200], transition: linear) { results.append($0) }
    XCTAssertEqual(clock.activeCount, 1)
    try clock.advance(by: 250)
    XCTAssertEqual(x.value, 25, accuracy: 0.001)
    XCTAssertEqual(y.value, 50, accuracy: 0.001)
    XCTAssertThrowsError(try group.animate(to: ["x": 0, "missing": 100]))
    XCTAssertEqual(clock.activeCount, 1)
    XCTAssertEqual(x.target, 100)
    try group.animate(to: ["x": -100, "y": -200], transition: linear)
    XCTAssertEqual(results, [false])
    XCTAssertEqual(x.value, 25, accuracy: 0.001)
    group.pause()
    XCTAssertEqual(clock.activeCount, 0)
    group.suspend()
    group.resume()
    XCTAssertEqual(clock.activeCount, 0)
    group.play()
    try clock.advance(by: 1000)
    XCTAssertEqual(x.value, -100)
    XCTAssertEqual(y.value, -200)
    XCTAssertEqual(clock.activeCount, 0)
    group.dispose()
    XCTAssertFalse(x.disposed)
    try x.set(10)
  }
  @MainActor func testGroupReentrantCancellationKeepsLatestRun() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    let group = try JoltPropertyGroup(["x": value], clock: clock)
    try group.animate(to: ["x": 100]) { complete in
      if !complete { try! group.animate(to: ["x": 30]) }
    }
    try group.animate(to: ["x": -100])
    try clock.advance(by: 11000)
    XCTAssertEqual(value.value, 30)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testStatesValidateBeforeMutatingAndDisposeBorrowedGroup() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    let group = try JoltPropertyGroup(["x": value], clock: clock)
    let states = try JoltMotionStates(
      group: group, states: ["rest": ["x": 0], "focus": ["x": 100]])
    try states.set("focus")
    try clock.advance(by: 100)
    XCTAssertThrowsError(try states.set("missing"))
    XCTAssertEqual(states.current, "focus")
    try states.set("rest")
    try clock.advance(by: 11000)
    XCTAssertEqual(value.value, 0)
    states.dispose()
    XCTAssertFalse(group.disposed)
    XCTAssertFalse(value.disposed)
  }
  @MainActor func testBehaviorPriorityBlockingRestorationAndStaleCancellation() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    let group = try JoltPropertyGroup(["x": value], clock: clock)
    let tween = try JoltTransition.tween(milliseconds: 500)
    let behaviors = try JoltBehaviors(
      group: group,
      definitions: [
        "rest": .init(["x": 0], transition: tween),
        "pet": .init(["x": 20], priority: 1, transition: tween),
        "dress": .init(["x": 80], priority: 2, blocks: ["eat"], transition: tween),
        "eat": .init(["x": 100], priority: 3, transition: tween),
      ], rest: "rest")
    let pet = try behaviors.request("pet")
    let dress = try behaviors.request("dress")
    XCTAssertEqual(pet.status, .interrupted)
    XCTAssertEqual(try behaviors.request("eat").status, .blocked)
    pet.cancel()
    XCTAssertTrue(behaviors.current === dress)
    try clock.advance(by: 500)
    XCTAssertEqual(dress.status, .completed)
    XCTAssertEqual(behaviors.current?.name, "rest")
    try clock.advance(by: 500)
    XCTAssertEqual(value.value, 0)
    XCTAssertEqual(clock.activeCount, 0)
    _ = try behaviors.request("pet")
    behaviors.pause()
    behaviors.cancel()
    XCTAssertEqual(clock.activeCount, 0)
    behaviors.play()
    XCTAssertEqual(behaviors.current?.name, "rest")
    behaviors.stop()
    XCTAssertEqual(clock.activeCount, 0)
    behaviors.dispose()
    XCTAssertFalse(group.disposed)
    XCTAssertFalse(value.disposed)
  }
  @MainActor func testSeekDoesNotFireEffectsAndRearmsOnlyLaterCues() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    var events: [String] = []
    var resources = 0
    let timeline = try JoltTimeline(
      tracks: [
        .init(value, to: 100, at: 200, transition: .tween(milliseconds: 800, ease: .linear))
      ],
      cues: [
        .init("first", at: 300) { name in
          events.append(name)
          resources += 1
          return JoltEffect { resources -= 1 }
        },
        .init("second", at: 800) { name in
          events.append(name)
          return nil
        },
      ], clock: clock, cueLatePolicy: .catchUp)
    try timeline.seek(to: 0.6)
    XCTAssertEqual(value.value, 50, accuracy: 0.001)
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertEqual(events, [])
    timeline.play()
    try clock.advance(by: 250)
    XCTAssertEqual(events, ["second"])
    try timeline.seek(to: 0.1)
    XCTAssertEqual(value.value, 0)
    XCTAssertEqual(events, ["second"])
    timeline.play()
    try clock.advance(by: 250)
    XCTAssertEqual(events, ["second", "first"])
    XCTAssertEqual(resources, 1)
    try timeline.seek(to: 1)
    XCTAssertEqual(resources, 0)
    XCTAssertEqual(value.value, 100)
    XCTAssertEqual(clock.activeCount, 0)
    timeline.play()
    XCTAssertEqual(timeline.state, .completed)
    try timeline.seek(to: 0)
    timeline.play()
    try clock.advance(by: 1000)
    XCTAssertEqual(events, ["second", "first", "first", "second"])
    timeline.cancel()
    XCTAssertThrowsError(try timeline.seek(to: 0))
  }
  @MainActor func testDecayBoundsPauseAndDragInterruption() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    try value.decay(velocity: 400, bounds: -100...100)
    try clock.advance(by: 100)
    let previous = value.value
    value.pause()
    try clock.advance(by: 500)
    XCTAssertEqual(value.value, previous)
    XCTAssertThrowsError(try value.decay(velocity: 400, friction: 1))
    value.play()
    try clock.advance(by: 5000)
    XCTAssertEqual(value.value, 100)
    XCTAssertEqual(clock.activeCount, 0)
    let drag = try JoltDragModel(
      bounds: .init(x: -100...100, y: 0...0), release: .inertia(), clock: clock)
    drag.begin()
    drag.update(translation: .init(width: 20, height: 0))
    drag.end(velocity: .init(width: 500, height: 0))
    try clock.advance(by: 100)
    XCTAssertGreaterThan(drag.position.x, 20)
    drag.begin()
    let origin = drag.position.x
    drag.update(translation: .init(width: -10, height: 0))
    XCTAssertEqual(drag.position.x, origin - 10, accuracy: 0.001)
    drag.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testDrawingLifetimeAndTextValidation() async throws {
    let shape = try JoltVectorShape(
      .ellipse(x: 0, y: 0, width: 80, height: 80), stroke: .init(argb: 0xff00_ff00))
    let scope = JoltScope()
    let drawing = try scope.retain(JoltDrawing([shape]))
    scope.pause()
    scope.suspend()
    XCTAssertEqual(drawing.shapes.count, 1)
    XCTAssertThrowsError(try drawing.update(Array(repeating: shape, count: 1025)))
    XCTAssertEqual(drawing.shapes.count, 1)
    scope.dispose()
    XCTAssertEqual(drawing.shapes.count, 0)
    XCTAssertThrowsError(try drawing.update([shape]))
    XCTAssertThrowsError(try JoltTextPaint(colors: [.init(argb: 0)]))
    XCTAssertThrowsError(
      try JoltTextPaint(colors: [.init(argb: 0), .init(argb: 0)], stops: [1, 0]))
    XCTAssertThrowsError(try JoltTextPaint(colors: [.init(argb: 0), .init(argb: 0)], width: 0))
  }
  @MainActor func testViewportThresholdOnceReplayAndRemoval() async throws {
    let clock = JoltClock.testClock()
    let entry = try JoltViewportEntry(threshold: 0.5, once: false, clock: clock)
    entry.update(visibleFraction: 0.49)
    XCTAssertEqual(entry.entries, 0)
    XCTAssertEqual(clock.activeCount, 0)
    entry.update(visibleFraction: 0.6)
    XCTAssertEqual(entry.entries, 1)
    try clock.advance(by: 11000)
    XCTAssertEqual(entry.progress.value, 1)
    entry.update(visibleFraction: 0)
    XCTAssertEqual(entry.progress.value, 0)
    entry.update(visibleFraction: 0.6)
    XCTAssertEqual(entry.entries, 2)
    entry.detach()
    XCTAssertEqual(clock.activeCount, 0)
    let once = try JoltViewportEntry(clock: clock)
    once.update(visibleFraction: 1)
    once.detach()
    once.resume()
    once.update(visibleFraction: 1)
    XCTAssertEqual(once.entries, 1)
    XCTAssertEqual(once.progress.value, 1)
    XCTAssertEqual(clock.activeCount, 0)
    entry.dispose()
    entry.update(visibleFraction: 1)
    XCTAssertEqual(entry.entries, 2)
  }
  @MainActor func testRenderDemandScopesBorrowingFinalRedrawAndNoIdleClock() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    var changes: [Bool] = []
    var frames = 0
    let adapter = JoltRenderAdapter(change: { changes.append($0) }, redraw: { frames += 1 })
    let activity = try JoltRenderActivity(adapter)
    let child = try activity.scope()
    XCTAssertThrowsError(try JoltRenderActivity(adapter))
    let observation = try child.track(value)
    let hold = try activity.hold()
    XCTAssertEqual(changes, [true])
    hold.dispose()
    XCTAssertEqual(changes, [true, false])
    XCTAssertEqual(clock.activeCount, 0)
    try value.animate(to: 100)
    XCTAssertTrue(activity.active)
    activity.pause()
    activity.suspend()
    activity.resume()
    XCTAssertFalse(activity.active)
    activity.play()
    XCTAssertTrue(activity.active)
    try clock.advance(by: 11000)
    XCTAssertFalse(activity.active)
    XCTAssertGreaterThan(frames, 0)
    XCTAssertEqual(clock.activeCount, 0)
    try value.animate(to: 0)
    observation.dispose()
    XCTAssertFalse(activity.active)
    XCTAssertEqual(clock.activeCount, 1)
    activity.dispose()
    XCTAssertTrue(child.disposed)
    XCTAssertFalse(value.disposed)
    value.cancel()
    let next = try JoltRenderActivity(adapter)
    next.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
}
