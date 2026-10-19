import XCTest

final class DragTests: XCTestCase {
    func testDragDemo() throws {
        let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.benchmark")
        app.launchArguments = ["--drag-lab"]
        app.launch()
        let panel = app.otherElements["Drag panel"].firstMatch
        let card = app.otherElements["Drag card"].firstMatch
        XCTAssertTrue(panel.waitForExistence(timeout: 15), app.debugDescription)
        let original = panel.frame
        let start = panel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        start.press(forDuration: 0.1, thenDragTo: start.withOffset(CGVector(dx: 0, dy: 130)), withVelocity: .slow, thenHoldForDuration: 0.2)
        let settled = app.staticTexts["Panel settled · 140"]
        XCTAssertTrue(settled.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertEqual(panel.frame.minY - original.minY, 140, accuracy: 3)
        XCTAssertEqual(panel.frame.minX, original.minX, accuracy: 2)
        let up = panel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        up.press(forDuration: 0.1, thenDragTo: up.withOffset(CGVector(dx: 0, dy: -130)), withVelocity: .slow, thenHoldForDuration: 0.2)
        XCTAssertTrue(app.staticTexts["Panel settled · 0"].waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertEqual(panel.frame.minY, original.minY, accuracy: 3)
        app.buttons["Pause drag"].tap()
        let stopped = panel.frame
        let hold = panel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        hold.press(forDuration: 0.1, thenDragTo: hold.withOffset(CGVector(dx: 0, dy: 120)))
        XCTAssertEqual(panel.frame.minY, stopped.minY, accuracy: 2)
        app.buttons["Resume drag"].tap()
        app.buttons["Motion: system"].tap()
        let reduced = panel.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        reduced.press(forDuration: 0.1, thenDragTo: reduced.withOffset(CGVector(dx: 0, dy: 70)), withVelocity: .slow, thenHoldForDuration: 0.3)
        XCTAssertTrue(app.staticTexts["Panel settled · 70"].waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertEqual(panel.frame.minY - original.minY, 70, accuracy: 3)
        app.buttons["Motion: reduced"].tap()
        let originalCard = card.frame
        let fling = card.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        fling.press(forDuration: 0.1, thenDragTo: fling.withOffset(CGVector(dx: 150, dy: 0)), withVelocity: .fast, thenHoldForDuration: 0)
        XCTAssertTrue(app.staticTexts["Card settled · 90"].waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertEqual(card.frame.minX - originalCard.minX, 90, accuracy: 3)
        app.buttons["Unmount drags"].tap()
        XCTAssertTrue(app.staticTexts["Drag examples unmounted"].waitForExistence(timeout: 3))
        app.buttons["Mount drags"].tap()
        XCTAssertTrue(panel.waitForExistence(timeout: 3))
        XCTAssertEqual(panel.frame.minY, original.minY, accuracy: 3)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}
