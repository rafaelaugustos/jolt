import Combine
import JoltCore
import XCTest

@testable import JoltSwiftUI

final class PanelGeometryTests: XCTestCase {
  @MainActor func testExplicitSpringVelocityAndInvalidReplacementPreserveOwnership() async throws {
    let clock = JoltClock.testClock()
    let value = try JoltMotionValue(0, clock: clock)
    try value.animate(to: 100, transition: .spring(.snappy), velocity: 220)
    XCTAssertThrowsError(try value.animate(to: 0, velocity: .infinity))
    try clock.advance(by: 10)
    let expected = try JoltScalarMotion(
      from: 0, to: 100, velocity: 220, transition: .spring(.snappy)
    ).sample(at: 10)
    XCTAssertEqual(value.value, expected.position, accuracy: 1e-8)
    XCTAssertEqual(value.velocity, expected.velocity, accuracy: 1e-8)
    XCTAssertEqual(clock.activeCount, 1)
    value.dispose()
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testSheetPendingOpenPauseInterruptionAndReducedMotion() async throws {
    let clock = JoltClock.testClock()
    let sheet = try JoltSheetModel(snaps: [.points(180), .fraction(0.8), .content], clock: clock)
    try sheet.open(.fraction(0.8))
    XCTAssertEqual(clock.activeCount, 0)
    try sheet.updateLayout(height: 600, contentHeight: 320)
    XCTAssertTrue(sheet.isOpen)
    XCTAssertEqual(clock.activeCount, 1)
    try clock.advance(by: 80)
    sheet.pause()
    let frozen = sheet.position
    sheet.suspend()
    sheet.resume()
    try clock.advance(by: 1000)
    XCTAssertEqual(sheet.position, frozen)
    XCTAssertFalse(sheet.beginDrag())
    sheet.play()
    try clock.advance(by: 30)
    XCTAssertTrue(sheet.beginDrag())
    let start = sheet.position
    sheet.drag(by: 40)
    XCTAssertEqual(sheet.position, start + 40, accuracy: 1e-6)
    XCTAssertEqual(clock.activeCount, 0)
    sheet.endDrag(velocity: -1200)
    XCTAssertEqual(sheet.snapPoint, .fraction(0.8))
    sheet.setReducedMotion(true)
    XCTAssertEqual(sheet.position, 120, accuracy: 1e-6)
    XCTAssertEqual(clock.activeCount, 0)
    sheet.dismiss()
    XCTAssertFalse(sheet.isOpen)
    XCTAssertEqual(sheet.position, 600)
    sheet.dispose()
    XCTAssertThrowsError(try sheet.open())
  }
  @MainActor func testSheetKeyboardRemeasureAndInvalidLayoutKeepTheLogicalStop() async throws {
    let clock = JoltClock.testClock()
    let sheet = try JoltSheetModel(snaps: [.fraction(0.5), .content], clock: clock)
    sheet.setReducedMotion(true)
    try sheet.updateLayout(height: 800, contentHeight: 400, safeTop: 20, safeBottom: 30)
    try sheet.open(.fraction(0.5))
    XCTAssertEqual(sheet.visibleHeight, 375)
    try sheet.updateLayout(
      height: 800, contentHeight: 400, safeTop: 20, safeBottom: 30, keyboardOverlap: 300)
    XCTAssertEqual(sheet.visibleHeight, 240)
    XCTAssertEqual(sheet.geometry?.bottomExtension, 0)
    XCTAssertEqual(sheet.snapPoint, .fraction(0.5))
    let old = sheet.geometry
    XCTAssertThrowsError(try sheet.updateLayout(height: .nan, contentHeight: 400))
    XCTAssertEqual(sheet.geometry, old)
    XCTAssertThrowsError(try sheet.snapTo(.points(50)))
    XCTAssertEqual(sheet.snapPoint, .fraction(0.5))
    sheet.beginDrag()
    sheet.drag(by: 20)
    try sheet.updateLayout(height: 500, contentHeight: 400, safeTop: 20, safeBottom: 30)
    XCTAssertFalse(sheet.dragging)
    XCTAssertEqual(sheet.visibleHeight, 225)
    XCTAssertEqual(clock.activeCount, 0)
  }
  @MainActor func testSheetSingleStopDismissibilityAndCallbackReplacement() async throws {
    let clock = JoltClock.testClock()
    let fixed = try JoltSheetModel(snaps: [.points(150)], dismissible: false, clock: clock)
    fixed.setReducedMotion(true)
    try fixed.updateLayout(height: 600, contentHeight: 300)
    try fixed.open()
    XCTAssertFalse(fixed.canExpand)
    XCTAssertFalse(fixed.canCollapse)
    fixed.beginDrag()
    fixed.drag(by: 300)
    fixed.endDrag(velocity: 4000)
    XCTAssertTrue(fixed.isOpen)
    XCTAssertEqual(fixed.visibleHeight, 150)
    fixed.dismiss()
    XCTAssertTrue(fixed.isOpen)
    var sheet: JoltSheetModel!
    sheet = try JoltSheetModel(snaps: [.points(150)], clock: clock) { point in
      if point != nil { sheet.dismiss() }
    }
    try sheet.updateLayout(height: 600, contentHeight: 300)
    try sheet.open()
    XCTAssertFalse(sheet.isOpen)
    try clock.advance(by: 2000)
    XCTAssertEqual(sheet.visibleHeight, 0)
    XCTAssertEqual(clock.activeCount, 0)
    fixed.dispose()
    sheet.dispose()
  }
  @MainActor func testSheetObserverDisposalDoesNotRestartWork() async throws {
    let clock = JoltClock.testClock()
    let scope = JoltScope()
    let sheet = try scope.retain(JoltSheetModel(snaps: [.points(150)], clock: clock))
    try sheet.updateLayout(height: 600, contentHeight: 300)
    let observation = sheet.objectWillChange.sink { if sheet.isOpen { scope.dispose() } }
    try sheet.open()
    XCTAssertTrue(sheet.disposed)
    XCTAssertFalse(sheet.isOpen)
    XCTAssertEqual(clock.activeCount, 0)
    observation.cancel()
  }
  @MainActor func testMeasuredRowsUseGrabOffsetAndResizeCancelsWithoutCommit() async throws {
    let clock = JoltClock.testClock()
    var moves: [JoltReorderMove] = []
    let model = try JoltReorderModel(["a", "b", "c"], measuresRows: true, clock: clock) {
      moves.append($0)
    }
    try model.updateMeasurements(["a": 44, "b": 180, "c": 70])
    model.begin("b", pointerY: 72)
    model.move(viewportY: 72, scrollOffset: 0, viewportHeight: 300)
    XCTAssertEqual(model.preview, ["a", "b", "c"])
    model.move(viewportY: 240, scrollOffset: 0, viewportHeight: 300)
    XCTAssertEqual(model.preview, ["a", "c", "b"])
    XCTAssertEqual(model.keys, ["a", "b", "c"])
    XCTAssertEqual(model.end()?.toIndex, 2)
    XCTAssertEqual(moves.count, 1)
    model.edgeScroll = { _ in true }
    model.begin("a", pointerY: 20)
    model.move(viewportY: 299, scrollOffset: 0, viewportHeight: 300)
    XCTAssertEqual(clock.activeCount, 1)
    XCTAssertThrowsError(try model.updateMeasurements(["c": .nan]))
    XCTAssertEqual(model.active, "a")
    try model.updateMeasurements(["c": 200])
    XCTAssertNil(model.active)
    XCTAssertEqual(clock.activeCount, 0)
    XCTAssertNil(model.end())
    XCTAssertEqual(moves.count, 1)
    XCTAssertEqual(model.keys, ["a", "c", "b"])
    model.dispose()
  }
  @MainActor func testMeasuredReplacementPrunesGeometryAndKeepsFixedContract() async throws {
    let model = try JoltReorderModel(["a", "b", "c"], measuresRows: true)
    try model.updateMeasurements(["a": 44, "b": 180, "c": 70])
    XCTAssertEqual(model.index(at: 240), 2)
    try model.replace(["c", "d"])
    XCTAssertEqual(model.height(for: "c"), 70)
    XCTAssertEqual(model.height(for: "d"), 64)
    XCTAssertThrowsError(try model.updateMeasurements(["b": 200]))
    model.pause()
    model.suspend()
    model.resume()
    model.begin("c")
    XCTAssertNil(model.active)
    model.play()
    XCTAssertNotNil(model.move("c", to: 1))
    let fixed = try JoltReorderModel(["a", "b"], rowHeight: 50)
    try fixed.updateMeasurements(["a": 100])
    XCTAssertEqual(fixed.height(for: "a"), 50)
    model.dispose()
    fixed.dispose()
  }
}
