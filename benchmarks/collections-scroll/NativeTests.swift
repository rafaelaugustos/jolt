import UIKit
import XCTest

final class CollectionsScroll: XCTestCase {
  let app = XCUIApplication(bundleIdentifier: "dev.jolt.nativeci")
  let control = URL(fileURLWithPath: "/tmp/jolt-collections-recording-" + (ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "unknown"))
  var serial = 0
  func cue(_ action: String, _ name: String) throws {
    guard FileManager.default.fileExists(atPath: control.path) else { return }
    serial += 1
    try JSONSerialization.data(withJSONObject: ["id": serial, "action": action, "name": name]).write(to: control.appendingPathComponent("request.json"), options: .atomic)
    let end = Date().addingTimeInterval(15)
    while Date() < end {
      if (try? String(contentsOf: control.appendingPathComponent("ack"), encoding: .utf8)) == String(serial) { return }
      Thread.sleep(forTimeInterval: 0.03)
    }
    XCTFail("Capture acknowledgement missing")
  }
  func tap(_ name: String, _ delay: Double = 0.7) {
    let b = app.buttons[name].firstMatch
    XCTAssertTrue(b.waitForExistence(timeout: 5), app.debugDescription)
    XCTAssertNil(JoltNativeTap(CGPoint(x: b.frame.midX, y: b.frame.midY)))
    Thread.sleep(forTimeInterval: delay)
  }
  func element(_ name: String) -> XCUIElement {
    let e = app.descendants(matching: .any).matching(identifier: name).firstMatch
    XCTAssertTrue(e.waitForExistence(timeout: 5), app.debugDescription)
    return e
  }
  func snapshot() throws -> [String: Any] {
    tap("Audit", 0.2)
    let text = element("collection-status").label
    XCTAssertFalse(text.contains("ERROR"), text)
    return try JSONSerialization.jsonObject(with: Data(text.utf8)) as! [String: Any]
  }
  func number(_ value: [String: Any], _ key: String) -> Double { (value[key] as? NSNumber)?.doubleValue ?? -999 }
  func contact(_ start: CGPoint, _ delta: CGPoint, _ reverse: CGPoint = .zero, _ hold: Double = 0.1) {
    XCTAssertNil(JoltScrollContact(start, delta, reverse, hold)); Thread.sleep(forTimeInterval: 0.7)
  }
  func testCollectionLayouts() throws {
    continueAfterFailure = false
    app.launch()
    for scene in ["Carousel","RTL","Grid","Heights","Transfer"] {
      tap(scene, 1)
      let name = "collection-"+scene.lowercased()+"-ios"
      try cue("start",name)
      if scene == "Transfer" {
        let source=element("Atlas").frame, target=element("Elm").frame
        contact(CGPoint(x:source.midX,y:source.midY),CGPoint(x:target.midX-source.midX,y:target.midY-source.midY))
        XCTAssertTrue(element("result").label.contains("Moved Atlas"),app.debugDescription)
        tap("Reject")
        let next=element("Birch").frame
        contact(CGPoint(x:next.midX,y:next.midY),CGPoint(x:target.midX-next.midX,y:target.midY-next.midY))
        XCTAssertTrue(element("Birch").frame.midX < target.midX)
        tap("Reject");tap("Empty")
        contact(CGPoint(x:next.midX,y:next.midY),CGPoint(x:target.midX-next.midX,y:target.midY-next.midY))
        XCTAssertTrue(element("result").label.contains("Moved Birch"),app.debugDescription)
      } else {
        if scene != "Heights" {
          let source=element(scene=="RTL" ? "Card 62" : "Card 01").frame, target=element(scene=="RTL" ? "Card 64" : scene=="Grid" ? "Card 04" : "Card 03").frame
          contact(CGPoint(x:source.midX,y:source.midY),CGPoint(x:target.midX-source.midX,y:target.midY-source.midY),.zero,0.6)
          XCTAssertTrue(element("result").label.contains("Moved Card"),app.debugDescription)
          let viewport=element("cards").frame, start=CGPoint(x:source.midX,y:source.midY)
          let end=scene=="Grid" ? CGPoint(x:target.midX,y:viewport.maxY-3) : CGPoint(x:viewport.maxX-3,y:source.midY)
          let reverse=scene=="Grid" ? CGPoint(x:target.midX,y:viewport.minY+3) : CGPoint(x:viewport.minX+3,y:source.midY)
          XCTAssertNil(JoltReorderContact(start,end,reverse,1.2,0.8))
          Thread.sleep(forTimeInterval:0.4)
          let cancel=app.buttons["Cancel"].firstMatch.frame
          XCTAssertNil(JoltNativeTap(CGPoint(x:cancel.midX,y:cancel.midY)))
          XCTAssertNil(JoltReorderContact(start,end,.zero,0.6,0))
          XCTAssertTrue(element("result").label.contains("cancelled"),app.debugDescription)
        }
        tap("Jump");tap("Audit");tap("Insert");tap("Audit");tap("Move");tap("Delete");tap("Audit")
        XCTAssertTrue(element("result").label.contains("Deleted a card"),app.debugDescription)
      }
      try cue("stop",name)
    }
  }
  func testHorizontalEdges() throws {
    continueAfterFailure = false; app.launch()
    tap("LTR")
    try cue("start", "horizontal-reorder-edges-ios")
    for scene in ["LTR", "RTL"] {
      tap(scene)
      let alpha = element("Alpha").frame
      contact(CGPoint(x: alpha.midX, y: alpha.midY), CGPoint(x: scene == "RTL" ? -170 : 170, y: 0), .zero, 0.6)
      var value = try snapshot(); XCTAssertEqual(number(value, "commits"), 1)
      let row = element("Alpha").frame, viewport = element("horizontal-reorder").frame
      let far = CGPoint(x: scene == "RTL" ? viewport.minX + 3 : viewport.maxX - 3, y: row.midY)
      let near = CGPoint(x: scene == "RTL" ? viewport.maxX - 3 : viewport.minX + 3, y: row.midY)
      XCTAssertNil(JoltReorderContact(CGPoint(x: row.midX, y: row.midY), far, near, 3, 3)); Thread.sleep(forTimeInterval: 0.7)
      value = try snapshot()
      let travel = value["travel"] as! [String: Any]
      XCTAssertEqual(number(travel, "minimum"), 0, accuracy: 2)
      XCTAssertEqual(number(travel, "maximum"), number(value, "extent"), accuracy: 2)
      XCTAssertEqual(number(value, "commits"), 2)
      XCTAssertEqual((value["order"] as? [String])?.first, "Alpha")
      tap("Reduce")
      let first = element("Alpha").frame
      contact(CGPoint(x: first.midX, y: first.midY), CGPoint(x: scene == "RTL" ? -170 : 170, y: 0), .zero, 0.6)
      value = try snapshot(); XCTAssertEqual(number(value, "commits"), 3)
      for action in ["cancel", "remove", "resize"] {
        tap(scene); tap("Arm " + action)
        let first = element("Alpha").frame
        contact(CGPoint(x: first.midX, y: first.midY), CGPoint(x: scene == "RTL" ? -170 : 170, y: 0), .zero, 0.6)
        value = try snapshot(); XCTAssertEqual(number(value, "commits"), 0)
        XCTAssertEqual(number(value, "cancels"), 1)
      }
    }
    try cue("stop", "horizontal-reorder-edges-ios")
  }
  func testHorizontalLifecycle() throws {
    continueAfterFailure = false; app.launch(); tap("LTR")
    let row = element("Alpha").frame
    let delivered = expectation(description: "held native contact")
    DispatchQueue.global().async {
      XCTAssertNil(JoltReorderContact(CGPoint(x: row.midX, y: row.midY), CGPoint(x: row.midX + 150, y: row.midY), .zero, 3, 0))
      delivered.fulfill()
    }
    Thread.sleep(forTimeInterval: 1.3)
    try cue("background", "lifecycle")
    wait(for: [delivered], timeout: 10)
    app.activate(); Thread.sleep(forTimeInterval: 0.5)
    var value = try snapshot(); XCTAssertEqual(number(value, "commits"), 0)
    // The demo remounts Changes on foreground. The host verifies the preceding
    // native cancel event in the saved log before accepting this test.
    tap("LTR")
    let next = element("Alpha").frame
    contact(CGPoint(x: next.midX, y: next.midY), CGPoint(x: 170, y: 0), .zero, 0.6)
    value = try snapshot(); XCTAssertEqual(number(value, "commits"), 1)
    tap("Changes"); tap("LTR")
    let remounted = element("Alpha").frame
    contact(CGPoint(x: remounted.midX, y: remounted.midY), CGPoint(x: 170, y: 0), .zero, 0.6)
    value = try snapshot(); XCTAssertEqual(number(value, "commits"), 1)
  }
  func testCollections() throws {
    continueAfterFailure = false; app.launch()
    XCTAssertTrue(app.buttons["Prepend"].waitForExistence(timeout: 10))
    try cue("start", "collection-motion-ios")
    tap("Jump 100"); let before = try snapshot(); tap("Prepend")
    var value = try snapshot(); XCTAssertEqual(number(value, "count"), 201)
    XCTAssertEqual(number(value, "offset") - number(before, "offset"), 64, accuracy: 2)
    tap("Remove"); tap("Reverse"); tap("Changes"); tap("Reorder")
    let list = element("collection-list").frame
    contact(CGPoint(x: list.midX, y: list.minY + 32), CGPoint(x: 0, y: 160), .zero, 0.6)
    value = try snapshot(); XCTAssertEqual(number(value, "commits"), 1)
    XCTAssertEqual(value["first"] as? String, "row-1")
    tap("Jump 100")
    XCTAssertNil(JoltReorderContact(CGPoint(x: list.midX, y: list.minY + 32), CGPoint(x: list.midX, y: list.maxY - 3), CGPoint(x: list.midX, y: list.minY + 3), 6, 2))
    Thread.sleep(forTimeInterval: 0.7)
    value = try snapshot(); XCTAssertEqual(number(value, "commits"), 2)
    let move = value["lastMove"] as! [String: Any], travel = value["travel"] as! [String: Any]
    XCTAssertEqual(move["key"] as? String, move["committed"] as? String)
    XCTAssertGreaterThan(number(travel, "maximum") - number(travel, "minimum"), list.height * 2)
    XCTAssertEqual(number(value, "panel"), 0, accuracy: 2)
    for (index, action) in ["replace", "remove", "cancel"].enumerated() {
      tap("Jump 100"); tap("Arm " + action)
      contact(CGPoint(x: list.midX, y: list.minY + 32), CGPoint(x: 0, y: 150), .zero, 0.6)
      value = try snapshot(); XCTAssertEqual(number(value, "commits"), 2)
      XCTAssertEqual(number(value, "cancels"), Double(index + 1))
    }
    tap("Changes"); tap("Reorder")
    let remounted = element("collection-list").frame
    contact(CGPoint(x: remounted.midX, y: remounted.minY + 32), CGPoint(x: 0, y: 150), .zero, 0.6)
    value = try snapshot(); XCTAssertEqual(number(value, "commits"), 1)
    contact(CGPoint(x: remounted.midX, y: remounted.maxY - 20), CGPoint(x: 0, y: -150))
    value = try snapshot(); XCTAssertEqual(number(value, "commits"), 1)
    XCTAssertGreaterThan(number(value, "offset"), 50)
    try cue("stop", "collection-motion-ios")
    tap("List handoff")
    try cue("start", "scroll-handoff-ios")
    for scene in ["List handoff", "CV handoff"] {
      tap(scene)
      let panel = element("handoff-panel").frame
      let start = CGPoint(x: panel.midX, y: min(panel.maxY - 40, 690))
      contact(start, CGPoint(x: 0, y: -300))
      value = try snapshot(); XCTAssertEqual(number(value, "panel"), 0, accuracy: 2)
      XCTAssertGreaterThan(number(value, "scroll"), 70); XCTAssertEqual(number(value, "ends"), 1)
      tap("Reset")
      contact(start, CGPoint(x: 0, y: -300), CGPoint(x: 0, y: 260))
      value = try snapshot(); XCTAssertGreaterThan(number(value, "panel"), 80)
      XCTAssertEqual(number(value, "scroll"), 0, accuracy: 2)
    }
    tap("X handoff")
    var panel = element("handoff-panel").frame
    contact(CGPoint(x: 365, y: panel.minY + 120), CGPoint(x: -260, y: 0))
    value = try snapshot(); XCTAssertEqual(number(value, "panel"), 0, accuracy: 2); XCTAssertGreaterThan(number(value, "scroll"), 80)
    try cue("stop", "scroll-handoff-ios")
    tap("LTR")
    try cue("start", "horizontal-reorder-ios")
    for scene in ["LTR", "RTL"] {
      tap(scene)
      panel = element("Alpha").frame
      contact(CGPoint(x: panel.midX, y: panel.midY), CGPoint(x: scene == "RTL" ? -170 : 170, y: 0), .zero, 0.6)
      value = try snapshot(); XCTAssertEqual(number(value, "commits"), 1)
      XCTAssertEqual((value["order"] as? [String])?.first, "Bravo")
    }
    try cue("stop", "horizontal-reorder-ios")
    tap("Y source")
    try cue("start", "scroll-source-ios")
    for scene in ["Y source", "X source", "CV source"] {
      tap(scene); tap("Offset 400"); value = try snapshot()
      let source = value["source"] as! [String: Any]
      XCTAssertEqual(number(source, "offset"), 400, accuracy: 2)
      XCTAssertEqual(number(source, "callbacks"), 0)
      XCTAssertGreaterThan(number(source, "updates"), 0)
      if scene != "CV source" {
        XCTAssertEqual(number(value["baseline"] as! [String: Any], "offset"), number(source, "offset"), accuracy: 2)
        tap("Origin")
        let frame = element("collection-list").frame
        contact(CGPoint(x: frame.midX, y: frame.midY), CGPoint(x: scene == "X source" ? 100 : 0, y: scene == "Y source" ? 100 : 0))
        value = try snapshot()
        let native = value["source"] as! [String: Any], baseline = value["baseline"] as! [String: Any]
        XCTAssertLessThan(number(native, "minimum"), -20)
        XCTAssertEqual(number(native, "minimum"), number(baseline, "minimum"), accuracy: 2)
        XCTAssertEqual(number(native, "callbacks"), 0)
        XCTAssertGreaterThan(number(baseline, "callbacks"), 10)
      }
      if scene != "Y source" {
        tap("RTL source"); tap("Offset 400"); value = try snapshot()
        XCTAssertEqual(number(value["source"] as! [String: Any], "offset"), 400, accuracy: 2)
        if scene == "X source" { XCTAssertEqual(number(value["baseline"] as! [String: Any], "offset"), 400, accuracy: 2) }
      }
    }
    try cue("stop", "scroll-source-ios")
  }
}
