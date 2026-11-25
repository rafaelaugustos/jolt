import JoltSwiftUI
import SwiftUI
import XCTest

final class ListTransferTests: XCTestCase {
  @MainActor func testMeasuredInsertionRequestAndStaleRevisions() throws {
    var keys = ["one", "two"]
    var revision = 0
    var changeDuringAcceptance = false
    var moves: [JoltListTransferMove] = []
    let zones = try JoltDropZones.listTransfer(
      key: "card", destination: "list", sourceKeys: { ["card"] }, targetKeys: { keys },
      centers: { [("one", 20), ("two", 80)] }, revision: { revision },
      accept: { _ in
        if changeDuringAcceptance { revision += 1 }
        return true
      }, commit: { moves.append($0) })
    zones.sourceBounds(CGRect(x: 0, y: 0, width: 20, height: 20))
    try zones.targetBounds("list", CGRect(x: 50, y: 0, width: 100, height: 120))
    zones.begin()
    zones.move(CGSize(width: 70, height: 40))
    XCTAssertTrue(zones.end(reducedMotion: true))
    XCTAssertFalse(zones.end(reducedMotion: true))
    XCTAssertEqual(moves.map(\.beforeKey), ["two"])
    keys = []
    XCTAssertTrue(try zones.request("list", reducedMotion: true))
    XCTAssertEqual(moves.last?.toIndex, 0)
    changeDuringAcceptance = true
    XCTAssertFalse(try zones.request("list", reducedMotion: true))
    keys = ["card"]
    XCTAssertFalse(try zones.request("list", reducedMotion: true))
    zones.dispose()
    XCTAssertFalse(try zones.request("list"))
    XCTAssertEqual(moves.count, 2)
  }
}
