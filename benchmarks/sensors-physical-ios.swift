import XCTest

/// Uses actual Core Motion acquisition. Never taps the synthetic preview.
final class DocsTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.benchmark")

    func tap(_ id: String, wait: TimeInterval = 0.6) {
        let element = app.descendants(matching: .any)[id].firstMatch
        XCTAssertTrue(element.waitForExistence(timeout: 8), id)
        element.tap()
        Thread.sleep(forTimeInterval: wait)
    }

    func snapshot(wait: TimeInterval = 0.4) { tap("sensor-snapshot", wait: wait) }

    func background() {
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 2)
        app.activate()
        XCTAssertTrue(app.descendants(matching: .any)["sensor-lab"].firstMatch.waitForExistence(timeout: 10))
        Thread.sleep(forTimeInterval: 1)
        snapshot()
    }

    func testHardwareLifecycle() throws {
        #if targetEnvironment(simulator)
        throw XCTSkip("This audit requires a physical iPhone and real Core Motion input.")
        #else
        continueAfterFailure = false
        app.launchArguments = ["-AppleLanguages", "(en)", "--showcase-example=device-sensors", "--sensors-lifecycle"]
        app.launch()
        XCTAssertTrue(app.descendants(matching: .any)["sensor-lab"].firstMatch.waitForExistence(timeout: 15))
        for cycle in 0..<3 {
            Thread.sleep(forTimeInterval: 3)
            snapshot()
            // Stable acquisition window: no test input or JavaScript polling.
            Thread.sleep(forTimeInterval: 5)
            snapshot()
            background()
            if cycle == 0 {
                tap("sensor-pause", wait: 1)
                snapshot()
                background()
                tap("sensor-pause", wait: 2)
                snapshot()
                tap("sensor-reduce", wait: 1)
                snapshot()
                tap("sensor-reduce", wait: 2)
                snapshot()
                tap("sensor-center", wait: 1)
                snapshot()
            }
            tap("Back to collection", wait: 1)
            XCTAssertFalse(app.descendants(matching: .any)["sensor-lab"].firstMatch.exists)
            if cycle < 2 {
                let search = app.textFields["Search examples"].firstMatch
                XCTAssertTrue(search.waitForExistence(timeout: 5))
                if cycle == 0 { search.tap(); search.typeText("Move the light\n") }
                tap("Open Move the light", wait: 1)
            }
        }
        #endif
    }

    func testSamplingIntervals() throws {
        #if targetEnvironment(simulator)
        throw XCTSkip("This audit requires a physical iPhone and real Core Motion input.")
        #else
        continueAfterFailure = false
        app.launchArguments = ["-AppleLanguages", "(en)", "--showcase-example=device-sensors", "--sensors-intervals"]
        app.launch()
        let button = app.buttons["sensor-interval-run"].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 15))
        // Leave time for the host's USB screen recorder to attach to the demo.
        Thread.sleep(forTimeInterval: 10)
        button.tap()
        let status = app.staticTexts["sensor-interval-state"].firstMatch
        let finished = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == 'Completed' OR label == 'Failed'"), object: status)
        XCTAssertEqual(XCTWaiter.wait(for: [finished], timeout: 150), .completed)
        XCTAssertEqual(status.label, "Completed", app.debugDescription)
        Thread.sleep(forTimeInterval: 2)
        tap("Back to collection", wait: 1)
        XCTAssertFalse(app.descendants(matching: .any)["sensor-lab"].firstMatch.exists)
        #endif
    }
}
