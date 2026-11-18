import UIKit
import XCTest

final class MotionContracts: XCTestCase {
  let app = XCUIApplication(bundleIdentifier: "dev.jolt.nativeci")
  let control = URL(
    fileURLWithPath: "/tmp/jolt-contracts-recording-"
      + (ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "unknown"))
  var serial = 0
  func cue(_ action: String, _ name: String) throws {
    guard FileManager.default.fileExists(atPath: control.path) else { return }
    serial += 1
    try JSONSerialization.data(withJSONObject: ["id": serial, "action": action, "name": name])
      .write(to: control.appendingPathComponent("request.json"), options: .atomic)
    let end = Date().addingTimeInterval(15)
    while Date() < end {
      if (try? String(contentsOf: control.appendingPathComponent("ack"), encoding: .utf8))
        == String(serial)
      {
        return
      }
      Thread.sleep(forTimeInterval: 0.03)
    }
    XCTFail("Capture acknowledgement missing")
  }
  func tap(_ name: String, _ delay: Double = 0.6) {
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
  func drag(_ name: String, _ dx: Double, _ dy: Double, _ hold: Double = 0.05) {
    let e = element(name)
    let start = e.coordinate(withNormalizedOffset: CGVector(dx: 0.35, dy: 0.5))
    start.press(
      forDuration: hold, thenDragTo: start.withOffset(CGVector(dx: dx, dy: dy)), withVelocity: 120,
      thenHoldForDuration: 0.2)
    Thread.sleep(forTimeInterval: 0.5)
  }
  func status() -> String {
    tap("Snapshot", 0.2)
    return element("contract-status").label
  }
  func testContracts() throws {
    continueAfterFailure = false
    app.launch()
    XCTAssertTrue(app.buttons["Inner waits"].waitForExistence(timeout: 10))
    Thread.sleep(forTimeInterval: 1)
    try cue("start", "gesture-relations-ios")
    drag("contract-inner", 100, 0)
    var value = status()
    XCTAssertTrue(value.contains("inner end"), value)
    XCTAssertFalse(value.contains("outer start"), value)
    tap("Outer waits")
    drag("contract-inner", 100, 0)
    value = status()
    XCTAssertTrue(value.contains("outer end"), value)
    XCTAssertFalse(value.contains("inner start"), value)
    tap("Press & carousel")
    drag("contract-inner", 100, 0, 0.4)
    value = status()
    XCTAssertTrue(value.contains("outer end"), value)
    tap("Swipe & reorder")
    drag("Alpha", 100, 0)
    value = status()
    XCTAssertTrue(value.contains("swipe end"), value)
    XCTAssertFalse(value.contains("reorder start"), value)
    tap("Swipe & reorder")
    drag("Alpha", 0, 175, 0.6)
    value = status()
    XCTAssertTrue(value.contains("reorder commit"), value)
    XCTAssertFalse(value.contains("swipe start"), value)
    tap("Photo & sheet", 1.4)
    drag("contract-photo", 0, 150)
    value = status()
    XCTAssertTrue(value.contains("sheet 180"), value)
    tap("Photo & sheet", 1.4)
    element("contract-photo").pinch(withScale: 2, velocity: 1)
    value = status()
    XCTAssertTrue(value.contains("sheet 420"), value)
    XCTAssertFalse(value.contains("photo 1.00"), value)
    try cue("stop", "gesture-relations-ios")
    tap("Paused velocity")
    try cue("start", "spring-velocity-ios")
    tap("Move", 0.35)
    tap("Pause", 0.3)
    value = status()
    XCTAssertTrue(value.contains("velocity 0.0 · derivative 0.0"), value)
    Thread.sleep(forTimeInterval: 1)
    XCTAssertEqual(value, status())
    tap("Resume", 0.3)
    value = status()
    XCTAssertFalse(value.contains("velocity 0.0"), value)
    tap("Pause", 0.3)
    Thread.sleep(forTimeInterval: 0.5)
    try cue("stop", "spring-velocity-ios")
  }
}
