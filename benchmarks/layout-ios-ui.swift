import XCTest

final class LayoutTests: XCTestCase {
    func testLayoutDemo() throws {
        let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.benchmark")
        app.launchArguments = ["--layout-lab"]
        app.launch()
        let one = app.buttons["layout-card-1"], two = app.buttons["layout-card-2"]
        XCTAssertTrue(one.waitForExistence(timeout: 15), app.debugDescription)
        let original = one.frame, originalTwo = two.frame
        func settled(_ name: String) {
            XCTAssertTrue(app.staticTexts["Settled · \(name)"].waitForExistence(timeout: 7), app.debugDescription)
        }
        app.buttons["Insert"].tap(); settled("Insert")
        XCTAssertTrue(app.buttons["layout-card-4"].exists)
        XCTAssertEqual(two.frame.minY - originalTwo.minY, 62, accuracy: 3)
        app.buttons["Remove"].tap(); settled("Remove")
        XCTAssertFalse(app.buttons["layout-card-4"].exists)
        XCTAssertEqual(two.frame.minY, originalTwo.minY, accuracy: 3)
        one.tap(); settled("Card 1")
        XCTAssertEqual(one.frame.width, 300, accuracy: 3)
        XCTAssertEqual(one.frame.height, 100, accuracy: 3)
        XCTAssertEqual(two.frame.minY - originalTwo.minY, 46, accuracy: 3)
        one.tap(); settled("Card 1")
        XCTAssertEqual(one.frame.width, 240, accuracy: 3)
        app.buttons["Slow layout"].tap()
        app.buttons["Reverse"].tap()
        Thread.sleep(forTimeInterval: 0.8)
        let moving = one.frame
        XCTAssertGreaterThan(moving.minY, original.minY + 10)
        XCTAssertLessThan(moving.minY, original.minY + 115)
        // A coordinate touch on the moving card must interrupt layout and expand that same card.
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: moving.midX, dy: moving.midY)).tap()
        XCTAssertEqual(app.staticTexts["layout-status"].label, "Moving · Card 1")
        settled("Card 1")
        XCTAssertEqual(one.frame.height, 100, accuracy: 3)
        XCTAssertGreaterThan(one.frame.minY, two.frame.minY)
        app.buttons["Reverse"].tap()
        Thread.sleep(forTimeInterval: 0.2)
        app.buttons["Stop layout"].tap()
        XCTAssertEqual(app.staticTexts["layout-status"].label, "Stopped")
        XCTAssertEqual(one.frame.minY, original.minY, accuracy: 3)
        app.buttons["Normal layout"].tap()
        app.buttons["Size: scale"].tap()
        one.tap(); settled("Card 1")
        XCTAssertEqual(one.frame.height, 54, accuracy: 3)
        app.buttons["Motion: system"].tap()
        app.buttons["Reverse"].tap(); settled("Reverse")
        XCTAssertGreaterThan(one.frame.minY, two.frame.minY)
        app.buttons["Motion: reduced"].tap()
        app.buttons["Slow layout"].tap()
        app.buttons["Reverse"].tap()
        app.buttons["Unmount layout"].tap()
        XCTAssertTrue(app.staticTexts["Layout examples unmounted"].waitForExistence(timeout: 3))
        app.buttons["Mount layout"].tap()
        XCTAssertTrue(one.waitForExistence(timeout: 3))
        XCTAssertEqual(one.frame.minY, original.minY, accuracy: 3)
        one.tap(); settled("Card 1")
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
