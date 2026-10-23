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
