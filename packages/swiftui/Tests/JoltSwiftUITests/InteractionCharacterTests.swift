import Combine
import XCTest

@testable import JoltSwiftUI

final class InteractionCharacterTests: XCTestCase {
  @MainActor func testKeyframeSegmentsRepeatReverseAndExactBoundaries() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(99, clock: clock)
    let frames = try [JoltKeyframe(0, at: 0), .init(30, at: 0.3), .init(100, at: 1)]
    let timeline = try JoltTimeline.keyframes(
      [.init(value, frames)], duration: 1000, iterations: 2, autoreverses: true, clock: clock)
    XCTAssertEqual(value.value, 0)
    try clock.advance(by: 300)
    XCTAssertEqual(value.value, 30, accuracy: 0.0001)
    try clock.advance(by: 700)
    XCTAssertEqual(value.value, 100, accuracy: 0.0001)
    try clock.advance(by: 350)
    XCTAssertEqual(value.value, 65, accuracy: 0.0001)
    timeline.pause()
    try clock.advance(by: 300)
    XCTAssertEqual(value.value, 65, accuracy: 0.0001)
    timeline.play()
    try clock.advance(by: 650)
    XCTAssertEqual(value.value, 0)
    XCTAssertEqual(timeline.state, .completed)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testFractionalStopsSeekAndInvalidKeyframesDoNotStealLease() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    let frames = try (0...30).map { try JoltKeyframe(Double($0), at: Double($0) / 30) }
    let timeline = try JoltTimeline.keyframes(
      [.init(value, frames)], duration: 777, iterations: 5, clock: clock)
    try timeline.seek(to: 0.5)
    XCTAssertEqual(value.value, 15, accuracy: 0.001)
    timeline.play()
    XCTAssertThrowsError(
      try JoltTimeline.keyframes(
        [.init(value, Array(frames.dropFirst()))], duration: 100, clock: clock))
    let other = JoltClock.testClock()
    XCTAssertThrowsError(
      try JoltTimeline.keyframes([.init(value, frames)], duration: 100, clock: other))
    XCTAssertEqual(timeline.state, .running)
    XCTAssertEqual(clock.activeCount, 1)
    try clock.advance(by: 10_000)
    XCTAssertEqual(value.value, 30)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testReducedKeyframesSettleAndScalarReplacementCancelsWholeSequence() async throws
  {
    let clock = JoltClock.testClock()
    let a = try JoltMotionValue(0, clock: clock)
    let b = try JoltMotionValue(0, clock: clock)
    let frames = try [JoltKeyframe(0, at: 0), .init(100, at: 1)]
    let reduced = try JoltTimeline.keyframes(
      [.init(a, frames)], duration: 1000, iterations: 2, autoreverses: true, clock: clock,
      reducedMotion: true)
    XCTAssertEqual(reduced.state, .completed)
    XCTAssertEqual(a.value, 0)
    XCTAssertEqual(clock.activeCount, 0)
    let timeline = try JoltTimeline.keyframes(
      [.init(a, frames), .init(b, frames)], duration: 1000, clock: clock)
    try clock.advance(by: 100)
    try a.set(7)
    try clock.advance(by: 30)
    XCTAssertEqual(timeline.state, .cancelled)
    XCTAssertEqual(a.value, 7)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testGestureFocalTransformBoundsAndContactHandoff() async throws {
    let clock = JoltClock.testClock()
    let model = try JoltGestureModel(bounds: .init(x: -200...200, y: -200...200), clock: clock)
    XCTAssertTrue(model.begin(.pinch))
    XCTAssertTrue(model.begin(.rotation))
    try model.change(magnification: 2, rotation: 90, around: .init(x: 30, y: 0))
    XCTAssertEqual(model.position.x, 30, accuracy: 0.0001)
    XCTAssertEqual(model.position.y, -60, accuracy: 0.0001)
    model.end(.pinch)
    XCTAssertEqual(model.contacts, [.rotation])
    try model.change(pan: .init(width: 1000, height: 1000), magnification: 10)
    XCTAssertEqual(model.position.x, 200)
    XCTAssertEqual(model.position.y, 200)
    XCTAssertEqual(model.position.scale, 3)
    XCTAssertEqual(clock.activeCount, 0)
    try model.settle(to: .init())
    try clock.advance(by: 100)
    model.begin(.pan)
    let interrupted = model.position
    try clock.advance(by: 1000)
    XCTAssertEqual(model.position, interrupted)
    model.pause()
    model.suspend()
    model.resume()
    XCTAssertFalse(model.begin(.pan))
    model.play()
    XCTAssertTrue(model.begin(.pan))
    model.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testReorderPreviewStableCommitAndReplacementCancelEdgeWork() async throws {
    let clock = JoltClock.testClock()
    var moves: [JoltReorderMove] = []
    let model = try JoltReorderModel(
      ["a", "b", "c", "d"], rowHeight: 50, spacing: 0, clock: clock, onMove: { moves.append($0) })
    var scrolls = 0
    model.edgeScroll = { _ in
      scrolls += 1
      return true
    }
    model.begin("a")
    model.move(viewportY: 98, scrollOffset: 50, viewportHeight: 100)
    XCTAssertEqual(model.keys, ["a", "b", "c", "d"])
    XCTAssertEqual(model.preview, ["b", "c", "a", "d"])
    try clock.advance(by: 150)
    XCTAssertEqual(scrolls, 1)
    XCTAssertEqual(clock.activeCount, 1)
    let result = model.end()
    XCTAssertEqual(result?.beforeKey, "d")
    XCTAssertEqual(model.keys, ["b", "c", "a", "d"])
    XCTAssertEqual(moves.count, 1)
    XCTAssertEqual(clock.activeCount, 0)
    model.begin("b")
    model.move(viewportY: 99, scrollOffset: 0, viewportHeight: 100)
    XCTAssertThrowsError(try model.replace(["x", "x"]))
    XCTAssertEqual(model.active, "b")
    try model.replace(["c", "d"])
    XCTAssertNil(model.active)
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertNil(model.move("c", to: 99))
    XCTAssertEqual(model.keys, ["c", "d"])
    model.pause()
    model.suspend()
    model.resume()
    XCTAssertNil(model.move("c", to: 1))
    model.play()
    XCTAssertEqual(model.move("c", to: 1)?.beforeKey, nil)
    XCTAssertEqual(model.keys, ["d", "c"])
    model.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testReorderStopsClockWhenScrollBoundaryReached() async throws {
    let clock = JoltClock.testClock()
    let model = try JoltReorderModel(["a", "b"], clock: clock)
    model.edgeScroll = { _ in false }
    model.begin("a")
    model.move(viewportY: 99, scrollOffset: 0, viewportHeight: 100)
    XCTAssertEqual(clock.activeCount, 1)
    try clock.advance(by: 150)
    XCTAssertEqual(clock.activeCount, 0)
    model.cancel()
    XCTAssertEqual(model.keys, ["a", "b"])
  }
  @MainActor func testDropPriorityRejectionReturnAndOwnedEffects() async throws {
    let clock = JoltClock.testClock()
    var dropped: [String] = []
    var rejects = 0
    var effects = 0
    let model = try JoltDropZones(
      [.init("back"), .init("front", priority: 10, accepts: { false })], clock: clock,
      onReject: { _ in rejects += 1 },
      onDrop: { event in
        dropped.append(event.id)
        effects += 1
        return JoltEffect { effects -= 1 }
      })
    model.sourceBounds(.init(x: 0, y: 0, width: 20, height: 20))
    try model.targetBounds("back", .init(x: 90, y: 0, width: 40, height: 40))
    try model.targetBounds("front", .init(x: 90, y: 0, width: 40, height: 40))
    model.begin()
    model.move(.init(width: 100, height: 0))
    XCTAssertEqual(model.hovered, "front")
    XCTAssertFalse(model.end())
    XCTAssertEqual(rejects, 1)
    XCTAssertTrue(dropped.isEmpty)
    try clock.advance(by: 10_000)
    XCTAssertEqual(model.offset.width, 0)
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertTrue(try model.request("back"))
    XCTAssertEqual(effects, 1)
    XCTAssertEqual(model.accepted, "back")
    try model.targetBounds("back", nil)
    XCTAssertEqual(effects, 0)
    XCTAssertNil(model.accepted)
    model.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testDropPaddingHandlesAndReanchoring() async throws {
    let clock = JoltClock.testClock()
    var rejects = 0
    let model = try JoltDropZones(
      [.init("column", padding: try .init(bottom: 25))], clock: clock,
      onReject: { _ in rejects += 1 })
    XCTAssertThrowsError(try JoltDropPadding(bottom: -1))
    XCTAssertEqual(model.targets[0].padding.bottom, 25)
    model.layoutBounds(.init(x: 0, y: 100, width: 20, height: 20))
    try model.targetBounds("column", .init(x: 100, y: 0, width: 40, height: 60))
    model.begin()
    model.move(.init(width: 110, height: -10))
    XCTAssertNil(model.hovered)
    model.move(.init(width: 110, height: -30))
    XCTAssertEqual(model.hovered, "column")
    model.layoutBounds(.init(x: 0, y: 150, width: 20, height: 20))
    XCTAssertEqual(model.offset, .init(width: 110, height: -80))
    XCTAssertEqual(model.hovered, "column")
    model.move(.init(width: 110, height: -20))
    XCTAssertEqual(model.offset.height, -70)
    XCTAssertNil(model.hovered)
    model.sourceBounds(.init(x: 110, y: 50, width: 20, height: 20))
    XCTAssertEqual(model.offset.height, -40)
    model.sourceBounds(.init(x: 110, y: 80, width: 20, height: 20))
    XCTAssertEqual(model.offset.height, -40)
    XCTAssertFalse(model.end(reducedMotion: true))
    XCTAssertEqual(rejects, 1)
    XCTAssertEqual(model.offset, .zero)
    XCTAssertEqual(clock.activeCount, 0)
    model.layoutBounds(.init(x: 0, y: 10, width: 20, height: 20))
    XCTAssertEqual(model.offset, .zero)
    let old = UUID(), replacement = UUID()
    model.present(old, true)
    model.layoutBounds(.init(x: 0, y: 10, width: 20, height: 20), reporter: old)
    model.present(replacement, true)
    model.layoutBounds(.init(x: 200, y: 10, width: 20, height: 20), reporter: replacement)
    model.layoutBounds(nil, reporter: old)
    model.present(old, false)
    model.begin()
    XCTAssertTrue(model.dragging)
    model.move(.init(width: -90, height: 10))
    XCTAssertEqual(model.hovered, "column")
    model.cancel()
    model.present(replacement, false)
    model.begin()
    XCTAssertFalse(model.dragging)
    model.present(replacement, true)
    model.attachHandle()
    model.attachHandle()
    XCTAssertEqual(model.handles, 2)
    model.detachHandle()
    model.detachHandle()
    model.detachHandle()
    XCTAssertEqual(model.handles, 0)
    model.dispose()
  }
  @MainActor func testDropCallbacksCannotResurrectDisposedOrOverwriteReplacement() async throws {
    let clock = JoltClock.testClock()
    var model: JoltDropZones!
    var disposed = 0
    model = try JoltDropZones(
      [.init("a"), .init("b")], clock: clock,
      onDrop: { event in
        if event.id == "a" { return JoltEffect { _ = try? model.request("b") } }
        return JoltEffect { disposed += 1 }
      })
    model.sourceBounds(.init(x: 0, y: 0, width: 10, height: 10))
    for id in ["a", "b"] { try model.targetBounds(id, .init(x: 0, y: 0, width: 10, height: 10)) }
    XCTAssertTrue(try model.request("a"))
    model.begin()
    XCTAssertEqual(model.accepted, "b")
    XCTAssertFalse(model.dragging)
    model.dispose()
    XCTAssertEqual(disposed, 1)
    XCTAssertEqual(clock.activeCount, 0)
    var target: JoltDropZones!
    target = try JoltDropZones(
      [
        .init(
          "a",
          accepts: {
            target.dispose()
            return true
          })
      ], clock: clock,
      onDrop: { _ in
        XCTFail("disposed drop fired")
        return nil
      })
    target.sourceBounds(.init(x: 0, y: 0, width: 10, height: 10))
    try target.targetBounds("a", .init(x: 0, y: 0, width: 10, height: 10))
    XCTAssertFalse(try target.request("a"))
    XCTAssertTrue(target.disposed)
  }
  @MainActor func testParticlesIdleFinitePauseResizeAndReducedMotion() async throws {
    let clock = JoltClock.testClock()
    let particles = JoltParticles(
      try .init(lifetime: 1000, velocity: 0, spread: 0, capacity: 10), clock: clock)
    particles.resume()
    particles.play()
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertEqual(particles.state, .idle)
    try particles.resize(width: 200, height: 100)
    try particles.burst(count: 4)
    XCTAssertEqual(particles.particles.count, 4)
    XCTAssertEqual(particles.particles[0].x, 100)
    try clock.advance(by: 200)
    particles.pause()
    let elapsed = particles.elapsed
    particles.suspend()
    particles.resume()
    try clock.advance(by: 200)
    XCTAssertEqual(particles.elapsed, elapsed)
    XCTAssertEqual(clock.activeCount, 0)
    try particles.resize(width: 400, height: 100)
    particles.play()
    try clock.advance(by: 100)
    XCTAssertEqual(particles.particles[0].x, 100)
    XCTAssertThrowsError(try particles.burst(count: 11))
    XCTAssertEqual(particles.state, .running)
    try clock.advance(by: 1000)
    XCTAssertTrue(particles.particles.isEmpty)
    XCTAssertEqual(clock.activeCount, 0)
    try particles.burst(count: 4, reducedMotion: true)
    XCTAssertEqual(particles.state, .completed)
    XCTAssertEqual(clock.activeCount, 0)
    particles.reduceMotion(true)
    try particles.burst(count: 4)
    XCTAssertEqual(clock.activeCount, 0)
    particles.reduceMotion(false)
    particles.resume()
    XCTAssertEqual(clock.activeCount, 0)
    try particles.burst(count: 4)
    XCTAssertEqual(clock.activeCount, 1)
    particles.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testEmissionSkipsBacklogAndReentrantCancellationLeavesNoClock() async throws {
    let clock = JoltClock.testClock()
    let model = JoltParticles(try .init(lifetime: 500, capacity: 10), clock: clock)
    try model.emit(rate: 20, duration: 10_000)
    try clock.advance(by: 9_000)
    XCTAssertEqual(model.particles.count, 10)
    XCTAssertGreaterThan(model.particles.first!.id, 160)
    XCTAssertThrowsError(try model.emit(rate: 21))
    XCTAssertEqual(model.state, .running)
    var once = false
    let observer = model.objectWillChange.sink {
      if !once {
        once = true
        model.cancel()
      }
    }
    try clock.advance(by: 100)
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertEqual(model.state, .cancelled)
    withExtendedLifetime(observer) {}
  }
  @MainActor func testRigBlendingSocketLimitsInterruptionAndScopeDisposal() async throws {
    let definition = try JoltRigDefinition(
      parts: [
        "body": .init(width: 100, height: 100, rest: .init([.x: 10, .y: 20])),
        "arm": .init(
          parent: "body", width: 40, height: 10, pivotX: 0, pivotY: 0,
          rest: .init([.x: 100, .y: 20]), rotation: 0...90),
      ], poses: ["wave": ["arm": .init([.rotate: 180])], "rest": [:]],
      sockets: ["hand": .init(part: "arm", x: 1, y: 0, relative: true)])
    let clock = JoltClock.testClock()
    let scope = JoltScope()
    let rig = try scope.retain(JoltRig(definition, clock: clock))
    XCTAssertEqual(try rig.point("hand").x, 150)
    try rig.blend([.init("wave", weight: 0.25)], reducedMotion: true)
    XCTAssertEqual(try rig.snapshot()["arm"]?.value(.rotate), 45)
    try rig.pose("wave")
    try clock.advance(by: 100)
    XCTAssertThrowsError(try rig.pose("missing"))
    XCTAssertEqual(rig.state, .running)
    try clock.advance(by: 10_000)
    XCTAssertEqual(try rig.point("hand").x, 110, accuracy: 0.001)
    XCTAssertEqual(try rig.point("hand").y, 80, accuracy: 0.001)
    try rig.pose("rest")
    rig.pause()
    scope.suspend()
    scope.resume()
    XCTAssertEqual(clock.activeCount, 0)
    rig.play()
    XCTAssertEqual(clock.activeCount, 1)
    scope.dispose()
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertTrue(rig.disposed)
  }
  @MainActor func testRigSampledDomainStaysRenderableDuringSpringOvershoot() async throws {
    let clock = JoltClock.testClock()
    let rig = try JoltRig(
      .init(
        parts: ["a": .init(width: 10, height: 10, rest: .init([.scaleX: 90]))],
        poses: ["large": ["a": .init([.scaleX: 100])]]), clock: clock)
    try rig.pose("large", transition: .spring(.bouncy))
    for _ in 0..<80 {
      try clock.advance(by: 16)
      XCTAssertLessThanOrEqual(try rig.snapshot()["a"]!.value(.scaleX), 100)
      XCTAssertNotNil(try rig.matrices()["a"])
    }
    rig.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testRigCycleInvalidPoseAndShortestAngle() async throws {
    XCTAssertThrowsError(
      try JoltRigDefinition(
        parts: [
          "a": .init(parent: "b", width: 10, height: 10),
          "b": .init(parent: "a", width: 10, height: 10),
        ], poses: [:]))
    let definition = try JoltRigDefinition(
      parts: ["a": .init(width: 10, height: 10, rest: .init([.rotate: 170]))],
      poses: ["turn": ["a": .init([.rotate: -170])]])
    let target = try definition.destination([.init("turn")], current: [:])
    XCTAssertEqual(target["a"]?.value(.rotate), 190)
    XCTAssertThrowsError(try definition.destination([.init("turn", weight: .nan)], current: [:]))
  }
}
