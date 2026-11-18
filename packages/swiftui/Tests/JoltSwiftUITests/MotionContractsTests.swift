import XCTest

@testable import JoltSwiftUI

final class MotionContractsTests: XCTestCase {
  @MainActor func testDrawingMorphReplacementPauseAndInvalidInputPreserveScene() async throws {
    let clock = JoltClock.testClock()
    let a = try JoltSVGPath("M0 0L20 20Z")
    let b = try JoltSVGPath("M20 0L80 20Z")
    let drawing = try JoltDrawing(
      [
        .init(
          .svg(a), stroke: .init(argb: 0xffff_0000),
          strokeStart: 0.2, strokeEnd: 0.8, lineCap: .square, lineJoin: .bevel, fillRule: .evenodd)
      ], clock: clock)
    let linear = try JoltTransition.tween(milliseconds: 1000, ease: .linear)
    func path() -> JoltSVGPath {
      guard case .svg(let path) = drawing.shapes[0].geometry else { fatalError() }
      return path
    }
    try drawing.morphPath(at: 0, to: b, transition: linear)
    try clock.advance(by: 500)
    XCTAssertEqual(path().points, [10, 0, 50, 20])
    XCTAssertEqual(drawing.shapes[0].strokeStart, 0.2)
    XCTAssertThrowsError(try drawing.morphPath(at: 0, to: .init("M0 0Q10 20 30 40Z")))
    XCTAssertEqual(clock.activeCount, 1)
    try drawing.morphPath(at: 0, to: a, transition: linear)
    XCTAssertEqual(path().points, [10, 0, 50, 20])
    drawing.pause()
    drawing.suspend()
    drawing.resume()
    try clock.advance(by: 10_000)
    XCTAssertEqual(path().points, [10, 0, 50, 20])
    XCTAssertEqual(clock.activeCount, 0)
    drawing.play()
    try clock.advance(by: 1000)
    XCTAssertEqual(path(), a)
    XCTAssertEqual(drawing.state, .completed)
    XCTAssertEqual(clock.activeCount, 0)
    try drawing.morphPath(at: 0, to: b, transition: linear)
    drawing.reduceMotion(true)
    XCTAssertEqual(path(), b)
    XCTAssertEqual(clock.activeCount, 0)
    drawing.dispose()
    XCTAssertTrue(drawing.shapes.isEmpty)
    XCTAssertThrowsError(try drawing.morphPath(at: 0, to: a))
  }
  @MainActor func testTimelineInheritsCommandTimeVelocityAndExplicitOverride() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    try value.animate(to: 100)
    try clock.advance(by: 100)
    let position = value.value
    let speed = value.velocity
    XCTAssertGreaterThan(speed, 0)
    let timeline = try JoltTimeline(tracks: [.init(value, to: -50)], clock: clock)
    XCTAssertEqual(value.value, position, accuracy: 1e-9)
    XCTAssertEqual(value.velocity, speed, accuracy: 1e-9)
    XCTAssertEqual(clock.activeCount, 1)
    try clock.advance(by: 20)
    let replacement = try JoltTimeline(tracks: [.init(value, to: 200, velocity: -70)], clock: clock)
    XCTAssertEqual(timeline.state, .cancelled)
    XCTAssertEqual(value.velocity, -70)
    replacement.pause()
    XCTAssertEqual(value.velocity, 0)
    try replacement.seek(to: 0)
    XCTAssertEqual(value.velocity, 0)
    replacement.play()
    XCTAssertEqual(value.velocity, -70)
    replacement.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testExplicitFromFutureStagesAndSequenceHaveDeterministicVelocity() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    try value.animate(to: 100)
    try clock.advance(by: 100)
    let explicit = try JoltTimeline(tracks: [.init(value, to: 50, from: 10)], clock: clock)
    XCTAssertEqual(value.value, 10)
    XCTAssertEqual(value.velocity, 0)
    explicit.dispose()
    try value.animate(to: 100)
    try clock.advance(by: 100)
    let speed = value.velocity
    let sequence = try JoltTimeline.sequence(
      [.init(value, to: 0), .init(value, to: 100, velocity: 25)], clock: clock)
    XCTAssertEqual(value.velocity, speed, accuracy: 1e-9)
    sequence.dispose()
    try value.animate(to: 100)
    try clock.advance(by: 100)
    let future = try JoltTimeline(tracks: [.init(value, to: 0, at: 200)], clock: clock)
    try clock.advance(by: 200)
    XCTAssertEqual(value.velocity, 0)
    future.dispose()
  }
  @MainActor func testInvalidTimelineVelocityPreservesPreviousOwner() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    try value.animate(to: 100)
    XCTAssertThrowsError(
      try JoltTimeline(tracks: [.init(value, to: 20, velocity: .nan)], clock: clock))
    XCTAssertEqual(value.target, 100)
    XCTAssertEqual(clock.activeCount, 1)
    value.dispose()
  }
  @MainActor func testContinuousParticlesSurviveMinuteBoundaryWithBoundedStableBirths() async throws
  {
    let clock = JoltClock.testClock()
    let field = JoltParticles(try .init(lifetime: 3000, capacity: 40), clock: clock)
    try field.emit(rate: 12, duration: nil)
    XCTAssertTrue(field.continuous)
    try clock.advance(by: 59_900)
    let prior = Set(field.particles.map(\.id))
    try clock.advance(by: 200)
    XCTAssertEqual(field.state, .running)
    XCTAssertFalse(prior.intersection(field.particles.map(\.id)).isEmpty)
    XCTAssertLessThanOrEqual(field.particles.count, 36)
    let identities = field.particles.map(\.id)
    field.pause()
    field.suspend()
    field.resume()
    XCTAssertEqual(clock.activeCount, 0)
    try clock.advance(by: 30_000)
    XCTAssertEqual(field.particles.map(\.id), identities)
    field.play()
    try clock.advance(by: 3_600_000)
    XCTAssertEqual(field.state, .running)
    XCTAssertLessThanOrEqual(field.particles.count, 36)
    XCTAssertEqual(clock.activeCount, 1)
    XCTAssertThrowsError(try field.emit(rate: 1000, duration: nil))
    XCTAssertEqual(field.state, .running)
    field.dispose()
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertTrue(field.particles.isEmpty)
  }
  @MainActor func testContinuousParticlesSettleUnderReducedMotionAndRetainFiniteValidation()
    async throws
  {
    let clock = JoltClock.testClock()
    let field = JoltParticles(try .init(lifetime: 3000), clock: clock)
    XCTAssertThrowsError(try field.emit(duration: 58_000))
    XCTAssertThrowsError(try field.emit(duration: .infinity))
    try field.emit(duration: nil)
    clock.testingReducedMotion = true
    try clock.advance(by: 16)
    XCTAssertEqual(field.state, .completed)
    XCTAssertTrue(field.particles.isEmpty)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testCustomEdgeConnectionOwnsOnlyItsViewportAndCancelsStaleCommits() async throws {
    let clock = JoltClock.testClock()
    let model = try JoltReorderModel(["a", "b", "c"], measuresRows: true, clock: clock)
    try model.updateMeasurements(["a": 50, "b": 80, "c": 40])
    var directions: [Int] = []
    let old = try model.connectEdgeScroll {
      directions.append($0)
      return true
    }
    model.begin("a", pointerY: 20)
    model.move(viewportY: 99, scrollOffset: 0, viewportHeight: 100)
    try clock.advance(by: 120)
    XCTAssertEqual(directions, [1])
    let next = try model.connectEdgeScroll {
      directions.append($0)
      return true
    }
    XCTAssertNil(model.end())
    old.dispose()
    model.begin("c", pointerY: 80)
    model.move(viewportY: 0, scrollOffset: 50, viewportHeight: 100)
    try clock.advance(by: 120)
    XCTAssertEqual(directions, [1, -1])
    model.suspend()
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertNil(model.end())
    model.resume()
    model.begin("a")
    model.move(viewportY: 99, scrollOffset: 0, viewportHeight: 100)
    try model.replace(["b", "c"])
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertNil(model.end())
    next.dispose()
    model.dispose()
    XCTAssertThrowsError(try model.connectEdgeScroll { _ in true })
  }
}
