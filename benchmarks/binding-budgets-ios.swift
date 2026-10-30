import XCTest

/// Real OS input against the isolated Release benchmark app, on a phone or simulator.
final class DocsTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.bindings")
    func testInputWindows() throws {
        continueAfterFailure = false
        for kind in ["drag-js", "pan-native", "scroll-js", "header-native"] {
            app.launchArguments = ["-AppleLanguages", "(en)", "--budget-input=\(kind)", "--budget-session=input-\(kind)"]
            app.launch()
            let state = app.staticTexts["budget-input-state"].firstMatch
            XCTAssertTrue(state.waitForExistence(timeout: 12))
            let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == 'Ready'"), object: state)
            XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed)
            app.buttons["budget-input-control"].tap()
            let pad = app.descendants(matching: .any)["budget-input-pad"].firstMatch
            XCTAssertTrue(pad.exists)
            for _ in 0..<3 {
                if kind == "drag-js" || kind == "pan-native" {
                    let left = pad.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5))
                    let right = pad.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5))
                    left.press(forDuration: 0.05, thenDragTo: right, withVelocity: .slow, thenHoldForDuration: 0.1)
                    right.press(forDuration: 0.05, thenDragTo: left, withVelocity: .slow, thenHoldForDuration: 0.1)
                } else {
                    pad.swipeUp(velocity: .slow)
                    pad.swipeDown(velocity: .slow)
                }
            }
            app.buttons["budget-input-control"].tap()
            let complete = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == 'Completed'"), object: state)
            XCTAssertEqual(XCTWaiter.wait(for: [complete], timeout: 10), .completed)
            // Host copies the per-case file; each input path has its own filename.
            Thread.sleep(forTimeInterval: 1)
        }
    }
}
