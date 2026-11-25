import XCTest

final class KeyboardTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "dev.jolt.nativeci")
    var keyboard: XCUIElement { app.keyboards.firstMatch }

    private func expectLift(atRest: Bool) {
        let status = app.staticTexts["Geometry"]
        let predicate = NSPredicate(format: "label BEGINSWITH %@", atRest ? "Editor at rest" : "Editor follows keyboard")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: status)
        XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: 6), .completed, status.label)
    }

    private func redock() {
        let keys = keyboard.frame
        let origin = app.coordinate(withNormalizedOffset: .zero)
        let more = origin.withOffset(CGVector(dx: keys.midX, dy: keys.maxY + 32))
        more.tap()
        let full = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Full")).firstMatch
        XCTAssertTrue(full.waitForExistence(timeout: 3))
        full.tap()
        XCTAssertGreaterThan(keyboard.frame.width, app.frame.width * 0.8)
    }

    func testKeyboardModes() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app.launch()
        let field = app.textFields["Edit note"]
        XCTAssertTrue(field.waitForExistence(timeout: 20))
        NSLog("JOLT_CLIP_START")
        Thread.sleep(forTimeInterval: 1.5)
        field.tap()
        XCTAssertTrue(keyboard.waitForExistence(timeout: 8))
        if keyboard.frame.width < app.frame.width * 0.8 { redock() }
        expectLift(atRest: false)
        keyboard.pinch(withScale: 0.30, velocity: -2)
        XCTAssertLessThan(keyboard.frame.width, app.frame.width * 0.8)
        expectLift(atRest: true)
        Thread.sleep(forTimeInterval: 1)
        redock()
        expectLift(atRest: false)
        app.buttons["Finish editing"].tap()
        expectLift(atRest: true)
        Thread.sleep(forTimeInterval: 1.2)
        NSLog("JOLT_CLIP_END")
        field.tap()
        expectLift(atRest: false)
        XCUIDevice.shared.orientation = .landscapeLeft
        expectLift(atRest: false)
        XCUIDevice.shared.orientation = .portrait
        expectLift(atRest: false)
        app.buttons["Finish editing"].tap()
        expectLift(atRest: true)
    }
}
