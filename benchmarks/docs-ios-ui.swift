import XCTest

/// Real OS input against the installed normal demo. The host records each named interval.
final class DocsTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.benchmark")
    let control = URL(fileURLWithPath: "/tmp/jolt-docs-recording-control-" + (ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "unknown"))

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
    func reorderDrag(_ id: String, toY: CGFloat, hold: TimeInterval = 0.2, fast: Bool = false) {
        let handle = app.descendants(matching: .any)[id].firstMatch
        XCTAssertTrue(handle.exists, app.debugDescription)
        // A dropped handle may be partially clipped at an edge. Touch its visible area.
        let visible = handle.frame.intersection(app.descendants(matching: .any)["reorder-list"].firstMatch.frame)
        XCTAssertFalse(visible.isEmpty, app.debugDescription)
        let start = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: visible.midX, dy: visible.midY))
        let destination = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: visible.midX, dy: toY))
        start.press(forDuration: 0.55, thenDragTo: destination, withVelocity: fast ? .fast : .slow, thenHoldForDuration: hold)
        Thread.sleep(forTimeInterval: 0.6)
    }
    func testGravity() throws {
        languageLaunch("en", "language-settings"); selectLanguage("system")
        languageLaunch("en", "gravity-lab", ["--showcase-example=gravity"])
        try record("gravity-ios") {
            tap("gravity-drop", wait: 3.8)
            tap("gravity-toss", wait: 0.2)
            tap("gravity-pause", wait: 0.7)
            tap("gravity-pause", wait: 1.2)
            tap("gravity-return", wait: 0.8)
            tap("gravity-mood-0", wait: 2)
            tap("gravity-mood-2", wait: 1.2)
            tap("gravity-reduce"); tap("gravity-drop")
        }
        tap("gravity-reduce")
    }
    func testGravityChecks() throws {
        languageLaunch("en", "gravity-lab", ["--showcase-example=gravity", "--gravity-audit"])
        tap("gravity-drop", wait: 0.15)
        tap("gravity-pause", wait: 0.4)
        tap("gravity-snapshot")
        tap("gravity-pause", wait: 0.2)
        tap("gravity-snapshot")
        tap("gravity-return", wait: 0.8)
        tap("gravity-snapshot")
        tap("gravity-mood-2", wait: 1)
        tap("gravity-snapshot")
        tap("gravity-toss", wait: 1.5)
        tap("gravity-snapshot")
        tap("gravity-reduce"); tap("gravity-drop"); tap("gravity-snapshot")
        tap("gravity-reduce"); tap("gravity-mood-1", wait: 0.1)
        XCUIDevice.shared.press(.home); Thread.sleep(forTimeInterval: 0.6)
        app.activate(); Thread.sleep(forTimeInterval: 0.4)
        tap("gravity-snapshot")
        tap("Back to collection")
        XCTAssertFalse(app.descendants(matching: .any)["gravity-lab"].firstMatch.exists)
    }
    func sensorDemo(_ language: String) throws {
        languageLaunch(language, "language-settings")
        selectLanguage("system")
        languageLaunch(language, "sensor-lab", ["--showcase-example=device-sensors"])
        try record("device-sensors-ios" + (language == "en" ? "" : "-pt")) {
            tap("sensor-preview", wait: 3)
            tap("sensor-pause", wait: 1.5)
            tap("sensor-pause", wait: 3)
            tap("sensor-center", wait: 1.5)
            tap("sensor-reduce", wait: 1)
            tap("sensor-reduce", wait: 2)
        }
    }
    func testDeviceSensors() throws { try sensorDemo("en") }
    func testDeviceSensorsPortuguese() throws { try sensorDemo("pt-BR") }
    func testDeviceSensorChecks() throws {
        languageLaunch("en", "sensor-lab", ["--showcase-example=device-sensors", "--sensors-audit"])
        tap("sensor-preview", wait: 2)
        tap("sensor-snapshot")
        tap("sensor-busy", wait: 0.2)
        tap("sensor-pause", wait: 1)
        tap("sensor-snapshot")
        tap("sensor-pause", wait: 1)
        tap("sensor-snapshot")
        tap("sensor-reduce", wait: 1)
        tap("sensor-snapshot")
        tap("sensor-reduce")
        tap("sensor-preview", wait: 1)
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 1)
        app.activate()
        Thread.sleep(forTimeInterval: 1)
        tap("sensor-snapshot")
        tap("sensor-center")
        tap("sensor-snapshot")
        app.descendants(matching: .any)["Back to collection"].firstMatch.tap()
        Thread.sleep(forTimeInterval: 1)
        XCTAssertFalse(app.descendants(matching: .any)["sensor-lab"].firstMatch.exists)
    }
    func scrollHeaderDemo(_ language: String) throws {
        languageLaunch(language, "language-settings")
        selectLanguage("system")
        languageLaunch(language, "scroll-header-list", ["--showcase-example=scroll-header"])
        let list = app.descendants(matching: .any)["scroll-header-list"].firstMatch
        try record("scroll-header-ios" + (language == "en" ? "" : "-pt")) {
            let start = list.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
            for distance: CGFloat in [80, -180, 90] {
                start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: distance)), withVelocity: .slow, thenHoldForDuration: 0.05)
                Thread.sleep(forTimeInterval: 0.6)
            }
            list.swipeUp(velocity: .fast); Thread.sleep(forTimeInterval: 1)
            tap("scroll-header-cover", wait: 1)
            tap("scroll-header-add")
            tap("scroll-header-jump", wait: 1)
            tap("scroll-header-top", wait: 1.2)
            tap("scroll-header-details")
        }
    }
    func testScrollHeader() throws { try scrollHeaderDemo("en") }
    func testScrollHeaderPortuguese() throws { try scrollHeaderDemo("pt-BR") }

    func testShowcaseExtraLanguages() throws {
        languageLaunch("en", "language-settings"); selectLanguage("en")
        try record("showcase-languages-ios") {
            for (language, collection, open, back, studio) in [
                ("es", "Colección", "Abrir Hecho para deslizar", "Volver a la colección", "Studio"),
                ("zh-Hans", "合集", "打开 为滚动而生", "返回合集", "工作室")
            ] {
                tap("language-settings")
                if language == "zh-Hans" { app.scrollViews.firstMatch.swipeUp(); Thread.sleep(forTimeInterval: 0.3) }
                tap("language-" + language); tap("language-back")
                tap(collection); tap(open)
                let list = app.descendants(matching: .any)["scroll-header-list"].firstMatch
                list.swipeUp(); Thread.sleep(forTimeInterval: 0.7)
                tap("scroll-header-cover"); tap("scroll-header-top")
                tap(back); tap(studio)
            }
            tap("language-settings")
        }
        app.scrollViews.firstMatch.swipeDown(); tap("language-system");tap("language-back")
    }
    func testShowcaseExtraLanguageChecks() throws {
        languageLaunch("en", "language-settings"); selectLanguage("system")
        languageLaunch("es-MX", "scroll-header-list", ["--showcase-example=scroll-header"])
        XCTAssertTrue(app.staticTexts["Mareas suaves."].exists)
        languageLaunch("zh-CN", "scroll-header-list", ["--showcase-example=scroll-header"])
        XCTAssertTrue(app.staticTexts["轻柔潮汐。"].exists)
        languageLaunch("en", "language-settings"); selectLanguage("es")
        languageLaunch("zh-CN", "scroll-header-list", ["--showcase-example=scroll-header"])
        XCTAssertTrue(app.staticTexts["Mareas suaves."].exists)
        languageLaunch("en", "language-settings"); selectLanguage("system")
    }

    func testScrollHeaderChecks() throws {
        languageLaunch("en", "language-settings"); selectLanguage("system")
        languageLaunch("en", "scroll-header-list", ["--showcase-example=scroll-header", "--scroll-header-audit"])
        let list = app.descendants(matching: .any)["scroll-header-list"].firstMatch
        let start = list.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.72))
        for distance: CGFloat in [90, -185, 100, -200] {
            start.press(forDuration: 0.05, thenDragTo: start.withOffset(CGVector(dx: 0, dy: distance)), withVelocity: .slow, thenHoldForDuration: 0.05)
            Thread.sleep(forTimeInterval: 0.6)
        }
        list.swipeUp(velocity: .fast); Thread.sleep(forTimeInterval: 1)
        tap("scroll-header-snapshot"); tap("scroll-header-cover"); tap("scroll-header-add")
        tap("scroll-header-jump", wait: 1)
        tap("scroll-header-snapshot")
        let pinned = app.descendants(matching: .any)["scroll-header-section"].firstMatch
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: 110, dy: pinned.frame.maxY + 38)).tap()
        tap("scroll-header-snapshot")
        XCUIDevice.shared.orientation = .landscapeLeft; Thread.sleep(forTimeInterval: 1)
        XCUIDevice.shared.orientation = .portrait; Thread.sleep(forTimeInterval: 1)
        tap("scroll-header-snapshot")
        XCUIDevice.shared.press(.home); Thread.sleep(forTimeInterval: 0.5); app.activate()
        tap("scroll-header-snapshot")
        tap("scroll-header-reduce"); tap("scroll-header-top"); tap("scroll-header-snapshot")
        tap("scroll-header-short"); tap("scroll-header-jump"); tap("scroll-header-snapshot")
        tap("scroll-header-empty"); tap("scroll-header-jump"); tap("scroll-header-snapshot")
        tap("Back to collection")
        XCTAssertFalse(app.descendants(matching: .any)["scroll-header-list"].firstMatch.exists)
    }

    func testInteractionReplayChecks() throws {
        launch(["--interaction-replay", "--replay-checks"], "replay-card")
        XCTAssertTrue(app.staticTexts["Native regressions passed"].waitForExistence(timeout: 25), app.debugDescription)
    }
    func testCurveSampling() throws {
        launch(["--curve-sampling"], "sampling-play")
        let dot = app.descendants(matching: .any)["sampling-adaptive"].firstMatch
        XCTAssertGreaterThan(dot.frame.height, 20, app.debugDescription)
        XCTAssertLessThan(dot.frame.maxY, app.buttons["sampling-play"].firstMatch.frame.minY, app.debugDescription)
        try record("curve-sampling-ios") {
            tap("sampling-play", wait: 1.8)
            tap("sampling-play", wait: 1.8)
            tap("sampling-slow", wait: 0.4)
            tap("sampling-play", wait: 4.3)
            tap("sampling-fast", wait: 0.4)
            tap("sampling-play", wait: 1.8)
        }
        tap("sampling-checks", wait: 0.2)
        XCTAssertTrue(app.staticTexts["Native precision checked"].waitForExistence(timeout: 25), app.debugDescription)
    }
    func testMotionInspector() throws {
        launch(["--motion-inspector"], "inspector-replay")
        let dot = app.descendants(matching: .any)["inspector-card"].firstMatch
        XCTAssertGreaterThan(dot.frame.height, 30, app.debugDescription)
        let duration = app.sliders["inspector-duration"].firstMatch
        duration.adjust(toNormalizedSliderPosition: 0.95)
        app.sliders["inspector-bounce"].firstMatch.adjust(toNormalizedSliderPosition: 0.65)
        let savedDuration = app.staticTexts["inspector-duration-value"].label
        try record("motion-inspector-ios") {
            tap("inspector-spring", wait: 0.15)
            tap("inspector-interrupt", wait: 0.5)
            tap("inspector-replay", wait: 0.1)
            tap("inspector-scrub", wait: 0.5)
            XCTAssertTrue(app.staticTexts["Paused at 25%. Explicit edit."].exists, app.debugDescription)
            tap("inspector-scrub", wait: 0.8)
            tap("inspector-layers", wait: 0.7)
            tap("inspector-sequence", wait: 1.7)
            tap("inspector-binding", wait: 1.2)
            tap("inspector-copy", wait: 0.5)
            XCTAssertTrue(app.staticTexts["TypeScript copied. Settings saved."].exists, app.debugDescription)
        }
        launch(["--motion-inspector"], "inspector-replay")
        XCTAssertEqual(app.staticTexts["inspector-duration-value"].label, savedDuration)
        launch(["--motion-inspector", "--inspector-checks"], "inspector-card")
        XCTAssertTrue(app.staticTexts["Inspector checks passed"].waitForExistence(timeout: 25), app.debugDescription)
    }
    func testMotionInspectorPortuguese() throws {
        languageLaunch("pt-BR", "language-settings")
        selectLanguage("system")
        languageLaunch("pt-BR", "inspector-replay", ["--showcase-example=motion-inspector"])
        XCTAssertTrue(app.staticTexts["Movimento, explicado."].exists, app.debugDescription)
        tap("inspector-binding", wait: 0.6)
        XCTAssertTrue(app.staticTexts["inspector-graph"].label.contains("Progresso"), app.debugDescription)
        tap("inspector-copy", wait: 0.4)
        XCTAssertTrue(app.staticTexts["TypeScript copiado. Ajustes salvos."].exists, app.debugDescription)
    }
    func testCurveSamplingPortuguese() throws {
        languageLaunch("pt-BR", "language-settings")
        selectLanguage("system")
        languageLaunch("pt-BR", "sampling-play", ["--showcase-example=curve-sampling"])
        XCTAssertTrue(app.buttons["sampling-play"].firstMatch.isHittable, app.debugDescription)
        tap("sampling-play", wait: 2)
        tap("sampling-slow", wait: 0.4)
        XCTAssertTrue(app.staticTexts["Movimento suave"].exists, app.debugDescription)
        tap("sampling-checks", wait: 0.2)
        XCTAssertTrue(app.staticTexts["Precisão nativa conferida"].waitForExistence(timeout: 25), app.debugDescription)
    }
    func testScrollHandoffReplay() throws {
        launch(["--scroll-handoff"], "handoff-record")
        try record("scroll-handoff-replay-ios") {
            tap("handoff-record", wait: 0.3)
            let sheet = app.descendants(matching: .any)["handoff-sheet"].firstMatch
            let scroll = app.scrollViews["handoff-scroll"].firstMatch
            XCTAssertTrue(scroll.exists, app.debugDescription)
            let before = sheet.frame.minY
            drag(scroll, x: 0, y: 160)
            XCTAssertGreaterThan(sheet.frame.minY, before + 20, "The scroll never handed the contact to the sheet")
            drag(scroll, x: 0, y: -150)
            XCTAssertLessThan(sheet.frame.minY, before + 5, "The sheet did not expand before scrolling")
            tap("handoff-finish", wait: 0.3)
            tap("handoff-replay", wait: 0.2)
            XCTAssertTrue(app.staticTexts["Replay matched"].waitForExistence(timeout: 30), app.debugDescription)
            tap("handoff-break", wait: 0.2)
            XCTAssertTrue(app.staticTexts["Ownership regression caught"].waitForExistence(timeout: 30), app.debugDescription)
        }
    }
    func testScrollHandoffReplayChecks() throws {
        launch(["--scroll-handoff", "--handoff-checks"], "handoff-record")
        XCTAssertTrue(app.staticTexts["Native regressions passed"].waitForExistence(timeout: 25), app.debugDescription)
    }
    func testScrollHandoffPortuguese() throws {
        languageLaunch("pt-BR", "language-settings")
        selectLanguage("system")
        languageLaunch("pt-BR", "open-handoff", ["--showcase-example=interaction-replay"])
        tap("open-handoff")
        let start = app.buttons["handoff-record"].firstMatch
        XCTAssertTrue(start.isHittable, app.debugDescription)
        tap("handoff-record", wait: 0.3)
        drag(app.scrollViews["handoff-scroll"].firstMatch, x: 0, y: 150)
        tap("handoff-finish", wait: 0.3)
        tap("handoff-replay", wait: 0.2)
        XCTAssertTrue(app.staticTexts["Replay conferido"].waitForExistence(timeout: 30), app.debugDescription)
    }
    func testInteractionReplay() throws {
        launch(["--interaction-replay"], "replay-card")
        try record("interaction-replay-ios") {
            tap("record-spring", wait: 0.3)
            tap("replay-right", wait: 0.1)
            tap("replay-left", wait: 1.7)
            tap("replay-finish", wait: 0.3)
            tap("replay-run", wait: 0.2)
            XCTAssertTrue(app.staticTexts["Replay matched"].waitForExistence(timeout: 30), app.debugDescription)
            tap("replay-break", wait: 0.2)
            XCTAssertTrue(app.staticTexts["Regression caught"].waitForExistence(timeout: 30), app.debugDescription)
            tap("record-drag", wait: 0.3)
            drag(app.descendants(matching: .any)["replay-card"].firstMatch, x: 150, y: 0)
            tap("replay-finish", wait: 0.3)
            tap("replay-run", wait: 0.2)
            XCTAssertTrue(app.staticTexts["Replay matched"].waitForExistence(timeout: 30), app.debugDescription)
        }
    }
    func testInteractionReplayPortuguese() throws {
        languageLaunch("pt-BR", "language-settings")
        selectLanguage("system")
        languageLaunch("pt-BR", "replay-card", ["--showcase-example=interaction-replay"])
        try record("interaction-replay-pt-ios") {
            tap("record-spring", wait: 0.3)
            tap("replay-right", wait: 0.3)
            tap("replay-left", wait: 1.7)
            tap("replay-finish", wait: 0.3)
            tap("replay-run", wait: 0.2)
            XCTAssertTrue(app.staticTexts["Replay conferido"].waitForExistence(timeout: 30), app.debugDescription)
        }
    }
    func edgeBack(_ fraction: CGFloat) {
        let origin = app.coordinate(withNormalizedOffset: .zero)
        let start = origin.withOffset(CGVector(dx: 2, dy: app.frame.height * 0.53))
        let end = origin.withOffset(CGVector(dx: app.frame.width * fraction, dy: app.frame.height * 0.53))
        start.press(forDuration: 0.1, thenDragTo: end, withVelocity: .slow, thenHoldForDuration: 0.35)
        Thread.sleep(forTimeInterval: 1)
    }
    func testInteractiveNavigation() throws {
        languageLaunch("en", "language-settings")
        selectLanguage("en")
        languageLaunch("en", "interactive-open", ["--showcase-example=interactive-navigation"])
        try record("interactive-navigation-ios") {
            tap("interactive-open", wait: 1.2)
            edgeBack(0.3)
            XCTAssertEqual(app.staticTexts["interactive-detail-result"].label, "Changed your mind. Still here.", app.debugDescription)
            edgeBack(0.8)
            XCTAssertEqual(app.staticTexts["interactive-result"].label, "Back, on your terms.", app.debugDescription)
            tap("interactive-open", wait: 1.2)
            tap("interactive-back", wait: 1.2)
            XCTAssertTrue(app.descendants(matching: .any)["interactive-open"].firstMatch.exists)
        }
    }
    func testInteractiveNavigationPortuguese() throws {
        languageLaunch("pt-BR", "language-settings")
        selectLanguage("system")
        languageLaunch("pt-BR", "interactive-open", ["--showcase-example=interactive-navigation"])
        try record("interactive-navigation-pt-ios") {
            tap("interactive-open", wait: 1.2)
            edgeBack(0.3)
            XCTAssertEqual(app.staticTexts["interactive-detail-result"].label, "Mudou de ideia. Continua aqui.", app.debugDescription)
            edgeBack(0.8)
            XCTAssertEqual(app.staticTexts["interactive-result"].label, "De volta, do seu jeito.", app.debugDescription)
            tap("interactive-open", wait: 1.2)
            tap("interactive-back", wait: 1.2)
        }
    }
    func testInteractiveNavigationFlick() throws {
        launch(["--showcase-example=interactive-navigation", "--interactive-navigation-audit"], "interactive-open")
        tap("interactive-open", wait: 1.2)
        XCTAssertNil(JoltNavigationFlick(CGPoint(x: 2, y: app.frame.height * 0.53), app.frame.width * 0.3))
        Thread.sleep(forTimeInterval: 1)
        XCTAssertTrue(app.descendants(matching: .any)["interactive-open"].firstMatch.exists, app.debugDescription)
    }
    func testInteractiveNavigationChecks() throws {
        languageLaunch("en", "language-settings")
        selectLanguage("en")
        languageLaunch("en", "interactive-open", ["--showcase-example=interactive-navigation", "--interactive-navigation-audit"])
        tap("interactive-open", wait: 1.2)
        for _ in 0..<3 {
            edgeBack(0.27)
            XCTAssertEqual(app.staticTexts["interactive-detail-result"].label, "Changed your mind. Still here.", app.debugDescription)
        }
        tap("interactive-lock", wait: 0.2)
        edgeBack(0.8)
        XCTAssertTrue(app.descendants(matching: .any)["interactive-back"].firstMatch.exists, app.debugDescription)
        tap("interactive-lock", wait: 0.2)
        tap("interactive-cancel-next", wait: 0.2)
        edgeBack(0.8)
        XCTAssertEqual(app.staticTexts["interactive-detail-result"].label, "Changed your mind. Still here.", app.debugDescription)
        tap("interactive-nested", wait: 1.2)
        edgeBack(0.27)
        XCTAssertTrue(app.descendants(matching: .any)["interactive-back"].firstMatch.exists, app.debugDescription)
        edgeBack(0.8)
        XCTAssertTrue(app.descendants(matching: .any)["interactive-back"].firstMatch.exists, app.debugDescription)
        edgeBack(0.8)
        XCTAssertEqual(app.staticTexts["interactive-result"].label, "Back, on your terms.", app.debugDescription)
        tap("interactive-open", wait: 1.2)
        tap("interactive-back", wait: 1.2)
        tap("interactive-reduce", wait: 0.2)
        tap("interactive-open", wait: 0.6)
        edgeBack(0.8)
        XCTAssertTrue(app.descendants(matching: .any)["interactive-back"].firstMatch.exists, app.debugDescription)
        tap("interactive-back", wait: 0.6)
        tap("interactive-reduce", wait: 0.2)
        tap("interactive-open", wait: 1.2)
        XCTAssertNil(JoltNavigationFlick(CGPoint(x: 2, y: app.frame.height * 0.53), app.frame.width * 0.3))
        Thread.sleep(forTimeInterval: 1)
        XCTAssertTrue(app.descendants(matching: .any)["interactive-open"].firstMatch.exists, app.debugDescription)
        tap("interactive-open", wait: 1.2)
        tap("interactive-dispose", wait: 0.3)
        tap("interactive-back", wait: 1.2)
        XCTAssertTrue(app.descendants(matching: .any)["interactive-open"].firstMatch.exists, app.debugDescription)
    }
    func galleryStory() throws {
        tap("collection-place-1", wait: 1.1)
        let photo = app.descendants(matching: .any)["gallery-image"].firstMatch
        XCTAssertNil(JoltGestureTrace(CGPoint(x: photo.frame.midX, y: photo.frame.midY)))
        Thread.sleep(forTimeInterval: 0.8)
        tap("gallery-reset", wait: 0.8)
        XCTAssertNil(JoltPhotoInterrupt(CGPoint(x: photo.frame.midX, y: photo.frame.midY)))
        Thread.sleep(forTimeInterval: 0.7)
        tap("gallery-reset", wait: 0.8)
        drag(photo, x: 0, y: 40)
        XCTAssertTrue(photo.exists && photo.isHittable, app.debugDescription)
        tap("gallery-move", wait: 0.3)
        drag(photo, x: 0, y: 160)
        let returned = app.descendants(matching: .any)["collection-place-1"].firstMatch
        XCTAssertTrue(returned.waitForExistence(timeout: 4) && returned.isHittable, app.debugDescription)
        tap("collection-place-1", wait: 1.0)
        tap("gallery-remove", wait: 0.3)
        tap("gallery-close", wait: 1.2)
        XCTAssertTrue(app.descendants(matching: .any)["collection-grid"].firstMatch.exists, app.debugDescription)
    }
    func testGallery() throws {
        languageLaunch("en", "language-settings"); selectLanguage("en")
        languageLaunch("en", "collection-place-1", ["--showcase-example=gallery"])
        try record("gallery-ios") { try galleryStory() }
    }
    func testGalleryPortuguese() throws {
        languageLaunch("pt-BR", "language-settings"); selectLanguage("system")
        languageLaunch("pt-BR", "collection-place-1", ["--showcase-example=gallery"])
        try record("gallery-pt-ios") { try galleryStory() }
    }
    func testGalleryHandoffCheck() throws {
        launch(["--showcase-example=gallery", "--gallery-audit"], "collection-place-1")
        try record("gallery-handoff-check") { try galleryStory() }
    }
    func testGalleryLifecycle() throws {
        launch(["--showcase-example=gallery", "--gallery-audit", "--collection-audit"], "collection-place-1")
        tap("collection-place-1", wait: 1.0)
        tap("gallery-zoom")
        XCUIDevice.shared.orientation = .landscapeLeft
        Thread.sleep(forTimeInterval: 1)
        XCUIDevice.shared.orientation = .portrait
        Thread.sleep(forTimeInterval: 1)
        tap("gallery-reset")
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 0.5)
        app.activate()
        Thread.sleep(forTimeInterval: 0.8)
        tap("gallery-close", wait: 1.4)
        XCTAssertTrue(app.descendants(matching: .any)["collection-grid"].firstMatch.exists, app.debugDescription)
        for _ in 0..<3 {
            tap("collection-place-1", wait: 0.8)
            tap("gallery-close", wait: 1.2)
            XCTAssertTrue(app.descendants(matching: .any)["collection-place-1"].firstMatch.isHittable, app.debugDescription)
        }
    }
    func testGalleryChecks() throws {
        launch(["--showcase-example=gallery", "--gallery-audit", "--collection-audit"], "collection-place-1")
        tap("collection-place-1", wait: 0.05)
        tap("gallery-close", wait: 1.5)
        // UIKit may suppress a touch during its entry transition. A delivered
        // request queues; a subsequent accessible request must still pop once.
        if app.descendants(matching: .any)["gallery-close"].firstMatch.exists { tap("gallery-close", wait: 1.5) }
        XCTAssertTrue(app.descendants(matching: .any)["collection-grid"].firstMatch.exists, app.debugDescription)
        tap("collection-place-3", wait: 1.0)
        tap("gallery-zoom"); tap("gallery-close", wait: 1.5)
        XCTAssertTrue(app.descendants(matching: .any)["collection-place-3"].firstMatch.isHittable, app.debugDescription)
        tap("collection-place-4", wait: 1.0)
        edgeBack(0.3)
        XCTAssertTrue(app.descendants(matching: .any)["gallery-image"].firstMatch.exists, app.debugDescription)
        edgeBack(0.8)
        XCTAssertTrue(app.descendants(matching: .any)["collection-place-4"].firstMatch.isHittable, app.debugDescription)
        tap("collection-reduce")
        tap("collection-place-1", wait: 1.0)
        tap("gallery-close", wait: 1.0)
        XCTAssertTrue(app.descendants(matching: .any)["collection-place-1"].firstMatch.isHittable, app.debugDescription)
        launch(["--gallery-direct", "--gallery-audit"], "gallery-close")
        tap("gallery-close", wait: 1.0)
        XCTAssertTrue(app.descendants(matching: .any)["collection-grid"].firstMatch.waitForExistence(timeout: 4), app.debugDescription)
    }
    func returnTargetStory() throws {
        tap("collection-place-1", wait: 1.0)
        tap("collection-move", wait: 0.4)
        edgeBack(0.3)
        XCTAssertTrue(app.descendants(matching: .any)["collection-detail-image"].firstMatch.exists, app.debugDescription)
        edgeBack(0.8)
        let returned=app.descendants(matching: .any)["collection-place-1"].firstMatch
        XCTAssertTrue(returned.waitForExistence(timeout: 4) && returned.isHittable, app.debugDescription)
        tap("collection-place-1", wait: 1.0)
        tap("collection-remove", wait: 0.3)
        tap("collection-back", wait: 1.4)
        XCTAssertTrue(app.descendants(matching: .any)["collection-grid"].firstMatch.exists, app.debugDescription)
        XCTAssertFalse(app.descendants(matching: .any)["collection-place-1"].firstMatch.exists, app.debugDescription)
    }
    func testReturnTargets() throws {
        languageLaunch("en", "language-settings"); selectLanguage("en")
        languageLaunch("en", "collection-place-1", ["--showcase-example=return-targets"])
        try record("return-targets-ios") { try returnTargetStory() }
    }
    func testReturnTargetsChecks() throws {
        launch(["--showcase-example=return-targets", "--collection-audit"], "collection-place-1")
        try returnTargetStory()
        tap("collection-reset")
        tap("collection-reduce")
        tap("collection-place-1")
        tap("collection-back")
        XCTAssertTrue(app.descendants(matching: .any)["collection-place-1"].firstMatch.isHittable, app.debugDescription)
    }
    func testReturnTargetsPortuguese() throws {
        languageLaunch("pt-BR", "language-settings"); selectLanguage("system")
        languageLaunch("pt-BR", "collection-place-1", ["--showcase-example=return-targets"])
        try record("return-targets-pt-ios") { try returnTargetStory() }
    }
    func sharedEntryStory() throws {
        tap("shared-entry-photo", wait: 1.1)
        edgeBack(0.3)
        XCTAssertTrue(app.descendants(matching: .any)["shared-entry-detail-image"].firstMatch.exists, app.debugDescription)
        edgeBack(0.8)
        XCTAssertTrue(app.descendants(matching: .any)["shared-entry-photo"].firstMatch.exists, app.debugDescription)
        tap("shared-entry-pass", wait: 1.1)
        edgeBack(0.3)
        XCTAssertTrue(app.descendants(matching: .any)["shared-entry-detail-pass"].firstMatch.exists, app.debugDescription)
        tap("shared-entry-back", wait: 1.1)
    }
    func testSharedEntry() throws {
        languageLaunch("en", "language-settings"); selectLanguage("en")
        languageLaunch("en", "shared-entry-photo", ["--showcase-example=shared-entry"])
        try record("shared-entry-ios") { try sharedEntryStory() }
    }
    func testSharedEntryPortuguese() throws {
        languageLaunch("pt-BR", "language-settings"); selectLanguage("system")
        languageLaunch("pt-BR", "shared-entry-photo", ["--showcase-example=shared-entry"])
        try record("shared-entry-pt-ios") { try sharedEntryStory() }
    }
    func testSharedEntryChecks() throws {
        languageLaunch("en", "language-settings"); selectLanguage("en")
        languageLaunch("en", "shared-entry-photo", ["--showcase-example=shared-entry", "--shared-entry-audit"])
        try sharedEntryStory()
        tap("shared-entry-photo", wait: 1.1)
        tap("shared-entry-lock", wait: 0.2);edgeBack(0.8)
        XCTAssertTrue(app.descendants(matching: .any)["shared-entry-detail-image"].firstMatch.exists)
        tap("shared-entry-lock", wait: 0.2)
        tap("shared-entry-cancel", wait: 0.2);edgeBack(0.8)
        XCTAssertTrue(app.descendants(matching: .any)["shared-entry-detail-image"].firstMatch.exists)
        tap("shared-entry-move-return", wait: 0.2);edgeBack(0.8)
        tap("shared-entry-missing", wait: 0.2);tap("shared-entry-photo", wait: 1.1);tap("shared-entry-back", wait: 1.1)
        tap("shared-entry-missing", wait: 0.2);tap("shared-entry-reduce", wait: 0.2)
        tap("shared-entry-photo", wait: 0.7);tap("shared-entry-back", wait: 0.7)
        tap("shared-entry-reduce", wait: 0.2);tap("shared-entry-photo", wait: 1.1)
        tap("shared-entry-dispose", wait: 0.2);tap("shared-entry-back", wait: 1.1)
        XCTAssertTrue(app.descendants(matching: .any)["shared-entry-photo"].firstMatch.exists)
    }
    func testSharedNavigation() throws {
        languageLaunch("en", "language-settings")
        selectLanguage("en")
        languageLaunch("en", "navigation-photo", ["--showcase-example=shared-navigation"])
        try record("shared-navigation-ios") {
            tap("navigation-photo", wait: 1.8)
            tap("navigation-back", wait: 1.8)
            XCTAssertEqual(app.staticTexts["navigation-result"].firstMatch.label, "Connected, there and back.", app.debugDescription)
            tap("navigation-pass", wait: 1.8)
            tap("navigation-back", wait: 1.8)
            XCTAssertEqual(app.staticTexts["navigation-result"].firstMatch.label, "Connected, there and back.", app.debugDescription)
        }
        languageLaunch("en", "navigation-photo", ["--showcase-example=shared-navigation", "--shared-navigation-audit"])
        tap("navigation-photo", wait: 1.8)
        tap("navigation-move-return", wait: 0.2)
        tap("navigation-back", wait: 1.8)
        XCTAssertEqual(app.staticTexts["navigation-result"].firstMatch.label, "Connected, there and back.", app.debugDescription)
        tap("navigation-missing", wait: 0.2)
        tap("navigation-photo", wait: 1.0)
        tap("navigation-back", wait: 1.0)
        tap("navigation-missing", wait: 0.2)
        tap("navigation-reduce", wait: 0.2)
        tap("navigation-photo", wait: 1.0)
        tap("navigation-back", wait: 1.0)
        XCTAssertEqual(app.staticTexts["navigation-result"].firstMatch.label, "Reduced motion. Same destination.", app.debugDescription)
    }
    func testSharedNavigationPortuguese() throws {
        languageLaunch("pt-BR", "language-settings")
        selectLanguage("system")
        languageLaunch("pt-BR", "navigation-photo", ["--showcase-example=shared-navigation"])
        try record("shared-navigation-pt-ios") {
            tap("navigation-photo", wait: 1.8)
            tap("navigation-back", wait: 1.8)
            XCTAssertEqual(app.staticTexts["navigation-result"].firstMatch.label, "Conectados, na ida e na volta.", app.debugDescription)
            tap("navigation-pass", wait: 1.8)
            tap("navigation-back", wait: 1.8)
        }
    }
    func testSharedLayout() throws {
        launch(["--shared-layout", "--shared-layout-audit"], "shared-toggle")
        try record("shared-layout-ios") {
            tap("shared-tab-1", wait: 1.3)
            tap("shared-tab-2", wait: 1.3)
            tap("shared-tab-0", wait: 1.3)
            tap("shared-toggle", wait: 1.5)
            tap("shared-toggle", wait: 1.5)
            tap("shared-reverse", wait: 1.7)
            tap("shared-toggle", wait: 1.5)
        }
    }
    func testSharedLayoutPortuguese() throws {
        languageLaunch("pt-BR", "language-settings")
        selectLanguage("system")
        languageLaunch("pt-BR", "shared-toggle", ["--showcase-example=shared-layout", "--shared-layout-audit"])
        try record("shared-layout-pt-ios") {
            tap("shared-tab-1", wait: 1.3)
            tap("shared-toggle", wait: 1.5)
            tap("shared-toggle", wait: 1.5)
            tap("shared-reverse", wait: 1.7)
        }
    }
    func testSharedLayoutChecks() throws {
        launch(["--shared-layout", "--shared-layout-checks"], "shared-toggle")
        tap("shared-tab-1", wait: 1.5)
        XCTAssertTrue(app.staticTexts["completed"].exists, app.debugDescription)
        tap("Slow next")
        tap("shared-toggle", wait: 0.15)
        tap("Verify native", wait: 0.15)
        XCTAssertTrue(app.staticTexts["Native state active"].exists, app.debugDescription)
        Thread.sleep(forTimeInterval: 3)
        tap("Verify native")
        XCTAssertTrue(app.staticTexts["Native state clean"].exists, app.debugDescription)
        tap("shared-reverse", wait: 2)
        XCTAssertTrue(app.staticTexts["completed"].exists, app.debugDescription)
        tap("Cancel", wait: 1)
        XCTAssertTrue(app.staticTexts["cancelled"].exists, app.debugDescription)
        tap("Remove target", wait: 1)
        XCTAssertTrue(app.staticTexts["missing-target"].exists, app.debugDescription)
        tap("Reset")
        tap("Reduce motion")
        tap("shared-toggle", wait: 1)
        XCTAssertTrue(app.staticTexts["reduced-motion"].exists, app.debugDescription)
        tap("Reduce motion")
        tap("Slow next")
        tap("shared-toggle", wait: 0.1)
        XCUIDevice.shared.orientation = .landscapeLeft
        Thread.sleep(forTimeInterval: 0.5)
        XCUIDevice.shared.orientation = .portrait
        Thread.sleep(forTimeInterval: 1)
        XCTAssertTrue(app.staticTexts["geometry-changed"].exists, app.debugDescription)
        tap("Verify native")
        XCTAssertTrue(app.staticTexts["Native state clean"].exists, app.debugDescription)
        tap("Slow next")
        tap("shared-toggle", wait: 0.1)
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 0.5)
        app.activate()
        Thread.sleep(forTimeInterval: 0.5)
        XCTAssertTrue(app.staticTexts["suspended"].exists, app.debugDescription)
        tap("Verify native")
        XCTAssertTrue(app.staticTexts["Native state clean"].exists, app.debugDescription)
    }
    func testReorder() throws {
        launch(["--reorder-lab", "--reorder-audit"], "reorder-list")
        try record("reorder-ios") {
            let list = app.descendants(matching: .any)["reorder-list"].firstMatch
            reorderDrag("handle-track-1", toY: list.frame.minY + 320)
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'position' ")).firstMatch.exists, app.debugDescription)
            tap("reorder-up")
            tap("reorder-down")
            tap("reorder-reset")
            reorderDrag("handle-track-2", toY: list.frame.maxY - 18, hold: 2.5)
            reorderDrag("handle-track-2", toY: list.frame.minY + 18, hold: 1.5, fast: true)
            tap("reorder-reset")
        }
    }
    func testReorderCancellation() throws {
        launch(["--reorder-lab", "--reorder-checks"], "reorder-list")
        let list = app.descendants(matching: .any)["reorder-list"].firstMatch
        tap("Cancel next")
        reorderDrag("handle-track-1", toY: list.frame.minY + 150, hold: 1)
        tap("Verify native")
        XCTAssertTrue(app.staticTexts["Native state clean"].exists)
        tap("Remove next")
        reorderDrag("handle-track-1", toY: list.frame.minY + 150, hold: 1)
        XCTAssertTrue(app.staticTexts["199 TRACKS"].exists)
        tap("Verify native")
        XCTAssertTrue(app.staticTexts["Native state clean"].exists)
        tap("reorder-reset")
        tap("Resize next")
        reorderDrag("handle-track-1", toY: list.frame.minY + 150, hold: 1)
        tap("Verify native")
        XCTAssertTrue(app.staticTexts["Native state clean"].exists)
        tap("reorder-reset")
        tap("Reduce motion")
        reorderDrag("handle-track-1", toY: list.frame.minY + 180)
        tap("Verify native")
        XCTAssertTrue(app.staticTexts["Native state clean"].exists)
    }

    func testReorderActions() throws {
        launch(["--reorder-lab", "--reorder-checks"], "reorder-list")
        tap("reorder-reset")
        tap("Move action")
        tap("Move action")
        XCTAssertEqual(app.staticTexts["reorder-status"].label, "First light · position 3", app.debugDescription)
        tap("reorder-reset")
        tap("handle-track-1")
        app.typeKey(XCUIKeyboardKey.downArrow.rawValue, modifierFlags: .option)
        Thread.sleep(forTimeInterval: 0.8)
        app.typeKey(XCUIKeyboardKey.downArrow.rawValue, modifierFlags: .option)
        Thread.sleep(forTimeInterval: 0.8)
        XCTAssertEqual(app.staticTexts["reorder-status"].label, "First light · position 3", app.debugDescription)
        tap("Verify native")
        XCTAssertTrue(app.staticTexts["Native state clean"].exists)
    }

    func testReorderFast() throws {
        launch(["--reorder-lab", "--reorder-checks"], "reorder-list")
        tap("Verify native")
        XCTAssertTrue(app.staticTexts["Native state clean"].exists)
        let list = app.descendants(matching: .any)["reorder-list"].firstMatch
        reorderDrag("handle-track-2", toY: list.frame.maxY - 18, hold: 2.5, fast: true)
        let before = app.staticTexts["reorder-status"].label
        let position = Int(before.components(separatedBy: "position ").last ?? "") ?? 0
        XCTAssertGreaterThan(position, 10, before)
        tap("Verify native")
        XCTAssertTrue(app.staticTexts["Native state clean"].exists)
        reorderDrag("handle-track-2", toY: list.frame.minY + 18, hold: 1.5, fast: true)
        let after = app.staticTexts["reorder-status"].label
        XCTAssertLessThan(Int(after.components(separatedBy: "position ").last ?? "") ?? 200, position, after)
        tap("Verify native")
        XCTAssertTrue(app.staticTexts["Native state clean"].exists)
    }

    func testReorderPortuguese() throws {
        languageLaunch("pt-BR", "language-settings")
        selectLanguage("system")
        languageLaunch("pt-BR", "reorder-list", ["--showcase-example=reorder"])
        try record("reorder-pt-ios") {
            XCTAssertTrue(app.staticTexts["Seu ritmo. Sua ordem."].exists, app.debugDescription)
            let list = app.descendants(matching: .any)["reorder-list"].firstMatch
            reorderDrag("handle-track-1", toY: list.frame.minY + 220)
            tap("reorder-up")
            tap("reorder-reset")
        }
    }

    // Each clip is real native input in the embedded collection presentation.
    // Keep the isolated playground fixture recordings independent of this art direction.
    func exhibit(_ id: String, _ ready: String, _ actions: [(String, Double)]) throws {
        launch(["--showcase-example=" + id, "--showcase-audit"], ready)
        let before = XCTAttachment(screenshot: app.screenshot())
        before.name = "exhibit-" + id + "-before"
        before.lifetime = .keepAlways
        add(before)
        try record("exhibit-" + id) {
            for (label, delay) in actions { tap(label, wait: delay) }
        }
        let after = XCTAttachment(screenshot: app.screenshot())
        after.name = "exhibit-" + id + "-after"
        after.lifetime = .keepAlways
        add(after)
        XCTAssertEqual(app.state, .runningForeground, id)
    }
    func testExhibitMotion() throws {
        try exhibit("decay", "Free decay", [("Free decay", 1.2), ("Return", 1), ("Snap", 1.5)])
        try exhibit("stagger", "From the top", [("From the top", 1.4), ("From the center", 1.4)])
        try exhibit("motion-path", "Curve", [("Curve", 1), ("Pause", 0.8), ("Resume", 1), ("Orbit", 2.5)])
        try exhibit("timeline", "Overlap", [("Overlap", 2), ("In order", 3)])
        try exhibit("playback", "Play", [("Play", 1), ("Pause", 0.8), ("Play", 2.5)])
        try exhibit("loops", "Play", [("Play", 3), ("Stop", 0.6)])
        try exhibit("pauses", "Play pauses", [("Play pauses", 3.5), ("Stop pauses", 0.6)])
        try exhibit("random-pauses", "Stop idling", [("Stop idling", 0.6), ("Start idling", 5)])
        try exhibit("track-easing", "Bounce", [("Bounce", 1.7), ("Bounce", 1.7)])
        try exhibit("easing-curves", "Play curves", [("Play curves", 1.2), ("Play curves", 1.2)])
        try exhibit("tuning", "Playback speed", [("½×", 0.4), ("Play at selected speed", 2), ("Always", 0.4), ("Play at selected speed", 0.8)])
    }
    func testExhibitVisual() throws {
        try exhibit("gradients", "Play gradients", [("Play gradients", 2.5), ("Swap colors", 1.2), ("Stop gradients", 0.5)])
        try exhibit("gradient-directive", "Next mood", [("Next mood", 1.2), ("Next mood", 1.2)])
        try exhibit("gradient-values", "Travel", [("Travel", 1.4), ("Pause", 0.8), ("Resume", 1.7), ("Pulse", 1.2)])
        try exhibit("shimmer", "Stop shimmer", [("Resize", 1.4), ("Resize", 1.4), ("Stop shimmer", 0.5)])
        try exhibit("particles", "Snow", [("Snow", 2), ("Sparks", 1.5), ("Confetti", 1.8), ("Stop", 0.4)])
        try exhibit("loaders", "Stop loaders", [("Resize", 1.5), ("Resize", 1.5)])
        try exhibit("reveal", "Conceal", [("Duration: 500 ms", 0.4), ("Conceal", 1.7), ("Reveal", 1.7)])
        try exhibit("fade-overflow", "Fade out", [("Fade out", 1.3), ("Fade in", 1.3)])
        try exhibit("opacity-rotation", "Play orbit", [("Play orbit", 2.6), ("Slow motion", 2.5), ("Stop orbit", 0.5)])
    }
    func testExhibitType() throws {
        try exhibit("text", "Letters", [("Letters", 1.8), ("Words", 1.8)])
        try exhibit("rolling", "+ 1.10", [("+ 1.10", 1), ("Stagger: off", 0.4), ("Random", 1.7)])
        try exhibit("rolling-layout", "Next distance", [("Next distance", 1.2), ("Next distance", 1.2), ("Larger type", 0.5), ("Next distance", 1.2)])
        try exhibit("symbols", "Bounce", [("Bounce", 1), ("Pulse", 1), ("Scale", 1), ("Variable color", 1), ("Replace", 1)])
    }
    func testExhibitState() throws {
        try exhibit("motion-values", "Open sheet", [("Open sheet", 1.2), ("Close sheet", 1.2)])
        try exhibit("value-observers", "Play observers", [("Play observers", 1), ("Detach observer", 1), ("Attach observer", 1.5), ("Stop observers", 0.5)])
        try exhibit("value-layers", "Start base", [("Start base", 1), ("Add charge pulse", 1.5), ("Retarget base", 1.5), ("Reset values", 0.5)])
        try exhibit("layers", "Move", [("Breathe", 0.7), ("Move", 0.7), ("Shake", 1), ("Rest", 0.6)])
        try exhibit("motion-states", "Upload", [("Upload", 1), ("Error", 1), ("Retry", 1), ("Success", 1)])
        try exhibit("state-transitions", "Hide splash", [("Hide splash", 0.7), ("Show splash", 1.8)])
        try exhibit("busy-js", "Busy JavaScript", [])
        try exhibit("vue-adapter", "Hide row", [("Press with Vue", 0.7), ("Tilt with Vue", 0.7), ("Hide row", 0.7), ("Show row", 1), ("Change entrance", 1)])
        try exhibit("from-react-native", "Toss springs", [("Toss springs", 1.5), ("Toss springs", 1.5)])
    }
    func testExhibitLayout() throws {
        try exhibit("layout-lab", "Insert", [("Insert", 0.7), ("Reverse", 0.7), ("Layout card 1", 1), ("Remove", 0.7)])
        try exhibit("size-lab", "Expand", [("Collapse", 1.2), ("Expand", 1.2), ("Width", 1.2), ("Content", 1.2)])
        try exhibit("remount", "Switch layout", [("Switch layout", 1), ("Hide logo", 0.8), ("Show logo", 0.8), ("Switch layout", 1)])
        launch(["--showcase-example=list-items", "--showcase-audit"], "New items")
        try record("exhibit-list-items") {
            let list = app.descendants(matching: .any)["Animated playlist"].firstMatch
            list.swipeUp(); Thread.sleep(forTimeInterval: 1)
            list.swipeUp(); Thread.sleep(forTimeInterval: 1)
            tap("New items", wait: 1)
        }
        let list = XCTAttachment(screenshot: app.screenshot()); list.name = "exhibit-list-items"; list.lifetime = .keepAlways; add(list)
        launch(["--showcase-example=scroll-values", "--showcase-audit"], "Scroll values")
        try record("exhibit-scroll-values") {
            let list = app.descendants(matching: .any)["Scroll album tracks"].firstMatch
            list.swipeUp(); Thread.sleep(forTimeInterval: 1)
            list.swipeDown(); Thread.sleep(forTimeInterval: 1)
        }
        let scroll = XCTAttachment(screenshot: app.screenshot()); scroll.name = "exhibit-scroll-values"; scroll.lifetime = .keepAlways; add(scroll)
    }
    func testExhibitTouch() throws {
        launch(["--showcase-example=press", "--showcase-audit"], "Press softly")
        try record("exhibit-press") {
            for name in ["Press softly", "Dim on press", "Tilt on press"] {
                app.descendants(matching: .any)[name].firstMatch.press(forDuration: 0.6)
                Thread.sleep(forTimeInterval: 0.7)
            }
        }
        try exhibit("live-springs", "Target right", [("Target right", 0.7), ("Target left", 0.7), ("Target right", 0.3), ("Shake follower", 1.3)])
        try exhibit("drag-values", "Toggle sheet", [("Toggle sheet", 1.2), ("Toggle sheet", 1.2)])
        try exhibit("haptics", "light", [("light", 1.2), ("Bounce", 1.6), ("Stagger", 1.2)])
        launch(["--showcase-example=gesture-lab", "--showcase-audit"], "Photo")
        try record("exhibit-gesture-lab") {
            let surface = app.descendants(matching: .any)["Photo gesture surface"].firstMatch
            drag(surface, x: 50, y: 25)
            surface.pinch(withScale: 1.25, velocity: 1)
            Thread.sleep(forTimeInterval: 0.8)
            tap("Reset")
            tap("Carousel")
            drag(app.descendants(matching: .any)["Horizontal carousel"].firstMatch, x: -60, y: 0)
            tap("Sheet")
            drag(app.descendants(matching: .any)["Handoff panel"].firstMatch, x: 0, y: -130)
        }
        launch(["--showcase-example=drag-lab", "--showcase-audit"], "Drag card")
        try record("exhibit-drag-lab") {
            drag(app.descendants(matching: .any)["Drag card"].firstMatch, x: 75, y: 0)
            drag(app.descendants(matching: .any)["Drag panel"].firstMatch, x: 0, y: 95)
            tap("Pause drag")
            tap("Resume drag")
        }
        launch(["--showcase-example=keyboard", "--showcase-audit"], "Show composer")
        try record("exhibit-keyboard") {
            tap("Show composer")
            let field = app.textFields["Try the keyboard…"].firstMatch
            XCTAssertTrue(field.exists)
            field.tap(); field.typeText("Make something good.")
            Thread.sleep(forTimeInterval: 1)
            tap("Done")
        }
    }
    func testExhibitImageAndMap() throws {
        try exhibit("image-lab", "Ripple", [("Ripple", 1.6), ("Dissolve", 2.7), ("Restore", 0.5), ("Photo zoom", 0.5), ("Zoom in", 1.2), ("Reset zoom", 1)])
        try exhibit("playback-lab", "Play scene", [("Play scene", 2.3), ("Pause scene", 0.8), ("Resume scene", 6.2), ("Native map", 1.4), ("Play scene", 3), ("Stop scene", 0.5), ("3D camera", 1.5)])
    }

    func testExhibitCorrections() throws {
        try exhibit("opacity-rotation", "Play orbit", [("Play orbit", 2.6), ("Slow motion", 2.5), ("Stop orbit", 0.5)])
        try exhibit("loops", "Play", [("Play", 3), ("Stop", 0.6)])
        try exhibit("haptics", "light", [("light", 1.2), ("Bounce", 1.6), ("Stagger", 1.2)])
        try exhibit("rolling-layout", "Next distance", [("Next distance", 1.2), ("Next distance", 1.2), ("Larger type", 0.5), ("Next distance", 1.2)])
        try exhibit("vue-adapter", "Hide row", [("Press with Vue", 0.7), ("Tilt with Vue", 0.7), ("Hide row", 0.7), ("Show row", 1), ("Change entrance", 1)])
        try exhibit("from-react-native", "Toss springs", [("Toss springs", 1.5), ("Toss springs", 1.5)])
        launch(["--showcase-example=value-observers", "--showcase-audit"], "Play observers")
        let bound = app.descendants(matching: .any)["Bound signal"].firstMatch
        XCTAssertTrue(bound.isHittable, "Both signals must remain visible in the stage")
        try record("exhibit-value-observers") {
            tap("Play observers", wait: 0.6)
            // Core Animation moves presentation layers; XCTest frame reports model geometry.
            // Assert the layout here and inspect actual motion in the native recording.
            XCTAssertTrue(bound.isHittable)
            XCTAssertTrue(app.staticTexts["OBSERVED NATIVE OBJECT"].firstMatch.isHittable)
            tap("Detach observer", wait: 1)
            tap("Attach observer", wait: 1.5)
            tap("Stop observers")
        }
        launch(["--showcase-example=gesture-lab", "--showcase-audit"], "Photo")
        try record("exhibit-gesture-lab") {
            let surface = app.descendants(matching: .any)["Photo gesture surface"].firstMatch
            drag(surface, x: 50, y: 25)
            surface.pinch(withScale: 1.25, velocity: 1)
            Thread.sleep(forTimeInterval: 0.8)
            tap("Reset"); tap("Carousel")
            drag(app.descendants(matching: .any)["Horizontal carousel"].firstMatch, x: -60, y: 0)
            tap("Sheet")
            drag(app.descendants(matching: .any)["Handoff panel"].firstMatch, x: 0, y: -130)
        }
        launch(["--showcase-example=drag-lab", "--showcase-audit"], "Drag card")
        try record("exhibit-drag-lab") {
            drag(app.descendants(matching: .any)["Drag card"].firstMatch, x: 75, y: 0)
            drag(app.descendants(matching: .any)["Drag panel"].firstMatch, x: 0, y: 95)
            tap("Pause drag"); tap("Resume drag")
        }
    }

    func languageLaunch(_ language: String, _ ready: String, _ extra: [String] = []) {
        launch(["-AppleLanguages", "(" + language + ")", "--showcase-audit"] + extra, ready)
    }
    func selectLanguage(_ value: String) {
        tap("language-settings")
        tap("language-" + value)
        tap("language-back")
    }
    func testShowcaseAppearance() throws {
        try cue("appearance", "light")
        languageLaunch("en", "appearance-settings")
        selectLanguage("en")
        tap("appearance-settings")
        tap("appearance-light")
        XCTAssertTrue(app.staticTexts["appearance-current"].label.contains("Light"))
        try record("showcase-appearance-ios") {
            tap("appearance-dark", wait: 1.4)
            XCTAssertTrue(app.staticTexts["appearance-current"].label.contains("Dark"))
            tap("appearance-back")
            tap("Collection")
            let search = app.textFields["Search examples"].firstMatch
            search.tap(); search.typeText("spring\n")
            tap("Open Springs")
            tap("bouncy", wait: 1.5)
            tap("Back to collection")
            tap("Studio")
            tap("appearance-settings")
            tap("appearance-light", wait: 1.4)
            tap("appearance-back")
            tap("appearance-settings")
            tap("appearance-system", wait: 1)
            try cue("appearance", "dark")
            Thread.sleep(forTimeInterval: 1.5)
            XCTAssertTrue(app.staticTexts["appearance-current"].label.contains("Dark"))
            try cue("appearance", "light")
            Thread.sleep(forTimeInterval: 1.5)
            XCTAssertTrue(app.staticTexts["appearance-current"].label.contains("Light"))
        }
        // The manual choice survives relaunch and overrides a different system appearance.
        tap("appearance-dark")
        languageLaunch("en", "appearance-settings")
        tap("appearance-settings")
        XCTAssertTrue(app.staticTexts["appearance-current"].label.contains("Dark"))
        tap("appearance-system")
        XCTAssertTrue(app.staticTexts["appearance-current"].label.contains("Light"))
        tap("appearance-back")
        selectLanguage("pt-BR")
        tap("appearance-settings")
        tap("appearance-dark")
        XCTAssertTrue(app.staticTexts["appearance-current"].label.contains("escura"))
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "appearance-portuguese-dark"
        shot.lifetime = .keepAlways
        add(shot)
        tap("appearance-system")
        tap("appearance-back")
        selectLanguage("system")
    }
    func testShowcaseAppearanceReentry() throws {
        languageLaunch("en", "appearance-settings")
        selectLanguage("en")
        tap("appearance-settings"); tap("appearance-system")
        XCUIDevice.shared.press(.home)
        try cue("appearance", "dark")
        app.activate()
        let resumedTheme = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label CONTAINS %@", "Dark"),
            object: app.staticTexts["appearance-current"]
        )
        XCTAssertEqual(XCTWaiter.wait(for: [resumedTheme], timeout: 5), .completed)
        tap("appearance-light", wait: 0)
        tap("appearance-dark", wait: 0)
        tap("appearance-back")
        tap("Collection")
        tap("Open Springs")
        tap("bouncy")
        tap("Back to collection"); tap("Studio")
        tap("appearance-settings"); tap("appearance-system")
        try cue("appearance", "light")
        Thread.sleep(forTimeInterval: 1)
        XCTAssertTrue(app.staticTexts["appearance-current"].label.contains("Light"))
        tap("appearance-back")
        selectLanguage("system")
    }
    func testShowcaseDarkScreens() throws {
        languageLaunch("en", "appearance-settings")
        selectLanguage("en")
        tap("appearance-settings"); tap("appearance-dark"); tap("appearance-back")
        let home = XCTAttachment(screenshot: app.screenshot())
        home.name = "dark-home"; home.lifetime = .keepAlways; add(home)
        for id in ["springs", "presets", "scene-camera", "rolling", "gesture-lab", "keyboard", "gradients", "motion-states"] {
            languageLaunch("en", "Back to collection", ["--showcase-example=" + id])
            Thread.sleep(forTimeInterval: 1)
            let shot = XCTAttachment(screenshot: app.screenshot())
            shot.name = "dark-" + id; shot.lifetime = .keepAlways; add(shot)
        }
        languageLaunch("en", "appearance-settings")
        tap("language-settings")
        let language = XCTAttachment(screenshot: app.screenshot())
        language.name = "dark-language"; language.lifetime = .keepAlways; add(language)
        tap("language-back")
        tap("appearance-settings"); tap("appearance-system"); tap("appearance-back")
        selectLanguage("system")
    }
    func testShowcaseLanguage() throws {
        languageLaunch("en", "language-settings")
        selectLanguage("en")
        try record("showcase-language-ios") {
            tap("language-settings")
            tap("language-pt-BR")
            XCTAssertTrue(app.staticTexts["Idioma atual: Português"].firstMatch.exists)
            tap("language-back")
            tap("Coleção")
            let search = app.textFields["Buscar exemplos"].firstMatch
            search.tap(); search.typeText("camera\n")
            XCTAssertTrue(app.descendants(matching: .any)["Abrir Lente da câmera"].firstMatch.exists)
            tap("Abrir Lente da câmera")
            tap("Selecionar Ampla", wait: 2.5)
            tap("Selecionar Detalhe", wait: 2.5)
            tap("Voltar à coleção")
            tap("Estúdio")
            tap("language-settings")
            tap("language-en")
            tap("language-back")
            XCTAssertTrue(app.staticTexts["Collection"].firstMatch.exists)
        }
        selectLanguage("system")
    }
    func testShowcaseLocaleDefaults() throws {
        languageLaunch("en", "language-settings")
        selectLanguage("system")
        languageLaunch("pt-BR", "Coleção")
        selectLanguage("en")
        languageLaunch("pt-BR", "Collection")
        selectLanguage("pt-BR")
        languageLaunch("en", "Coleção")
        selectLanguage("system")
        languageLaunch("en", "Collection")
        languageLaunch("pt-PT", "Coleção")
        languageLaunch("fr-FR", "Collection")
    }

    func testShowcasePortugueseCollection() throws {
        languageLaunch("pt-BR", "language-settings")
        selectLanguage("system")
        let examples: [(String, String)] = [
            ("springs", "Molas"),
            ("presets", "Presets"),
            ("decay", "Inércia"),
            ("stagger", "Em sequência"),
            ("motion-path", "Trajetórias"),
            ("timeline", "Sequências"),
            ("playback", "Reprodução"),
            ("loops", "Repetições"),
            ("pauses", "Pausas"),
            ("random-pauses", "Ritmo orgânico"),
            ("track-easing", "Curva do percurso"),
            ("easing-curves", "Curvas de movimento"),
            ("tuning", "Ajustes de movimento"),
            ("press", "Resposta ao toque"),
            ("gesture-lab", "Gestos nativos"),
            ("live-springs", "Molas conectadas"),
            ("drag-lab", "Arrastar e encaixar"),
            ("drag-values", "Arrastar um valor"),
            ("keyboard", "Teclado"),
            ("haptics", "Háptica"),
            ("colors", "Cores"),
            ("gradients", "Gradientes"),
            ("gradient-directive", "Diretiva de gradiente"),
            ("gradient-values", "Valores de gradiente"),
            ("decorations", "Formas e detalhes"),
            ("shimmer", "Brilho deslizante"),
            ("particles", "Partículas"),
            ("loaders", "Indicadores de espera"),
            ("reveal", "Revelações"),
            ("image-lab", "Imagens e zoom"),
            ("opacity-rotation", "Rastros de luz"),
            ("fade-overflow", "Transparência e limites"),
            ("text", "Texto animado"),
            ("rolling", "Números rolando"),
            ("rolling-layout", "Layout dos números"),
            ("symbols", "Símbolos"),
            ("layout-lab", "Mudanças de layout"),
            ("size-lab", "Dimensões reais"),
            ("list-items", "Listas"),
            ("scroll-values", "Valores de rolagem"),
            ("remount", "Remontagem"),
            ("motion-values", "Valores de movimento"),
            ("value-observers", "Observadores de valores"),
            ("value-layers", "Camadas de valores"),
            ("layers", "Camadas de animação"),
            ("motion-states", "Estados de movimento"),
            ("state-transitions", "Transições de estado"),
            ("busy-js", "JavaScript ocupado"),
            ("vue-adapter", "Integração com Vue"),
            ("from-react-native", "Comparação de molas"),
            ("scene-shader", "Ambiente e shaders"),
            ("scene-lighting", "Luzes e materiais"),
            ("scene-camera", "Lente da câmera"),
            ("playback-lab", "Mapas e 3D"),
        ]
        for (id, title) in examples {
            languageLaunch("pt-BR", title, ["--showcase-example=" + id])
            try record("showcase-pt-" + id) {
                switch id {
                case "springs": tap("elástica", wait: 1)
                case "gradient-directive": tap("Próximo clima", wait: 1)
                case "gesture-lab": tap("Carrossel"); tap("Painel")
                case "rolling": tap("+ 1,10", wait: 1.5)
                case "rolling-layout": tap("Próxima distância", wait: 1.2)
                case "motion-states": tap("Enviar"); tap("Sucesso", wait: 1)
                case "image-lab": tap("Ondas", wait: 1.5)
                case "playback-lab": tap("Reproduzir", wait: 2.5)
                case "scene-camera": tap("Selecionar Detalhe", wait: 2.5)
                case "scene-lighting": tap("Selecionar Hora dourada", wait: 2.5)
                case "scene-shader": tap("Selecionar Cabine", wait: 2.5)
                default: break
                }
            }
            XCTAssertEqual(app.state, .runningForeground, id)
        }
        languageLaunch("en", "Collection")
    }

    func testShowcasePortuguesePolish() throws {
        languageLaunch("pt-BR", "Rastros de luz", ["--showcase-example=opacity-rotation"])
        try record("showcase-pt-opacity-rotation") {
            tap("Reiniciar", wait: 1.5)
        }
        languageLaunch("pt-BR", "Dimensões reais", ["--showcase-example=size-lab"])
        try record("showcase-pt-size-lab") {
            XCTAssertTrue(app.staticTexts["StackLayout · dimensões reais"].firstMatch.exists)
        }
        languageLaunch("pt-BR", "JavaScript ocupado", ["--showcase-example=busy-js"])
        try record("showcase-pt-busy-js") { }
        languageLaunch("pt-BR", "Mapas e 3D", ["--showcase-example=playback-lab"])
        try record("showcase-pt-playback-lab") { tap("Reproduzir", wait: 2.5) }
        languageLaunch("en", "Collection")
    }

    func testShowcasePortugueseWrapping() throws {
        languageLaunch("pt-BR", "JavaScript ocupado", ["--showcase-example=busy-js"])
        try record("showcase-pt-busy-js") {
            let title = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Siga em")).firstMatch
            XCTAssertGreaterThan(title.frame.height, 70, "Both translated title lines must be visible")
        }
        languageLaunch("en", "Collection")
    }
    func testBottomSheet() throws {
        launch(["--bottom-sheet"], "Open stays")
        defer { XCUIDevice.shared.orientation = .portrait }
        try record("bottom-sheet-ios") {
            tap("Open stays")
            tap("Content")
            tap("More stays")
            tap("Open stays")
            let handle = app.descendants(matching: .any)["Stays sheet"].firstMatch
            XCTAssertNil(JoltSheetInterrupt(CGPoint(x: handle.frame.midX, y: handle.frame.midY)))
            Thread.sleep(forTimeInterval: 1)
            XCTAssertTrue(handle.isHittable)
            tap("Open stays")
            let before = handle.frame.minY
            let start = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: app.frame.midX, dy: handle.frame.maxY + 130))
            start.press(forDuration: 0.1, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -420)), withVelocity: .slow, thenHoldForDuration: 0.1)
            Thread.sleep(forTimeInterval: 0.8)
            XCTAssertLessThan(handle.frame.minY, before - 150)
            let list = app.scrollViews["Stay results"]
            list.swipeUp()
            Thread.sleep(forTimeInterval: 0.6)
            list.swipeDown()
            let upper = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: app.frame.midX, dy: handle.frame.maxY + 150))
            upper.press(forDuration: 0.1, thenDragTo: upper.withOffset(CGVector(dx: 0, dy: 380)), withVelocity: .slow, thenHoldForDuration: 0.1)
            Thread.sleep(forTimeInterval: 0.8)
            tap("Open stays")
            let field = app.textFields["Trip note"]
            field.tap()
            field.typeText("A calm weekend")
            XCTAssertTrue(field.isHittable)
            app.keyboards.buttons["Done"].tap()
            Thread.sleep(forTimeInterval: 0.8)
            tap("Close")
            tap("Open stays")
            tap("Close")
        }
        tap("Open stays")
        XCUIDevice.shared.orientation = .landscapeLeft
        Thread.sleep(forTimeInterval: 1)
        XCTAssertTrue(app.textFields["Trip note"].isHittable)
        XCTAssertEqual(app.textFields["Trip note"].value as? String, "A calm weekend")
        XCUIDevice.shared.orientation = .portrait
        Thread.sleep(forTimeInterval: 1)
        tap("Close")
    }

    func testShowcaseAudit() throws {
        let examples: [(String, String)] = [
            ("springs", "Springs"),
            ("presets", "Presets"),
            ("decay", "Momentum"),
            ("stagger", "Stagger"),
            ("motion-path", "Motion paths"),
            ("timeline", "Timelines"),
            ("playback", "Playback"),
            ("loops", "Loops"),
            ("pauses", "Pauses"),
            ("random-pauses", "Organic timing"),
            ("track-easing", "Track easing"),
            ("easing-curves", "Easing curves"),
            ("tuning", "Motion settings"),
            ("press", "Press feedback"),
            ("gesture-lab", "Native gestures"),
            ("live-springs", "Live springs"),
            ("drag-lab", "Drag & snap"),
            ("drag-values", "Drag a value"),
            ("keyboard", "Keyboard"),
            ("haptics", "Haptics"),
            ("colors", "Colors"),
            ("gradients", "Gradients"),
            ("gradient-directive", "Gradient directive"),
            ("gradient-values", "Gradient values"),
            ("decorations", "Decorations"),
            ("shimmer", "Shimmer"),
            ("particles", "Particles"),
            ("loaders", "Loaders"),
            ("reveal", "Reveals"),
            ("image-lab", "Images & zoom"),
            ("opacity-rotation", "Light trails"),
            ("fade-overflow", "Fade & overflow"),
            ("text", "Animated text"),
            ("rolling", "Rolling numbers"),
            ("rolling-layout", "Rolling layout"),
            ("symbols", "Symbols"),
            ("layout-lab", "Layout changes"),
            ("size-lab", "Real dimensions"),
            ("list-items", "Lists"),
            ("scroll-values", "Scroll values"),
            ("remount", "Remount"),
            ("motion-values", "Motion values"),
            ("value-observers", "Value observers"),
            ("value-layers", "Value layers"),
            ("layers", "Animation layers"),
            ("motion-states", "Motion states"),
            ("state-transitions", "State transitions"),
            ("busy-js", "Busy JavaScript"),
            ("vue-adapter", "Vue integration"),
            ("from-react-native", "Spring comparison"),
            ("scene-shader", "Environment & shaders"),
            ("scene-lighting", "Lights & materials"),
            ("scene-camera", "Camera lens"),
            ("playback-lab", "Maps & 3D")
        ]
        for (id, title) in examples {
            app.terminate()
            app.launchArguments = ["--showcase-example=" + id, "--showcase-audit"]
            app.launch()
            XCTAssertTrue(app.staticTexts[title].firstMatch.waitForExistence(timeout: 15), id + " " + app.debugDescription)
            Thread.sleep(forTimeInterval: 0.8)
            let screenshot = XCTAttachment(screenshot: app.screenshot())
            screenshot.name = id
            screenshot.lifetime = .keepAlways
            add(screenshot)
        }
    }

    func testAtelier() throws {
        launch(["--showcase-example=scene-camera", "--showcase-audit"], "Select Portrait")
        try record("showcase-atelier-ios") {
            tap("Select Wide", wait: 2.6)
            tap("Select Detail", wait: 0)
            tap("Hold halfway")
            tap("Resume motion", wait: 1.5)
            tap("Sage finish", wait: 1.2)
            tap("Select Portrait", wait: 2.6)
        }
        launch(["--showcase-example=scene-lighting", "--showcase-audit"], "Select Daylight")
        try record("showcase-lighting-ios") {
            tap("Select Golden hour", wait: 2.4)
            tap("Copper finish", wait: 1.3)
            tap("Select Midnight", wait: 2.4)
            tap("Select Daylight", wait: 2.4)
        }
        launch(["--showcase-example=scene-shader", "--showcase-audit"], "Select Studio")
        try record("showcase-shaders-ios") {
            tap("Select Cabin", wait: 2.4)
            tap("Select After dark", wait: 2.4)
            tap("Silver finish", wait: 1.3)
            tap("Select Studio", wait: 2.4)
        }
    }

    func testMotionStudio() throws {
        launch(["--showcase-example=springs", "--showcase-audit"], "bouncy")
        try record("showcase-springs-ios") {
            tap("bouncy", wait: 0.2)
            tap("snappy", wait: 0.2)
            tap("smooth", wait: 0.5)
            tap("bouncy", wait: 1.3)
        }
        launch(["--showcase-example=presets", "--showcase-audit"], "Play popIn")
        try record("showcase-presets-ios") {
            tap("Play popIn")
            tap("Play shake")
            tap("Play bounce")
            tap("Play pulse")
        }
        launch(["--showcase-example=colors", "--showcase-audit"], "Orchid")
        try record("showcase-colors-ios") {
            tap("Orchid", wait: 1.6)
            tap("Sky", wait: 1.6)
            tap("Moss", wait: 1.6)
        }
        launch(["--showcase-example=decorations", "--showcase-audit"], "Morph")
        try record("showcase-forms-ios") {
            tap("Morph", wait: 1.8)
            tap("Morph", wait: 0.6)
            tap("Stop here", wait: 1)
            tap("Morph", wait: 1.8)
        }
    }

    func testShowcaseInteriors() throws {
        let examples: [(String, String, String)] = [
            ("busy-js", "Made for Android", ""),
            ("drag-lab", "Unmount drags", ""),
            ("drag-values", "Toggle sheet", "Toggle sheet"),
            ("layout-lab", "Insert", "Insert"),
            ("size-lab", "Expand", "Expand"),
            ("image-lab", "Ripple", "Ripple"),
            ("playback-lab", "Play scene", "Play scene"),
            ("opacity-rotation", "Play orbit", "Play orbit")
        ]
        for (id, ready, action) in examples {
            launch(["--showcase-example=" + id, "--showcase-audit"], ready)
            try record("showcase-detail-" + id) {
                if !action.isEmpty { tap(action, wait: 1.8) }
                if id == "opacity-rotation" {
                    app.swipeUp()
                    tap("Slow motion", wait: 1)
                    tap("Stop orbit")
                }
                if id == "drag-values" { tap("Toggle sheet", wait: 1) }
                if id == "layout-lab" { tap("Reverse", wait: 1) }
                if id == "size-lab" { tap("Collapse", wait: 1) }
                let screenshot = XCTAttachment(screenshot: app.screenshot())
                screenshot.name = id
                screenshot.lifetime = .keepAlways
                add(screenshot)
            }
        }
    }

    func testShowcaseTrails() throws {
        launch(["--showcase-example=opacity-rotation", "--showcase-audit"], "Play orbit")
        try record("showcase-detail-opacity-rotation") {
            tap("Play orbit", wait: 1.8)
            app.swipeUp()
            tap("Slow motion", wait: 1)
            tap("Stop orbit")
        }
    }

    func testShowcasePlaybackTimeline() throws {
        launch(["--showcase-audit"], "Collection")
        tap("Collection")
        let search = app.textFields["Search examples"]
        search.tap()
        search.typeText("Maps\n")
        tap("Open Maps & 3D")
        try record("showcase-detail-playback-lab") {
            tap("Play scene", wait: 1.8)
        }
        tap("3D camera")
        XCTAssertTrue(app.descendants(matching: .any)["Jolt automotive studio"].firstMatch.exists)
    }

    func testShowcaseNativeReentry() throws {
        launch(["--showcase-audit"], "Collection")
        tap("Collection")
        let search = app.textFields["Search examples"]
        search.tap()
        search.typeText("SceneKit\n")
        try record("showcase-native-reentry-ios") {
            for title in ["Camera lens", "Lights & materials", "Environment & shaders", "Camera lens", "Maps & 3D", "Maps & 3D"] {
                tap("Open " + title, wait: 1.5)
                if title == "Maps & 3D" { tap("3D camera", wait: 1.5) }
                XCTAssertTrue(app.descendants(matching: .any)["Jolt automotive studio"].firstMatch.exists, title + " must mount its native scene")
                tap("Back to collection", wait: 0.5)
            }
        }
        search.tap()
        search.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: 8) + "Haptics\n")
        for _ in 0..<2 {
            tap("Open Haptics")
            XCTAssertTrue(app.buttons["light"].exists)
            tap("Back to collection")
        }
    }

    func testShowcaseCameraOrbit() throws {
        launch(["--showcase-audit"], "Collection")
        tap("Collection")
        let search = app.textFields["Search examples"]
        search.tap()
        search.typeText("Maps\n")
        tap("Open Maps & 3D")
        tap("3D camera")
        XCTAssertTrue(app.descendants(matching: .any)["Jolt automotive studio"].firstMatch.exists)
        tap("3D camera", wait: 0.2)
        XCTAssertTrue(app.buttons["Play scene"].isEnabled, "Selecting the active tab must keep playback ready")
        try record("showcase-camera-orbit-ios") {
            tap("Play scene", wait: 1.5)
            tap("Pause scene", wait: 0.2)
            let progress = app.staticTexts.matching(NSPredicate(format: "label ENDSWITH %@", "%")).firstMatch
            let held = progress.label
            XCTAssertNotEqual(held, "0%")
            Thread.sleep(forTimeInterval: 1)
            XCTAssertEqual(progress.label, held, "Progress must stay still while paused")
            tap("Resume scene", wait: 7)
            XCTAssertTrue(app.staticTexts["Finished"].exists)
            tap("Play scene", wait: 0.8)
            tap("Stop scene", wait: 0.4)
            XCTAssertTrue(app.staticTexts["Stopped"].exists)
            tap("Timeline", wait: 0.4)
            XCTAssertTrue(app.staticTexts["0%"].exists)
            tap("3D camera", wait: 0.5)
            XCTAssertTrue(app.descendants(matching: .any)["Jolt automotive studio"].firstMatch.exists)
            tap("Play scene", wait: 1.5)
            tap("Pause scene", wait: 0.5)
        }
        tap("Play scene", wait: 0.8)
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 0.5)
        app.activate()
        XCTAssertTrue(app.buttons["Resume scene"].waitForExistence(timeout: 10))
        tap("Resume scene", wait: 1)
        tap("Stop scene")
        // Exercise native-view disposal and rebinding across all three tabs.
        tap("Native map", wait: 0.5)
        XCTAssertTrue(app.staticTexts["0%"].exists)
        tap("3D camera", wait: 0.5)
        XCTAssertTrue(app.descendants(matching: .any)["Jolt automotive studio"].firstMatch.exists)
        tap("Play scene", wait: 0.7)
        tap("Stop scene")
        tap("Back to collection")
        XCTAssertTrue(app.descendants(matching: .any)["Open Maps & 3D"].firstMatch.exists)
        tap("Open Maps & 3D")
        tap("3D camera")
        XCTAssertTrue(app.descendants(matching: .any)["Jolt automotive studio"].firstMatch.exists)
    }

    func testShowcaseIconLaunch() throws {
        app.terminate()
        XCUIDevice.shared.press(.home)
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let icon = springboard.icons["Jolt"].firstMatch
        XCTAssertTrue(icon.waitForExistence(timeout: 10))
        for _ in 0..<3 {
            if icon.isHittable { break }
            springboard.swipeLeft()
        }
        XCTAssertTrue(icon.isHittable)
        icon.tap()
        XCTAssertTrue(app.staticTexts["Small details.\nBig feelings."].waitForExistence(timeout: 15), app.debugDescription)
    }

    func testShowcase() throws {
        app.terminate()
        app.launchArguments = []
        try record("showcase-ios") {
            app.launch()
            XCTAssertTrue(app.staticTexts["Small details.\nBig feelings."].waitForExistence(timeout: 15), app.debugDescription)
            Thread.sleep(forTimeInterval: 1)
            tap("Open Springs")
            tap("bouncy", wait: 0.25)
            tap("snappy", wait: 1)
            tap("Back to collection")
            tap("Collection")
            tap("Filter Touch")
            tap("Open Native gestures")
            let surface = app.descendants(matching: .any)["Photo gesture surface"].firstMatch
            if surface.exists { drag(surface, x: 45, y: 35) }
            tap("Back to collection")
            tap("Filter All")
            let search = app.textFields["Search examples"]
            search.tap()
            search.typeText("shader\n")
            tap("Open Environment & shaders")
            tap("Select Cabin", wait: 2.8)
            tap("Back to collection")
            tap("Studio")
        }
        // A cold launch without arguments must still enter the new collection.
        app.terminate()
        app.launchArguments = []
        app.launch()
        XCTAssertTrue(app.staticTexts["Small details.\nBig feelings."].waitForExistence(timeout: 15), app.debugDescription)
    }

    func testSceneShaderChecks() throws {
        launch(["--scene-shader", "--shader-checks=all"], "Check uniforms")
        XCTAssertTrue(app.staticTexts["Shader checks passed"].waitForExistence(timeout: 35), app.debugDescription)
    }
    func testSceneShaderBackground() throws {
        launch(["--scene-shader", "--shader-checks=background"], "Check uniforms")
        XCTAssertTrue(app.staticTexts["Shader background ready"].waitForExistence(timeout: 10), app.debugDescription)
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 1.5)
        app.activate()
        XCTAssertTrue(app.staticTexts["Shader checks passed"].waitForExistence(timeout: 15), app.debugDescription)
    }
    func testSceneShader() throws {
        launch(["--scene-shader"], "Enter cabin")
        try record("scene-shaders-ios") {
            tap("Enter cabin", wait: 1.2)
            tap("Pause scene", wait: 1)
            XCTAssertTrue(app.staticTexts["Paused."].exists)
            tap("Seek 50%", wait: 1)
            tap("Resume scene", wait: 2)
            tap("Studio light", wait: 3)
            tap("Swap environment", wait: 1)
            tap("Enter cabin", wait: 3)
            tap("Leave scene", wait: 0.5)
            XCTAssertTrue(app.staticTexts["Scene disposed."].exists)
            tap("Enter scene", wait: 1)
            tap("Enter cabin", wait: 3)
        }
        for _ in 0..<4 {
            tap("Leave scene", wait: 0.2)
            XCTAssertTrue(app.staticTexts["Scene disposed."].exists)
            tap("Enter scene", wait: 0.3)
            tap("Enter cabin", wait: 0.2)
        }
        tap("Leave scene")
    }
    func testOpacityRotation() throws {
        launch(["--opacity-rotation"], "Play orbit")
        try record("opacity-rotation-svg-parent-ios") {
            tap("Play orbit", wait: 12)
            tap("Stop orbit", wait: 1)
        }
        tap("Fade child")
        try record("opacity-rotation-svg-child-ios") {
            tap("Play orbit", wait: 8)
            tap("Stop orbit", wait: 1)
        }
        tap("Use plain views")
        tap("Fade container")
        try record("opacity-rotation-plain-parent-ios") {
            tap("Play orbit", wait: 8)
            tap("Stop orbit", wait: 1)
        }
    }
    func testSize() throws {
        launch(["--size-lab"], "Expand")
        try record("size-ios") {
            tap("Expand", wait: 1.4)
            tap("Width", wait: 1.4)
            tap("Width", wait: 1.4)
            tap("Content", wait: 1.4)
            tap("Content", wait: 1.4)
            tap("Collapse", wait: 1.4)
            tap("Speed 1x", wait: 0.2)
            tap("Expand", wait: 0.8)
            tap("Pause", wait: 0.7)
            let following = app.descendants(matching: .any)["Following row"].firstMatch
            XCTAssertTrue(following.exists, app.debugDescription)
            following.tap()
            XCTAssertTrue(app.staticTexts["Following row tapped 1"].exists, app.debugDescription)
            tap("Resume", wait: 0.5)
            tap("Collapse", wait: 4.6)
            tap("Speed 0.25x", wait: 0.2)
            tap("Stack", wait: 0.3)
            tap("Expand", wait: 1.4)
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Settled")).firstMatch.waitForExistence(timeout: 10), app.debugDescription)
            following.tap()
            XCTAssertTrue(app.staticTexts["Following row tapped 2"].exists, app.debugDescription)
            Thread.sleep(forTimeInterval: 3)
        }
    }
    func testGestureNavigation() throws {
        launch(["--gesture-lab", "--gesture-navigation-check"], "Photo")
        let surface = app.descendants(matching: .any)["Photo gesture surface"].firstMatch
        drag(surface, x: 80, y: -30)
        XCTAssertFalse(app.buttons["Photo"].exists, app.debugDescription)
        XCTAssertTrue(app.buttons["Native gestures"].exists, app.debugDescription)
    }
    func testGestureComposition() throws {
        launch(["--gesture-lab"], "Photo")
        try record("gesture-composition-ios") {
            let surface = app.descendants(matching: .any)["Photo gesture surface"].firstMatch
            XCTAssertTrue(surface.exists, app.debugDescription)
            XCTAssertNil(JoltGestureTrace(CGPoint(x: surface.frame.midX, y: surface.frame.midY)))
            Thread.sleep(forTimeInterval: 0.6)
            let state = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "x ")).firstMatch
            XCTAssertTrue(state.exists, app.debugDescription)
            print("JOLT_NATIVE_GESTURE_TRACE \(state.label)")
            let components = state.label.components(separatedBy: " · ")
            XCTAssertEqual(components.count, 4, state.label)
            if components.count == 4 {
                let x = Double(components[0].dropFirst(2)) ?? .nan
                let scale = Double(components[2].dropFirst(6)) ?? .nan
                let rotation = Double(components[3].dropFirst(7).dropLast()) ?? .nan
                XCTAssertTrue((35...75).contains(x), state.label)
                XCTAssertTrue((1.25...1.6).contains(scale), state.label)
                XCTAssertTrue((20...40).contains(rotation), state.label)
            }
            tap("Reset", wait: 0.3)
            drag(surface, x: 65, y: -45)
            surface.pinch(withScale: 1.5, velocity: 1)
            surface.rotate(.pi / 5, withVelocity: 1)
            Thread.sleep(forTimeInterval: 0.7)
            tap("Reset", wait: 0.3)
            surface.tap()
            Thread.sleep(forTimeInterval: 0.8)
            XCTAssertTrue(app.staticTexts["Single tap 1 · double taps 0"].exists, app.debugDescription)
            XCTAssertTrue(app.staticTexts["Existing tap listener: 1"].exists, app.debugDescription)
            surface.doubleTap()
            Thread.sleep(forTimeInterval: 0.8)
            XCTAssertTrue(app.staticTexts["Double tap 1 · single taps 1"].exists, app.debugDescription)
        }
        tap("Carousel")
        try record("gesture-carousel-ios") {
            let surface = app.descendants(matching: .any)["Horizontal carousel"].firstMatch
            drag(surface, x: 70, y: 0)
            drag(surface, x: 0, y: -160)
            app.scrollViews["Outer list"].swipeDown()
        }
        tap("Sheet")
        try record("gesture-handoff-ios") {
            let list = app.scrollViews["Inner list"]
            XCTAssertTrue(list.exists, app.debugDescription)
            let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.68))
            start.press(forDuration: 0.15, thenDragTo: start.withOffset(CGVector(dx: 0, dy: -330)), withVelocity: .slow, thenHoldForDuration: 0.2)
            Thread.sleep(forTimeInterval: 0.6)
            let upper = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.42))
            upper.press(forDuration: 0.15, thenDragTo: upper.withOffset(CGVector(dx: 0, dy: 330)), withVelocity: .slow, thenHoldForDuration: 0.2)
            Thread.sleep(forTimeInterval: 0.6)
        }
    }
    func testLiveSprings() throws {
        launch(["--live-springs"], "Target right")
        try record("live-springs-ios") {
            tap("Target right", wait: 0.25)
            tap("Target left", wait: 1.2)
            let lanes = app.descendants(matching: .any)["Spring lanes"].firstMatch
            XCTAssertTrue(lanes.exists, app.debugDescription)
            let left = lanes.coordinate(withNormalizedOffset: CGVector(dx: 0.12, dy: 0.12))
            let right = lanes.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.12))
            left.press(forDuration: 0.1, thenDragTo: right, withVelocity: .slow, thenHoldForDuration: 0.1)
            right.press(forDuration: 0.1, thenDragTo: left, withVelocity: .fast, thenHoldForDuration: 0.1)
            tap("Target right", wait: 0.2)
            tap("Shake follower", wait: 1.5)
            tap("Toggle reduced motion", wait: 0.2)
            tap("Target left", wait: 0.7)
            tap("Target right", wait: 0.7)
            tap("Toggle reduced motion", wait: 0.2)
            tap("Target left", wait: 2)
        }
    }
    func testSizeChecks() throws {
        launch(["--size-lab"], "Run size checks")
        tap("Run size checks", wait: 0.1)
        XCTAssertTrue(app.staticTexts["PASS · 20 native size checks"].waitForExistence(timeout: 60), app.debugDescription)
    }
    func testSizeRotation() throws {
        launch(["--size-lab"], "Expand")
        tap("Expand", wait: 0.4)
        XCUIDevice.shared.orientation = .landscapeLeft
        Thread.sleep(forTimeInterval: 1.5)
        XCUIDevice.shared.orientation = .portrait
        Thread.sleep(forTimeInterval: 1.5)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Settled")).firstMatch.exists, app.debugDescription)
        tap("Collapse", wait: 1.5)
        XCTAssertTrue(app.buttons["Expand"].isHittable)
    }
    func testOpacityRotationFade() throws {
        launch(["--opacity-rotation", "--ghost-pattern=fade"], "Play orbit")
        try record("opacity-rotation-fade-ios") {
            for _ in 0..<5 { tap("Play orbit", wait: 1.4) }
            tap("Stop orbit")
        }
    }
    func testOpacityRotationSplash() throws {
        launch(["--opacity-rotation"], "Replay splash")
        try record("opacity-rotation-splash-ios") {
            for _ in 0..<10 { tap("Replay splash", wait: 1) }
            tap("Stop orbit")
        }
    }
    func testOpacityRotationSlow() throws {
        launch(["--opacity-rotation"], "Slow motion")
        try record("opacity-rotation-slow-ios") {
            tap("Slow motion", wait: 10)
            tap("Stop orbit")
        }
    }
    func testControlledBackground() throws {
        launch(["--playback-lab=timeline"], "Play scene")
        tap("Play scene", wait: 1)
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 1)
        app.activate()
        XCTAssertTrue(app.staticTexts["Paused"].waitForExistence(timeout: 5))
        let percent=app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "^[0-9]+%$")).firstMatch
        let held=percent.label
        Thread.sleep(forTimeInterval: 1)
        XCTAssertEqual(percent.label,held)
        tap("Resume scene", wait: 1)
        XCTAssertTrue(app.staticTexts["Finished"].waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertEqual(app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "^[0-9]+%$")).firstMatch.label,"100%",app.debugDescription)
        tap("Stop scene")
    }
    func testNativePropertyChecks() throws {
        launch(["--playback-lab=timeline"], "Run native checks")
        tap("Run native checks", wait: 1)
        XCTAssertTrue(app.staticTexts["10 native checks passed"].waitForExistence(timeout: 30), app.debugDescription)
    }
    func testControlledPlayback() throws {
        launch(["--playback-lab=timeline"], "Play scene")
        try record("controlled-playback-ios") {
            tap("Play scene", wait: 1.8)
            tap("Pause scene", wait: 2.0)
            XCTAssertTrue(app.staticTexts["Paused"].exists)
            tap("Resume scene", wait: 3.0)
            tap("Pause scene", wait: 1.2)
            tap("Resume scene", wait: 4.0)
            XCTAssertTrue(app.staticTexts["Finished"].waitForExistence(timeout: 10), app.debugDescription)
        }
    }
    func testNativeMap() throws {
        launch(["--playback-lab=map"], "Play scene")
        Thread.sleep(forTimeInterval: 3)
        try record("native-map-ios") {
            tap("Play scene", wait: 2.0)
            tap("Pause scene", wait: 1.7)
            tap("Resume scene", wait: 7.0)
            XCTAssertTrue(app.staticTexts["Finished"].waitForExistence(timeout: 10), app.debugDescription)
        }
    }
    func testNativeCamera() throws {
        launch(["--playback-lab=scene"], "Play scene")
        try record("native-camera-ios") {
            tap("Play scene", wait: 2.0)
            tap("Pause scene", wait: 1.7)
            tap("Resume scene", wait: 7.0)
            XCTAssertTrue(app.staticTexts["Finished"].waitForExistence(timeout: 10), app.debugDescription)
        }
    }
    func testKeyboard() throws {
        launch(["--playground", "--section=keyboard"], "Show composer")
        try record("keyboard-ios") {
            tap("Show composer")
            let field = app.textFields.firstMatch
            XCTAssertTrue(field.waitForExistence(timeout: 5), app.debugDescription)
            field.tap()
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Keyboard · ")).firstMatch.waitForExistence(timeout: 5))
            Thread.sleep(forTimeInterval: 1.2)
            app.typeText("On my way")
            Thread.sleep(forTimeInterval: 0.6)
            tap("Send", wait: 1.5)
            XCTAssertTrue(app.staticTexts["Keyboard hidden"].waitForExistence(timeout: 5))
        }
    }
    func testPauses() throws {
        launch(["--playground", "--section=pauses"], "Play pauses")
        try record("repeat-delay-ios") {
            tap("Play pauses", wait: 7.5)
            tap("Stop pauses")
        }
    }
    func testTrackEasing() throws {
        launch(["--playground", "--section=track"], "Bounce")
        try record("ease-track-ios") {
            tap("Bounce", wait: 2.2)
            tap("Bounce", wait: 2.2)
        }
    }
    func testRecreated() throws {
        launch(["--playground", "--section=recreated"], "Switch layout")
        try record("recreated-views-ios") {
            Thread.sleep(forTimeInterval: 0.6)
            tap("Switch layout", wait: 1.2)
            tap("Switch layout", wait: 1.2)
            tap("Hide logo", wait: 1.2)
            tap("Switch layout", wait: 1.2)
            tap("Show logo", wait: 1.5)
            XCTAssertTrue(app.buttons["Hide logo"].exists)
        }
    }
    func testReactNative() throws {
        launch(["--playground", "--section=from react"], "Toss springs")
        try record("react-native-ios") {
            tap("Toss springs", wait: 1.8)
            tap("Toss springs", wait: 1.8)
            tap("Toss springs", wait: 0.25)
            tap("Toss springs", wait: 1.8)
        }
    }
    func testGradients() throws {
        launch(["--playground", "--section=gradients"], "Play gradients")
        try record("gradients-ios") {
            tap("Play gradients", wait: 4)
            tap("Swap colors", wait: 1.4)
            tap("Swap colors", wait: 1.4)
            tap("Stop gradients", wait: 1)
        }
    }
    func testMotionValues() throws {
        launch(["--playground", "--section=motion values"], "Open sheet")
        try record("motion-values-ios") {
            tap("Open sheet", wait: 1.3)
            tap("Close sheet", wait: 1.3)
            tap("Open sheet", wait: 1.3)
            tap("Close sheet", wait: 1.3)
        }
    }
    func testLayers() throws {
        launch(["--playground", "--section=layers"], "Breathe")
        try record("layers-ios") {
            tap("Breathe", wait: 1.2)
            tap("Move", wait: 0.9)
            tap("Shake", wait: 0.9)
            tap("Move", wait: 0.9)
            tap("Shake", wait: 0.9)
            drag(app.staticTexts["Drag me"], x: 70, y: 0)
            tap("Rest", wait: 1)
        }
    }
    func testValueConsumerChecks() throws {
        launch(["--playground", "--section=value observers", "--value-observer-checks"], "Play observers")
        XCTAssertTrue(app.staticTexts["Background check ready"].waitForExistence(timeout: 25), app.debugDescription)
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 1.5)
        app.activate()
        XCTAssertTrue(app.staticTexts["Passed value consumer checks"].waitForExistence(timeout: 8), app.debugDescription)
    }
    func testValueObservers() throws {
        launch(["--playground", "--section=value observers"], "Play observers")
        try record("value-observers-ios") {
            tap("Play observers", wait: 3.2)
            tap("Detach observer", wait: 2.4)
            tap("Attach observer", wait: 3.2)
            tap("Stop observers", wait: 1)
        }
    }
    func testRollingLayout() throws {
        launch(["--playground", "--section=rolling auto size"], "Check auto height")
        try record("rolling-layout-ios") {
            tap("Check auto height", wait: 0.5)
            XCTAssertTrue(app.staticTexts["Passed 18 layout checks"].waitForExistence(timeout: 25), app.debugDescription)
        }
    }
    func testValueLayers() throws {
        launch(["--playground", "--section=value layers"], "Start base")
        try record("value-layers-ios") {
            tap("Start base", wait: 1.3)
            tap("Add charge pulse", wait: 2.5)
            tap("Retarget base", wait: 1)
            tap("Remove charge pulse", wait: 1.3)
            tap("Retarget base", wait: 1)
            tap("Add charge pulse", wait: 2)
            tap("Reset values", wait: 1)
        }
    }
    func testScrollValues() throws {
        launch(["--playground", "--section=scroll values"], "Track 3")
        try record("scroll-values-ios") {
            drag(app.staticTexts["Track 3"], x: 0, y: -150)
            drag(app.staticTexts["Track 6"], x: 0, y: -150)
            drag(app.staticTexts["Track 8"], x: 0, y: 260)
        }
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
    func testDragValues() throws {
        launch(["--drag-values"], "Drag sheet")
        try record("drag-values-ios") {
            func pull(_ y: CGFloat) {
                let start = app.staticTexts["Now playing"].firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
                start.press(forDuration: 0.15, thenDragTo: start.withOffset(CGVector(dx: 0, dy: y)), withVelocity: .slow, thenHoldForDuration: 0.15)
                Thread.sleep(forTimeInterval: 1)
            }
            pull(-190)
            XCTAssertTrue(app.staticTexts["Half way"].waitForExistence(timeout: 3))
            pull(-190)
            XCTAssertTrue(app.staticTexts["Open"].waitForExistence(timeout: 3))
            pull(150)
            XCTAssertTrue(app.staticTexts["Half way"].waitForExistence(timeout: 3))
            pull(260)
            XCTAssertTrue(app.staticTexts["Closed"].waitForExistence(timeout: 3))
            tap("Toggle sheet", wait: 1.2)
            pull(-120)
            XCTAssertTrue(app.staticTexts["Open"].waitForExistence(timeout: 3))
            tap("Toggle sheet", wait: 2)
            XCTAssertTrue(app.staticTexts["Closed"].waitForExistence(timeout: 3))
        }
    }
    func testEasingCurves() throws {
        launch(["--playground", "--section=easing curves"], "Play curves")
        try record("easing-curves-ios") {
            tap("Play curves", wait: 1.6)
            tap("Play curves", wait: 1.6)
            tap("Play curves", wait: 1.6)
        }
    }
    func testStateTransitions() throws {
        launch(["--playground", "--section=per-target"], "Hide splash")
        try record("state-transitions-ios") {
            tap("Hide splash", wait: 0.9)
            tap("Show splash", wait: 1.8)
            tap("Hide splash", wait: 0.9)
            tap("Show splash", wait: 1.8)
        }
    }
    func testGradientDirective() throws {
        launch(["--playground", "--section=gradient directive"], "Next mood")
        try record("gradient-directive-ios") {
            tap("Next mood", wait: 1.2)
            tap("Next mood", wait: 1.2)
            tap("Next mood", wait: 1.2)
        }
    }
    func testRandomPauses() throws {
        launch(["--playground", "--section=random pauses"], "Stop idling")
        try record("random-pauses-ios") {
            Thread.sleep(forTimeInterval: 30)
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
    func testGradientValues() throws {
        launch(["--gradient-values"], "Travel")
        try record("gradient-values-ios") {
            let thumb = app.descendants(matching: .any)["Drag light"].firstMatch
            drag(thumb, x: 150, y: 0)
            tap("Travel", wait: 0.5)
            tap("Pulse", wait: 0.2)
            tap("Pause", wait: 0.4)
            XCTAssertTrue(app.staticTexts["Paused"].exists)
            tap("Seek 70%", wait: 0.4)
            tap("Resume", wait: 1.1)
            tap("Travel", wait: 0.5)
            tap("Hold", wait: 0.6)
            tap("Follow", wait: 0.5)
            tap("Switch type", wait: 0.5)
            tap("Rebind", wait: 0.4)
            tap("Resize", wait: 0.5)
            tap("Travel", wait: 3.2)
        }
    }
    func testParticles() throws {
        launch(["--particle-lab"], "Snow")
        try record("particles-ios") {
            tap("Snow", wait: 3)
            tap("Touch 0", wait: 0.2)
            XCTAssertTrue(app.buttons["Touch 1"].exists)
            tap("Resize", wait: 0.6)
            tap("Bubbles", wait: 3)
            tap("Touch 1", wait: 0.2)
            XCTAssertTrue(app.buttons["Touch 2"].exists)
            tap("Sparks", wait: 2)
            tap("Finite", wait: 2.4)
            tap("Confetti", wait: 0.3)
            tap("Touch 2", wait: 0.3)
            XCTAssertTrue(app.buttons["Touch 3"].exists)
            tap("Stop", wait: 0.4)
            tap("Motion on", wait: 0.3)
            tap("Snow", wait: 0.5)
            XCTAssertTrue(app.staticTexts["Reduced motion: effects removed."].exists)
            tap("Motion off", wait: 0.3)
            tap("Confetti", wait: 2.5)
        }
    }
    func testSceneCameraChecks() throws {
        launch(["--scene-camera"], "Check camera")
        tapScene("Check camera", wait: 0.1)
        XCTAssertTrue(app.staticTexts["Camera checks passed"].waitForExistence(timeout: 90), app.debugDescription)
    }
    func testSceneCameraBackground() throws {
        launch(["--scene-camera", "--camera-checks=background"], "Check camera")
        tapScene("Check camera", wait: 0.1)
        XCTAssertTrue(app.staticTexts["Camera background ready"].waitForExistence(timeout: 10))
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 1.5)
        app.activate()
        XCTAssertTrue(app.staticTexts["Camera checks passed"].waitForExistence(timeout: 20), app.debugDescription)
    }
    func testSceneCameraNavigation() throws {
        launch(["--scene-camera"], "Zoom in")
        for _ in 0..<5 {
            tapScene("Zoom in", wait: 0.2)
            tapScene("Leave camera", wait: 0.3)
            XCTAssertTrue(app.staticTexts["Camera scene disposed."].exists)
            tapScene("Enter camera", wait: 0.2)
        }
    }
    func testSceneCamera() throws {
        launch(["--scene-camera"], "Zoom in")
        try record("scene-camera-ios") {
            tapScene("Zoom in", wait: 3)
            tapScene("Pause camera", wait: 0.8)
            XCTAssertTrue(app.staticTexts["Camera, paint and light paused."].exists)
            tapScene("Resume camera", wait: 1)
            tapScene("Zoom out", wait: 1.8)
            tapScene("Swap source", wait: 1.2)
            tapScene("Seek camera", wait: 1.4)
            tapScene("Leave camera", wait: 0.5)
            XCTAssertTrue(app.staticTexts["Camera scene disposed."].exists)
            tapScene("Enter camera", wait: 0.5)
            tapScene("Zoom in", wait: 6.2)
        }
    }
    func testSceneAppearanceChecks() throws {
        launch(["--scene-lighting"], "Check SceneKit")
        tap("Check SceneKit", wait: 0.1)
        XCTAssertTrue(app.staticTexts["Scene checks passed"].waitForExistence(timeout: 90), app.debugDescription)
    }
    func testSceneAppearanceBackground() throws {
        launch(["--scene-lighting", "--scene-checks=background"], "Check SceneKit")
        tap("Check SceneKit", wait: 0.1)
        XCTAssertTrue(app.staticTexts["Scene background ready"].waitForExistence(timeout: 10))
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 1.5)
        app.activate()
        XCTAssertTrue(app.staticTexts["Scene checks passed"].waitForExistence(timeout: 20), app.debugDescription)
    }
    func tapScene(_ title: String, wait: Double = 0.8) {
        let element = app.buttons[title]
        XCTAssertTrue(element.exists, app.debugDescription)
        element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        Thread.sleep(forTimeInterval: wait)
    }
    func testSceneNavigation() throws {
        launch(["--scene-lighting"], "Play scene")
        for _ in 0..<5 {
            tapScene("Play scene", wait: 0.2)
            tapScene("Charge pulse", wait: 0.2)
            tapScene("Leave scene", wait: 0.3)
            XCTAssertTrue(app.staticTexts["Scene disposed."].exists)
            tapScene("Enter scene", wait: 0.2)
        }
    }
    func testSceneAppearance() throws {
        launch(["--scene-lighting"], "Play scene")
        try record("scene-lighting-ios") {
            tapScene("Play scene", wait: 2.2)
            tapScene("Charge pulse", wait: 2.2)
            tapScene("Pause scene", wait: 1.0)
            XCTAssertTrue(app.staticTexts["Paused together."].exists)
            tapScene("Resume scene", wait: 1.4)
            tapScene("Remove pulse", wait: 0.5)
            tapScene("Seek 50%", wait: 1.0)
            tapScene("Leave scene", wait: 0.6)
            XCTAssertTrue(app.staticTexts["Scene disposed."].exists)
            tapScene("Enter scene", wait: 0.6)
            tapScene("Play scene", wait: 2.0)
            tapScene("Charge pulse", wait: 2.2)
        }
    }
    func testGradientValueChecks() throws {
        launch(["--gradient-values"], "Run checks")
        tap("Run checks", wait: 0.1)
        XCTAssertTrue(app.staticTexts["12 gradient checks passed"].waitForExistence(timeout: 90), app.debugDescription)
    }
    func testGradientValueBackground() throws {
        launch(["--gradient-values", "--gradient-checks=background"], "Run checks")
        tap("Run checks", wait: 0.6)
        XCTAssertTrue(app.staticTexts["Background ready"].waitForExistence(timeout: 10))
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 1.5)
        app.activate()
        XCTAssertTrue(app.staticTexts["1 gradient checks passed"].waitForExistence(timeout: 20), app.debugDescription)
    }
    func testGradientValueReduced() throws {
        launch(["--gradient-values", "--gradient-checks=reduced"], "Run checks")
        tap("Run checks", wait: 0.1)
        XCTAssertTrue(app.staticTexts["1 gradient checks passed"].waitForExistence(timeout: 20), app.debugDescription)
    }
    func testHaptics() throws {
        launch(["--haptics-lab"], "light")
        try record("haptics-ios") {
            tap("light"); tap("medium"); tap("heavy")
            tap("Bounce", wait: 1.4)
            tap("Tween", wait: 0.1)
            tap("Pause", wait: 0.3)
            XCTAssertTrue(app.staticTexts["Paused"].exists)
            let percent = app.staticTexts.matching(NSPredicate(format: "label MATCHES %@", "^[0-9]+%$")).firstMatch
            let held = percent.label
            Thread.sleep(forTimeInterval: 0.7)
            XCTAssertEqual(percent.label, held)
            tap("Seek 70%", wait: 0.2)
            tap("Rewind 10%", wait: 0.2)
            tap("Resume", wait: 2.2)
            XCTAssertTrue(app.staticTexts["Finished"].exists)
            tap("Stagger", wait: 1.2)
            tap("No feedback", wait: 2.4)
            XCTAssertTrue(app.staticTexts["Haptics"].isHittable)
        }
    }
}
