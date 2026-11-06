import XCTest
import UIKit

/// Baseline/candidate input is delivered by XCTest to the actual native demo.
final class DocsTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.benchmark")
    func host(_ action: String) throws {
        let device = ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "unknown"
        let directory = URL(fileURLWithPath: "/tmp/jolt-portable-control-" + device)
        let id = UUID().uuidString
        try JSONSerialization.data(withJSONObject: ["id": id, "action": action]).write(to: directory.appendingPathComponent("request.json"), options: .atomic)
        for _ in 0..<200 {
            if let data = try? Data(contentsOf: directory.appendingPathComponent("ack.json")),
               let ack = try? JSONSerialization.jsonObject(with: data) as? [String:String], ack["id"] == id { return }
            Thread.sleep(forTimeInterval: 0.05)
        }
        XCTFail("Host did not acknowledge " + action)
    }
    func launch(_ mode: String) {
        app.launchArguments = ["--portable-lab=" + mode, "--portable-audit", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(app.buttons["foundation-run"].waitForExistence(timeout: 30))
    }
    func testPropertyGroups() throws {
        launch("groups")
        try host("start-property-groups-ios")
        app.buttons["foundation-run"].tap()
        Thread.sleep(forTimeInterval: 0.5)
        app.buttons["foundation-pause"].tap()
        Thread.sleep(forTimeInterval: 1)
        app.buttons["foundation-resume"].tap()
        Thread.sleep(forTimeInterval: 2)
        app.buttons["foundation-run"].tap()
        Thread.sleep(forTimeInterval: 0.5)
        app.buttons["foundation-run"].tap()
        Thread.sleep(forTimeInterval: 2.2)
        app.buttons["foundation-remount"].tap()
        app.buttons["foundation-run"].tap()
        Thread.sleep(forTimeInterval: 2.2)
        try host("stop-property-groups-ios")
        try host("save-foundations-groups")
    }
    func testDrawingBatch() throws {
        launch("drawing")
        try host("start-drawing-batch-ios")
        app.buttons["foundation-run"].tap()
        Thread.sleep(forTimeInterval: 1.5)
        app.buttons["foundation-run"].tap()
        Thread.sleep(forTimeInterval: 1.5)
        app.buttons["foundation-indicator"].tap()
        Thread.sleep(forTimeInterval: 1.2)
        app.buttons["foundation-pause"].tap()
        app.buttons["foundation-indicator"].tap()
        Thread.sleep(forTimeInterval: 0.8)
        app.buttons["foundation-resume"].tap()
        Thread.sleep(forTimeInterval: 0.8)
        app.buttons["foundation-remount"].tap()
        app.buttons["foundation-run"].tap()
        Thread.sleep(forTimeInterval: 1.3)
        try host("stop-drawing-batch-ios")
        try host("save-foundations-drawing")
    }
    func testPointerHover() throws {
        launch("pointer")
        let region = app.otherElements["foundation-region"].firstMatch
        XCTAssertTrue(region.waitForExistence(timeout: 5))
        try host("start-pointer-ios")
        XCTAssertNil(JoltPointerTrace(region.frame))
        app.buttons["foundation-tap"].hover()
        app.buttons["foundation-tap"].click()
        app.buttons["foundation-run"].tap()
        XCTAssertNil(JoltPointerTrace(region.frame))
        Thread.sleep(forTimeInterval: 0.8)
        app.buttons["foundation-remount"].tap()
        XCTAssertNil(JoltPointerTrace(region.frame))
        Thread.sleep(forTimeInterval: 0.8)
        app.buttons["foundation-tap"].hover()
        try host("stop-pointer-ios")
        try host("save-foundations-pointer")
    }
    func testShapeBounds() throws {
        app.launchArguments = ["--portable-lab=shape", "--portable-audit", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(app.buttons["portable-both"].waitForExistence(timeout: 30))
        try host("start-shape-bounds-ios")
        for mode in ["scale", "rotate", "both"] {
            app.buttons["portable-" + mode].tap()
            Thread.sleep(forTimeInterval: 3)
        }
        try host("stop-shape-bounds-ios")
        try host("save-shape")
    }
    func testPressRecording() throws {
        app.launchArguments = ["--portable-lab=press", "--portable-audit", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(app.buttons["portable-button"].waitForExistence(timeout: 30))
        app.buttons["portable-scoped"].tap()
        try host("start-press-lifecycle-ios")
        for _ in 0..<2 { app.buttons["portable-button"].tap(); Thread.sleep(forTimeInterval: 0.6) }
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 0.7)
        app.activate()
        app.buttons["portable-button"].tap()
        app.buttons["portable-remount"].tap()
        app.buttons["portable-button"].tap()
        Thread.sleep(forTimeInterval: 0.8)
        try host("stop-press-lifecycle-ios")
        try host("save-lifecycle")
    }
    func testPressHeld() throws {
        app.launchArguments = ["--portable-lab=press", "--portable-audit", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(app.buttons["portable-button"].waitForExistence(timeout: 30))
        for variant in ["plain", "direct", "scoped", "repeated"] {
            app.buttons["portable-" + variant].tap()
            let button = app.buttons["portable-button"]
            let point = CGPoint(x: button.frame.midX, y: button.frame.midY)
            let delivered = expectation(description: "held press delivered")
            DispatchQueue.global().async {
                XCTAssertNil(JoltNavigationHold(point, 0, UIInterfaceOrientation.portrait.rawValue))
                delivered.fulfill()
            }
            Thread.sleep(forTimeInterval: 0.5)
            // XCTest refuses a second concurrent gesture. The host activates
            // Settings while the real OS contact path is still held.
            try host("background")
            wait(for: [delivered], timeout: 12)
            app.activate()
            Thread.sleep(forTimeInterval: 0.3)
            app.buttons["portable-snapshot"].tap()
        }
        try host("save-held")
    }
    func testPressLifecycle() throws {
        app.launchArguments = ["--portable-lab=press", "--portable-audit", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(app.buttons["portable-button"].waitForExistence(timeout: 30))
        for variant in ["plain", "direct", "scoped", "repeated"] {
            app.buttons["portable-" + variant].tap()
            Thread.sleep(forTimeInterval: 0.3)
            for _ in 0..<3 {
                let button = app.buttons["portable-button"]
                let point = CGPoint(x: button.frame.midX, y: button.frame.midY)
                XCTAssertNil(JoltNativeTap(point))
                Thread.sleep(forTimeInterval: 0.05)
                XCUIDevice.shared.press(.home)
                Thread.sleep(forTimeInterval: 0.6)
                app.activate()
                Thread.sleep(forTimeInterval: 0.3)
                app.buttons["portable-snapshot"].tap()
            }
            app.buttons["portable-remount"].tap()
            Thread.sleep(forTimeInterval: 0.3)
            app.buttons["portable-button"].tap()
            app.buttons["portable-snapshot"].tap()
        }
        try host("save-lifecycle")
    }
}
