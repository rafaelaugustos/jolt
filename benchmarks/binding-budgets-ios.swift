import XCTest

/// Real OS input against the isolated Release benchmark app, on a phone or simulator.
final class DocsTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.bindings")
    func testInputWindows() throws { try runInputs(recording: false) }
    func testRecording() throws { try runInputs(recording: true) }
    func testInputDelay() throws { try runInputs(recording: false, delayMs: 40) }
    func testMatrixRecording() throws {
        continueAfterFailure = false
        app.launchArguments = ["-AppleLanguages", "(en)", "--budget-case=value-64-window", "--budget-recording=true", "--budget-session=recording-\(UUID().uuidString)"]
        app.launch()
        let button = app.buttons["budget-run"].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 12))
        Thread.sleep(forTimeInterval: 8)
        button.tap()
        let state = app.staticTexts["budget-status"].firstMatch
        let complete = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == 'Completed'"), object: state)
        XCTAssertEqual(XCTWaiter.wait(for: [complete], timeout: 70), .completed)
        Thread.sleep(forTimeInterval: 2)
    }
    func runInputs(recording: Bool, delayMs: Int = 0) throws {
        continueAfterFailure = false
        let kinds = delayMs > 0 ? ["drag-js"] : recording ? ["pan-native"] : ["drag-js", "pan-native", "scroll-js", "header-native"]
        for kind in kinds {
            app.launchArguments = ["-AppleLanguages", "(en)", "--budget-input=\(kind)", "--budget-session=input-\(kind)-\(UUID().uuidString)", "--budget-recording=\(recording)", "--budget-input-delay-ms=\(delayMs)"]
            app.launch()
            let state = app.staticTexts["budget-input-state"].firstMatch
            XCTAssertTrue(state.waitForExistence(timeout: 12))
            let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == 'Ready'"), object: state)
            XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed)
            if recording { Thread.sleep(forTimeInterval: 8) }
            app.buttons["budget-input-control"].tap()
            let pad = app.descendants(matching: .any)["budget-input-pad"].firstMatch
            XCTAssertTrue(pad.exists)
            for _ in 0..<3 {
                if kind == "drag-js" || kind == "pan-native" {
                    let left = pad.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5))
                    let right = pad.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5))
                    left.press(forDuration: 0.05, thenDragTo: right, withVelocity: .slow, thenHoldForDuration: 0.1)
                    Thread.sleep(forTimeInterval: 1.2)
                    right.press(forDuration: 0.05, thenDragTo: left, withVelocity: .slow, thenHoldForDuration: 0.1)
                } else {
                    pad.swipeUp(velocity: .slow)
                    Thread.sleep(forTimeInterval: 1.2)
                    pad.swipeDown(velocity: .slow)
                }
                Thread.sleep(forTimeInterval: 1.2)
            }
            app.buttons["budget-input-control"].tap()
            let complete = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == 'Completed'"), object: state)
            XCTAssertEqual(XCTWaiter.wait(for: [complete], timeout: 10), .completed)
            // Host copies the per-case file; each input path has its own filename.
            Thread.sleep(forTimeInterval: 1)
        }
    }
}
