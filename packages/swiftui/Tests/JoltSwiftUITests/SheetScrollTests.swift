import XCTest
import JoltCore
@testable import JoltSwiftUI

final class SheetScrollTests: XCTestCase {
  @MainActor func testOneContactExpandsScrollsReversesAndTransfersVelocity() throws {
    let clock=JoltClock(manual: true)
    clock.testingReducedMotion=false
    let sheet=try JoltSheetModel(snaps: [.points(180),.points(480)],clock: clock)
    try sheet.updateLayout(height: 600,contentHeight: 1200)
    try sheet.open(.points(180)); try clock.advance(by: 3000)
    let input=SheetScrollConnection(sheet)
    var offset=0.0
    input.read={ (offset,900) }; input.write={ offset=$0 }
    XCTAssertTrue(input.begin())
    XCTAssertTrue(input.change(-400))
    XCTAssertEqual(sheet.position,120,accuracy: 0.001)
    XCTAssertEqual(offset,100,accuracy: 0.001)
    XCTAssertTrue(input.change(60))
    XCTAssertEqual(sheet.position,120,accuracy: 0.001)
    XCTAssertEqual(offset,40,accuracy: 0.001)
    XCTAssertTrue(input.change(100))
    XCTAssertEqual(offset,0,accuracy: 0.001)
    XCTAssertEqual(sheet.position,180,accuracy: 0.001)
    input.end(velocity: 800,reduced: false)
    XCTAssertEqual(sheet.snapPoint,.points(180))
    try clock.advance(by: 3000)
    XCTAssertEqual(offset,0)
    input.dispose(); sheet.dispose()
    XCTAssertEqual(clock.activeCount,0)
  }
  @MainActor func testScrollOwnsReleaseAndExternalChangesCancelItsCoast() throws {
    let clock=JoltClock(manual: true)
    clock.testingReducedMotion=false
    let sheet=try JoltSheetModel(snaps: [.points(180),.points(480)],clock: clock)
    try sheet.updateLayout(height: 600,contentHeight: 1200)
    try sheet.open(.points(180)); try clock.advance(by: 3000)
    let input=SheetScrollConnection(sheet)
    var offset=0.0
    input.read={ (offset,900) }; input.write={ offset=$0 }
    XCTAssertTrue(input.begin()); XCTAssertTrue(input.change(-400))
    input.end(velocity: -1200,reduced: false)
    XCTAssertEqual(sheet.snapPoint,.points(480))
    try clock.advance(by: 100)
    XCTAssertGreaterThan(offset,150)
    try sheet.snapTo(.points(180))
    let stopped=offset
    try clock.advance(by: 100)
    XCTAssertEqual(offset,stopped)
    input.dispose(); sheet.dispose()
    XCTAssertEqual(clock.activeCount,0)
  }
  @MainActor func testRemeasureBackgroundAndReducedMotionCannotReviveOldInput() throws {
    let clock=JoltClock(manual: true)
    clock.testingReducedMotion=false
    let sheet=try JoltSheetModel(snaps: [.points(180),.points(480)],clock: clock)
    try sheet.updateLayout(height: 600,contentHeight: 1200)
    try sheet.open(.points(180)); try clock.advance(by: 3000)
    let input=SheetScrollConnection(sheet)
    var offset=0.0
    input.read={ (offset,900) }; input.write={ offset=$0 }
    XCTAssertTrue(input.begin()); XCTAssertTrue(input.change(-400))
    input.end(velocity: -1200,reduced: true)
    try clock.advance(by: 1000)
    XCTAssertEqual(offset,100,accuracy: 0.001)
    XCTAssertTrue(input.begin())
    try sheet.updateLayout(height: 500,contentHeight: 1200)
    XCTAssertFalse(input.change(20))
    XCTAssertFalse(sheet.dragging)
    XCTAssertTrue(input.begin())
    sheet.suspend(); input.synchronize(enabled: false,reduced: false)
    sheet.resume()
    XCTAssertFalse(input.change(-100))
    XCTAssertEqual(offset,100,accuracy: 0.001)
    input.dispose(); sheet.dispose()
    XCTAssertEqual(clock.activeCount,0)
  }
}
