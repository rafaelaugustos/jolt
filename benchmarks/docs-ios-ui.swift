import XCTest

/// Real OS input against the installed normal demo. The host records each named interval.
final class DocsTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.benchmark")
    let control = URL(fileURLWithPath: "/tmp/jolt-docs-recording-control")

    func cue(_ action: String, _ name: String) throws {
        let id = UUID().uuidString
        let data = try JSONSerialization.data(withJSONObject: ["id": id, "action": action, "name": name])
        try data.write(to: control.appendingPathComponent("request.json"), options: .atomic)
        for _ in 0..<400 {
            if let data = try? Data(contentsOf: control.appendingPathComponent("ack.json")),
               let reply = try? JSONSerialization.jsonObject(with: data) as? [String: String], reply["id"] == id { return }
            Thread.sleep(forTimeInterval: 0.1)
        }
        throw NSError(domain: "JoltRecording", code: 1, userInfo: [NSLocalizedDescriptionKey: "Host did not acknowledge \(name) \(action)"])
    }
    func record(_ name: String, _ body: () throws -> Void) throws {
        try cue("start", name)
        Thread.sleep(forTimeInterval: 0.7)
        try body()
        Thread.sleep(forTimeInterval: 1)
        try cue("stop", name)
    }
    func launch(_ args: [String], _ ready: String) {
        app.terminate()
        app.launchArguments = args
        app.launch()
        XCTAssertTrue(app.descendants(matching: .any)[ready].firstMatch.waitForExistence(timeout: 15), app.debugDescription)
        Thread.sleep(forTimeInterval: 1)
    }
    func tap(_ title: String, wait: Double = 0.8) {
        let element = app.descendants(matching: .any)[title].firstMatch
        XCTAssertTrue(element.exists, app.debugDescription)
        element.tap()
        Thread.sleep(forTimeInterval: wait)
    }
    func drag(_ element: XCUIElement, x: CGFloat, y: CGFloat) {
        let start = element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        start.press(forDuration: 0.15, thenDragTo: start.withOffset(CGVector(dx: x, dy: y)), withVelocity: .slow, thenHoldForDuration: 0.15)
        Thread.sleep(forTimeInterval: 0.8)
    }
    func testLayout() throws {
        launch(["--layout-lab"], "layout-card-1")
        try record("layout-ios") {
            tap("Insert"); tap("Remove"); tap("Reverse")
            tap("layout-card-1"); tap("layout-card-1"); tap("Reverse")
            XCTAssertEqual(app.buttons["layout-card-1"].frame.height, 54, accuracy: 3)
        }
    }
    func testInteraction() throws {
        launch(["--layout-lab"], "layout-card-1")
        tap("Slow layout", wait: 0.2)
        try record("interaction-surface-ios") {
            tap("Reverse", wait: 0.6)
            let card = app.buttons["layout-card-1"].frame
            app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: card.midX, dy: card.midY)).tap()
            XCTAssertTrue(app.staticTexts["Settled · Card 1"].waitForExistence(timeout: 7))
            XCTAssertEqual(app.buttons["layout-card-1"].frame.height, 100, accuracy: 3)
            tap("Normal layout"); tap("layout-card-1")
        }
    }
    func testDrag() throws {
        launch(["--drag-lab"], "Drag card")
        try record("drag-ios") {
            let card = app.otherElements["Drag card"].firstMatch
            let panel = app.otherElements["Drag panel"].firstMatch
            drag(card, x: 145, y: 0); drag(card, x: -180, y: 0)
            drag(panel, x: 0, y: 130); drag(panel, x: 0, y: -65); drag(panel, x: 0, y: -75)
            XCTAssertTrue(app.staticTexts["Panel settled · 0"].waitForExistence(timeout: 5))
        }
    }
    func testStates() throws {
        launch(["--playground", "--section=motion"], "Upload")
        try record("motion-controllers-ios") {
            tap("Upload"); tap("Error"); tap("Retry"); tap("Success")
            tap("Pause scope"); tap("Resume scope")
            tap("Unmount card"); tap("Mount card"); tap("Upload"); tap("Cancel")
            XCTAssertTrue(app.staticTexts["idle · settled"].waitForExistence(timeout: 5))
        }
    }
    func testImageEffects() throws {
        launch(["--image-lab=effects"], "Ripple")
        try record("image-effects-ios") {
            tap("Ripple", wait: 1.8)
            tap("Drag warp", wait: 0.2)
            let photo = app.images["Color grid, pinch to zoom or use the zoom controls"]
            XCTAssertTrue(photo.exists, app.debugDescription)
            drag(photo, x: 65, y: 75)
            tap("Restore", wait: 0.3)
            tap("Dissolve", wait: 2.8)
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "finished")).firstMatch.exists)
        }
    }
    func testZoom() throws {
        launch(["--image-lab=zoom"], "Zoom in")
        try record("photo-zoom-ios") {
            let photo = app.images["Color grid, pinch to zoom or use the zoom controls"]
            XCTAssertTrue(photo.exists, app.debugDescription)
            photo.pinch(withScale: 2, velocity: 1)
            Thread.sleep(forTimeInterval: 0.8)
            drag(photo, x: -65, y: 55)
            tap("Reset zoom")
            photo.doubleTap(); Thread.sleep(forTimeInterval: 0.8)
            tap("Reset zoom")
            drag(photo, x: 0, y: 150)
            tap("Cancel close")
        }
    }
    func testLiquid() throws {
        launch(["--screen=voice"], "Pause voice preview")
        try record("liquid-ios") {
            Thread.sleep(forTimeInterval: 6)
            tap("Pause voice preview", wait: 1.5)
            tap("Resume voice preview", wait: 4)
        }
    }
    func testScroll() throws {
        launch(["--playground"], "Scroll to collapse ↓")
        try record("scroll-linked-ios") {
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.55))
            start.press(forDuration: 0.1, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -190)), withVelocity: .slow, thenHoldForDuration: 0.2)
            Thread.sleep(forTimeInterval: 1)
            let end = start.withOffset(CGVector(dx: 0, dy: -190))
            end.press(forDuration: 0.1, thenDragTo: start, withVelocity: .slow, thenHoldForDuration: 0.2)
            Thread.sleep(forTimeInterval: 1)
        }
    }
    func testInterrupting() throws {
        // Use the demo's existing launch control to slow playback, then inject real taps.
        launch(["--playground", "--section=springs", "--tap=⅕×", "--every=100"], "bouncy")
        try record("interrupting-ios") {
            tap("bouncy", wait: 0.1)
            tap("bouncy", wait: 0.1)
            tap("bouncy", wait: 1.8)
            tap("smooth", wait: 0.1)
            tap("bouncy", wait: 2)
        }
    }
    func testHaptics() throws {
        launch(["--playground", "--section=haptics"], "light")
        try record("haptics-ios") {
            tap("light"); tap("medium"); tap("heavy")
            // The playground also has an offscreen SF Symbol named Bounce.
            let bounce = app.buttons.matching(identifier: "Bounce").allElementsBoundByIndex.first { $0.isHittable }
            XCTAssertNotNil(bounce)
            bounce?.tap()
            Thread.sleep(forTimeInterval: 1.4)
            XCTAssertTrue(app.staticTexts["Haptics"].isHittable)
        }
    }
}
