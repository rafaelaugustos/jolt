import XCTest
final class InteractionTests: XCTestCase {
    func testInteractiveGeometry() throws {
        let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.benchmark")
        app.launch()
        XCTAssertTrue(app.buttons["translation"].waitForExistence(timeout: 15))
        let root = app.coordinate(withNormalizedOffset: .zero)
        let button = app.buttons["moving"]
        let initial = button.frame
        let status = app.staticTexts["status"]
        func tap(_ x: CGFloat, _ y: CGFloat) { root.withOffset(CGVector(dx: x, dy: y)).tap() }
        app.buttons["translation"].tap()
        XCTAssertEqual(button.frame.midX, initial.midX + 100, accuracy: 2)
        tap(initial.midX + 100, initial.midY)
        XCTAssertEqual(status.label, "moving 1")
        tap(initial.midX, initial.midY)
        tap(initial.midX + 200, initial.midY)
        XCTAssertEqual(status.label, "moving 1")
        app.buttons["Stop"].tap()
        tap(initial.midX + 100, initial.midY)
        XCTAssertEqual(status.label, "moving 2")
        app.buttons["ancestor"].tap()
        let transformed = button.frame
        tap(transformed.midX, transformed.midY)
        XCTAssertEqual(status.label, "moving 1")
        app.buttons["clip"].tap()
        tap(initial.minX + 110, initial.midY)
        XCTAssertEqual(status.label, "moving 1")
        tap(initial.minX + 145, initial.midY)
        XCTAssertEqual(status.label, "moving 1")
        app.buttons["overlap"].tap()
        tap(initial.midX + 100, initial.midY)
        XCTAssertEqual(status.label, "moving 1")
        app.buttons["disabled"].tap()
        XCTAssertEqual(button.label, "Moving") // NativeScript keeps the native button role/label.
        tap(initial.midX + 100, initial.midY)
        XCTAssertEqual(status.label, "Held disabled")
        app.buttons["Reset"].tap()
        app.buttons["live"].tap()
        Thread.sleep(forTimeInterval: 1.8)
        let moving = button.frame
        XCTAssertGreaterThan(moving.midX, initial.midX + 25)
        XCTAssertLessThan(moving.midX, initial.midX + 160)
        tap(moving.midX, moving.midY)
        XCTAssertEqual(status.label, "moving 1")
        tap(initial.midX, initial.midY)
        tap(initial.midX + 200, initial.midY)
        XCTAssertEqual(status.label, "moving 1")
        app.buttons["Stop"].tap()
        let stopped = button.frame
        tap(stopped.midX, stopped.midY)
        XCTAssertEqual(status.label, "moving 2")
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.lifetime = .keepAlways; add(screenshot)
    }
    func probeBaseline() throws {
        let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.benchmark")
        app.launch()
        XCTAssertTrue(app.buttons["translation"].waitForExistence(timeout: 15))
        let original = app.buttons["moving"].frame
        app.buttons["translation"].tap()
        XCTAssertTrue(app.staticTexts["status"].waitForExistence(timeout: 3))
        let root = app.coordinate(withNormalizedOffset: .zero)
        root.withOffset(CGVector(dx: original.midX + 100, dy: original.midY)).tap()
        print("VISIBLE_TAP: \(app.staticTexts["status"].label)")
        root.withOffset(CGVector(dx: original.midX, dy: original.midY)).tap()
        print("OLD_TAP: \(app.staticTexts["status"].label)")
        root.withOffset(CGVector(dx: original.midX + 200, dy: original.midY)).tap()
        print("DESTINATION_TAP: \(app.staticTexts["status"].label)")
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.lifetime = .keepAlways; add(screenshot)
    }
}
