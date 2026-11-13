import XCTest
@testable import JoltSwiftUI

final class ScrollControllerTests: XCTestCase {
  @MainActor func testJoltAnimationUserInterruptionReducedMotionAndScopeCleanup() throws {
    let clock=JoltClock.testClock(), controller=try JoltScrollController(clock: clock), owner=NSObject()
    var offset=0.0
    controller.attach(owner: owner, read: { (offset,1000) }, write: { offset=$0 }, layout: {})
    try controller.scrollTo(500, transition: .tween(milliseconds: 1000, ease: .linear))
    try clock.advance(by: 250)
    XCTAssertEqual(offset,125,accuracy: 0.001)
    controller.cancel()
    try clock.advance(by: 1000)
    XCTAssertEqual(offset,125,accuracy: 0.001)
    XCTAssertEqual(clock.activeCount,0)
    controller.appReducedMotion=true
    try controller.scrollToTop()
    XCTAssertEqual(offset,0)
    XCTAssertEqual(clock.activeCount,0)
    controller.appReducedMotion=false
    try controller.scrollTo(500)
    controller.suspend()
    XCTAssertEqual(clock.activeCount,0)
    controller.resume()
    XCTAssertEqual(clock.activeCount,1)
    let scope=JoltScope(); try scope.retain(controller); scope.dispose()
    XCTAssertFalse(controller.connected)
    XCTAssertEqual(clock.activeCount,0)
  }
  @MainActor func testStableAnchorAfterPrependAndUserCancellation() async throws {
    let controller=try JoltScrollController(clock: .testClock()), owner=NSObject()
    var offset=200.0
    controller.attach(owner: owner, read: { (offset,1000) }, write: { offset=$0 }, layout: {})
    controller.updateAnchors(["a":CGRect(x:0,y:200,width:100,height:40),"b":CGRect(x:0,y:240,width:100,height:60)])
    let restored=await controller.preserveAnchor {
      controller.updateAnchors(["new":CGRect(x:0,y:200,width:100,height:50),"a":CGRect(x:0,y:250,width:100,height:40),"b":CGRect(x:0,y:290,width:100,height:60)])
    }
    XCTAssertTrue(restored); XCTAssertEqual(offset,250)
    let cancelled=await controller.preserveAnchor { controller.cancel(); offset=300 }
    XCTAssertFalse(cancelled); XCTAssertEqual(offset,300)
    controller.dispose()
  }
  @MainActor func testHeaderGeometryRemeasureAndBorrowedAttachment() async throws {
    let geometry=try JoltScrollHeaderGeometry(expanded:280,minimum:60,section:40,parallax:48)
    let header=try JoltScrollHeaderController(geometry: geometry,clock:.testClock()), owner=NSObject()
    var offset=300.0
    header.scroll.attach(owner:owner,read:{(offset,2000)},write:{offset=$0},layout:{})
    XCTAssertEqual(header.collapse.progress,1)
    let larger=try JoltScrollHeaderGeometry(expanded:320,minimum:60,section:50,parallax:48)
    try await header.remeasure(larger)
    XCTAssertEqual(offset,340)
    header.scroll.detach(owner:NSObject())
    XCTAssertTrue(header.scroll.connected)
    header.scroll.detach(owner:owner)
    XCTAssertFalse(header.scroll.connected)
    XCTAssertFalse(try header.scrollToTop())
    header.dispose()
    XCTAssertTrue(header.title.disposed)
  }
}
