import XCTest

final class SwiftUIAcceptance: XCTestCase {
    #if os(iOS)
    @MainActor func testStandaloneMotionAndLifecycle() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages","(en)","-AppleLocale","en_US"]
        app.launch()
        let card = app.buttons["motion-card"]
        XCTAssertTrue(card.waitForExistence(timeout:10))
        cue("start")
        let origin = card.frame.midX
        app.buttons["move"].tap()
        Thread.sleep(forTimeInterval:0.16)
        app.buttons["interrupt"].tap()
        XCTAssertTrue(wait { card.frame.midX < origin - 40 })
        app.buttons["reset"].tap()
        XCTAssertTrue(wait { abs(card.frame.midX-origin) < 3 })
        card.tap()
        XCTAssertTrue(wait { String(describing:app.staticTexts["counts"].value ?? app.staticTexts["counts"].label).contains("Actions: 1") },app.staticTexts["counts"].debugDescription)
        app.buttons["replace"].tap()
        XCTAssertTrue(card.exists)
        app.buttons["toggle"].tap()
        XCTAssertFalse(card.exists)
        app.buttons["toggle"].tap()
        XCTAssertTrue(card.waitForExistence(timeout:3))
        app.switches["reduce"].tap()
        app.buttons["move"].tap()
        XCTAssertTrue(wait { card.frame.midX > origin + 60 })
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval:0.6)
        app.activate()
        XCTAssertTrue(card.waitForExistence(timeout:5))
        XCTAssertTrue(wait { String(describing:app.staticTexts["counts"].value ?? app.staticTexts["counts"].label).contains("Actions: 1") },app.staticTexts["counts"].debugDescription)
        app.buttons["reset"].tap()
        app.swipeUp()
        app.buttons["preset-play"].tap()
        Thread.sleep(forTimeInterval:0.8)
        app.buttons["preset-start"].tap()
        Thread.sleep(forTimeInterval:0.7)
        app.buttons["preset-play"].tap()
        app.buttons["details"].tap()
        XCTAssertTrue(app.navigationBars["Lifecycle"].waitForExistence(timeout:3))
        app.navigationBars.buttons.element(boundBy:0).tap()
        app.swipeDown()
        XCTAssertTrue(card.waitForExistence(timeout:3))
        cue("stop")
    }
    #else
    @MainActor func testStandaloneMacMotionAndLifecycle() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["-AppleLanguages","(en)","-AppleLocale","en_US"]
        app.launch()
        let card = app.buttons["motion-card"]
        XCTAssertTrue(card.waitForExistence(timeout:10))
        cue("start")
        let origin = card.frame.midX
        app.buttons["move"].click()
        app.buttons["interrupt"].click()
        XCTAssertTrue(wait { card.frame.midX < origin - 40 })
        app.buttons["reset"].click()
        XCTAssertTrue(wait { abs(card.frame.midX-origin) < 3 })
        card.click()
        XCTAssertTrue(wait { String(describing:app.staticTexts["counts"].value ?? app.staticTexts["counts"].label).contains("Actions: 1") },app.staticTexts["counts"].debugDescription)
        app.buttons["replace"].click()
        app.buttons["toggle"].click()
        XCTAssertFalse(card.exists)
        app.buttons["toggle"].click()
        XCTAssertTrue(card.waitForExistence(timeout:3))
        app.checkBoxes["reduce"].click()
        app.buttons["move"].click()
        XCTAssertTrue(wait { card.frame.midX > origin + 60 })
        app.buttons["reset"].click()
        app.buttons["preset-play"].click()
        Thread.sleep(forTimeInterval:0.7)
        app.buttons["preset-start"].click()
        Thread.sleep(forTimeInterval:0.7)
        app.buttons["preset-play"].click()
        Thread.sleep(forTimeInterval:0.8)
        cue("stop")
    }
    #endif
    private func cue(_ action: String) {
        let device = ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "macos"
        let directory = URL(fileURLWithPath:"/tmp/jolt-swiftui-recording-control-" + device)
        guard FileManager.default.fileExists(atPath:directory.path) else { return }
        #if os(macOS)
        // The macOS XCTest runner is sandboxed. Handshake inside its own temp directory.
        let ack = FileManager.default.temporaryDirectory.appendingPathComponent("jolt-recording-ack")
        #else
        let ack = directory.appendingPathComponent("ack")
        #endif
        try? FileManager.default.removeItem(at:ack)
        #if os(macOS)
        print("JOLT_CAPTURE_\(action) \(ack.path)")
        #else
        do { try action.write(to:directory.appendingPathComponent("request"),atomically:true,encoding:.utf8) }
        catch { XCTFail("Recorder cue failed: \(error)"); return }
        #endif
        let deadline = Date().addingTimeInterval(30)
        while Date() < deadline {
            if (try? String(contentsOf:ack,encoding:.utf8)) == action { return }
            Thread.sleep(forTimeInterval:0.05)
        }
        XCTFail("Recorder did not acknowledge " + action)
    }
    private func wait(_ condition: @escaping () -> Bool) -> Bool {
        XCTWaiter.wait(for:[XCTNSPredicateExpectation(predicate:NSPredicate { _,_ in condition() },object:nil)],timeout:4) == .completed
    }
}
