import XCTest
import UIKit
final class ValuesScrollLists: XCTestCase {
  let app=XCUIApplication(bundleIdentifier:"dev.jolt.nativeci")
  let control=URL(fileURLWithPath:"/tmp/jolt-values-recording-"+(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "unknown"))
  var serial=0
  func cue(_ action:String,_ name:String) throws {
    guard FileManager.default.fileExists(atPath:control.path) else{return}
    serial += 1
    let data=try JSONSerialization.data(withJSONObject:["id":serial,"action":action,"name":name])
    try data.write(to:control.appendingPathComponent("request.json"),options:.atomic)
    let end=Date().addingTimeInterval(15)
    while Date()<end {if (try? String(contentsOf:control.appendingPathComponent("ack"),encoding:.utf8))==String(serial){return};Thread.sleep(forTimeInterval:0.03)}
    XCTFail("Capture acknowledgement missing")
  }
  func point(_ name:String)->CGPoint {let button=app.buttons[name].firstMatch;XCTAssertTrue(button.waitForExistence(timeout:5),app.debugDescription);return CGPoint(x:button.frame.midX,y:button.frame.midY)}
  func tap(_ point:CGPoint,_ delay:Double=0.6){XCTAssertNil(JoltNativeTap(point));Thread.sleep(forTimeInterval:delay)}
  func testScenes() throws {
    continueAfterFailure=false;app.launch();XCTAssertTrue(app.buttons["Animate"].waitForExistence(timeout:10))
    let animate=point("Animate"),interrupt=point("Interrupt"),audit=point("Audit")
    try cue("start","values-scroll-ios")
    tap(animate,0.45);tap(interrupt,1.2);tap(animate,2.8)
    app.scrollViews.firstMatch.swipeUp();tap(audit,0.8)
    app.scrollViews.firstMatch.swipeDown();tap(audit,0.8)
    try cue("stop","values-scroll-ios")
    tap(point("Layout exits"))
    let mix=point("Mix changes"),remove=point("Remove"),cancel=point("Cancel"),reset=point("Reset"),reinsert=point("Reinsert")
    try cue("start","layout-exits-ios")
    tap(mix,1.3);tap(remove,0.15);tap(remove,1.2);tap(reset)
    tap(remove,0.2);tap(cancel,0.8);tap(reset);tap(reinsert,1.1)
    tap(point("Reduce motion"));tap(mix,0.8);tap(point("Reduce motion"))
    try cue("stop","layout-exits-ios")
    tap(point("Audit costs"),0.8)
    tap(point("Keyed lists"))
    let delete=point("Delete"),prepend=point("Insert above"),sort=point("Reverse"),filter=point("Filter"),listReset=point("Reset"),listAudit=point("List audit")
    try cue("start","list-changes-ios")
    app.tables.firstMatch.swipeUp();tap(listAudit,0.6)
    tap(prepend,1.1);tap(delete,1.1);tap(sort,0.15);tap(filter,1.2)
    tap(listReset,1);app.tables.firstMatch.swipeDown();tap(delete,0.2);tap(prepend,1)
    tap(point("Reduce motion"));tap(sort,0.8);tap(listAudit,0.5)
    try cue("stop","list-changes-ios")
  }
}
