import XCTest

/// Actual touch input. XCTest's retained recording is exported by the host.
final class DocsTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.benchmark")
    func item(_ name: String) -> XCUIElement { app.descendants(matching: .any)["scroll-header-" + name].firstMatch }
    func tap(_ name: String, wait: Double = 0.2) {
        let frame = item(name).frame
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap()
        Thread.sleep(forTimeInterval: wait)
    }
    func snapshot(_ name: String) { tap("snapshot"); print("JOLT_CHECK " + name) }
    func pull(_ distance: CGFloat? = nil) {
        let frame = item("list").frame
        let start = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.minY + frame.height * 0.18))
        let end = start.withOffset(CGVector(dx: 0, dy: distance ?? frame.height * 0.7))
        start.press(forDuration: 0.05, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.2)
    }
    func status(_ expected: String) {
        let test = NSPredicate(format: "label == %@", expected)
        expectation(for: test, evaluatedWith: item("refresh-status"))
        waitForExpectations(timeout: 10)
    }
    @MainActor func testRefresh() throws {
        continueAfterFailure = false
        app.launchArguments = ["--showcase-example=scroll-header", "--scroll-header-audit", "--showcase-audit", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(item("list").waitForExistence(timeout: 15))
        Thread.sleep(forTimeInterval: 5)
        snapshot("initial")
        tap("slow-refresh")
        print("JOLT_RECORD_START \(Date().timeIntervalSince1970)")
        pull(22)
        Thread.sleep(forTimeInterval: 0.8)
        snapshot("short-pull")
        pull()
        snapshot("loading")
        tap("refresh"); tap("refresh")
        status("Fresh tracks. Your place stays.")
        snapshot("success")
        tap("slow-refresh")
        tap("fail-refresh")
        pull()
        status("Could not refresh. Pull to try again.")
        snapshot("failure")
        pull()
        status("Fresh tracks. Your place stays.")
        snapshot("retry")
        tap("slow-refresh")
        tap("refresh")
        tap("jump", wait: 0.5)
        let frame=item("list").frame
        let start=app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX,dy: frame.minY+frame.height*0.8))
        start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx:0,dy:-frame.height*0.3)), withVelocity: .slow, thenHoldForDuration: 0.15)
        snapshot("scrolled-loading")
        status("Fresh tracks. Your place stays.")
        snapshot("anchored")
        tap("top",wait:1)
        tap("slow-refresh")
        tap("reduce")
        pull()
        snapshot("reduced-loading")
        status("Fresh tracks. Your place stays.")
        snapshot("reduced-success")
        tap("short",wait:0.5)
        pull()
        status("Fresh tracks. Your place stays.")
        snapshot("short-success")
        tap("empty",wait:0.5)
        pull()
        status("Fresh tracks. Your place stays.")
        snapshot("empty-success")
        Thread.sleep(forTimeInterval: 2)
        print("JOLT_RECORD_STOP \(Date().timeIntervalSince1970)")
        tap("slow-refresh")
        tap("refresh")
        tap("reload",wait:0.5)
        Thread.sleep(forTimeInterval:5)
        snapshot("unload-cancelled")
        tap("refresh")
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval:5)
        app.activate()
        Thread.sleep(forTimeInterval: 1)
        snapshot("background-cancelled")
        tap("refresh")
        app.staticTexts["Back to collection"].firstMatch.tap()
        Thread.sleep(forTimeInterval:5)
        XCTAssertFalse(item("list").exists)
    }
}
