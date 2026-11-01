import XCTest
import UIKit

/// Real VoiceOver navigation and double-tap activation; Xcode/iOS 27 harness.
final class DocsTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.benchmark")
    var initialReaderEnabled: Bool?
    var initialTextPosition: CGFloat?
    var initialLargeSizes: Bool?
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    @MainActor func textSettings() {
        settings.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        settings.activate()
        if settings.sliders.firstMatch.waitForExistence(timeout: 2), settings.switches["LARGER_DYNAMIC_TYPE_SWITCH"].firstMatch.exists { return }
        if !settings.staticTexts["Display & Text Size"].firstMatch.exists {
            let accessibility = settings.staticTexts["Accessibility"].firstMatch
            if !accessibility.isHittable { settings.swipeUp() }
            accessibility.tap()
        }
        settings.staticTexts["Display & Text Size"].firstMatch.tap()
        settings.staticTexts["Larger Text"].firstMatch.tap()
        XCTAssertTrue(settings.sliders.firstMatch.waitForExistence(timeout: 5))
    }
    @MainActor override func tearDownWithError() throws {
        if #available(iOS 27, *), let initialReaderEnabled {
            let reader = XCUIDevice.shared.voiceOverService
            if let initialTextPosition, let initialLargeSizes {
                try reader.disable()
                textSettings()
                let toggle = settings.switches["LARGER_DYNAMIC_TYPE_SWITCH"].firstMatch
                if (toggle.value as? String == "1") != initialLargeSizes { toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap() }
                settings.sliders.firstMatch.adjust(toNormalizedSliderPosition: initialTextPosition)
                let restored = settings.sliders.firstMatch.value as? String ?? ""
                let restoredPosition = CGFloat(Double(restored.replacingOccurrences(of: "%", with: "")) ?? -100) / 100
                XCTAssertEqual(restoredPosition, initialTextPosition, accuracy: 0.01)
                XCTAssertEqual(toggle.value as? String == "1", initialLargeSizes)
                print("JOLT_TEXT_RESTORED position=\(restored) largerSizes=\(initialLargeSizes)")
                app.activate()
            }
            if initialReaderEnabled { try reader.enable() }
            else { try reader.disable() }
        }
        try super.tearDownWithError()
    }
    @MainActor func testVoiceOver() throws { try runVoiceOver(largeText: false) }
    @MainActor func testVoiceOverLargeText() throws { try runVoiceOver(largeText: true) }
    @MainActor func runVoiceOver(largeText: Bool) throws {
        continueAfterFailure = false
        guard #available(iOS 27, *) else { throw XCTSkip("VoiceOver automation requires iOS 27") }
        let reader = XCUIDevice.shared.voiceOverService
        initialReaderEnabled = reader.isEnabled
        if largeText {
            try reader.disable()
            textSettings()
            let toggle = settings.switches["LARGER_DYNAMIC_TYPE_SWITCH"].firstMatch
            let position = settings.sliders.firstMatch.value as? String ?? ""
            guard let percent = Double(position.replacingOccurrences(of: "%", with: "")) else {
                XCTFail("Cannot preserve initial text position: " + position); return
            }
            initialTextPosition = CGFloat(percent / 100)
            initialLargeSizes = toggle.value as? String == "1"
            print("JOLT_TEXT_INITIAL position=\(position) largerSizes=\(initialLargeSizes!)")
            if !initialLargeSizes! { toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap() }
            XCTAssertEqual(toggle.value as? String, "1", "Larger Accessibility Sizes did not enable")
            settings.sliders.firstMatch.adjust(toNormalizedSliderPosition: 7.0 / 11.0)
            print("JOLT_TEXT_LARGE position=\(settings.sliders.firstMatch.value ?? "unknown") largerSizes=\(toggle.value ?? "unknown")")
        }
        try reader.enable()
        func speech(_ expected: String) throws {
            var last = ""
            for _ in 0..<25 {
                last = (try? reader.currentSpeech().utterance) ?? ""
                if last.contains(expected) { print("JOLT_VOICEOVER " + last); return }
                Thread.sleep(forTimeInterval: 0.2)
            }
            XCTFail("Expected \(expected), actual speech: \(last)")
        }
        func explore(_ identifier: String, _ expected: String) throws {
            if largeText && ["gallery-zoom", "gallery-reset", "gallery-move", "gallery-remove"].contains(identifier) {
                let backward = identifier == "gallery-zoom" && ((try? reader.currentSpeech().utterance) ?? "").contains("Reset view")
                for _ in 0..<20 {
                    let current = (try? reader.currentSpeech().utterance) ?? ""
                    if current.contains(expected) && current.contains("Button") {
                        let frame = app.descendants(matching: .any)[identifier].firstMatch.frame
                        let screen = app.frame
                        XCTAssertTrue(frame.width >= 44 && frame.height >= 44 && screen.contains(frame), "Reader must reveal the full control: \(identifier) \(frame)")
                        print("JOLT_READER_CONTROL \(identifier) \(current)")
                        try speech(expected)
                        return
                    }
                    if backward { _ = try reader.moveBackward() }
                    else { _ = try reader.moveForward() }
                }
                XCTFail("VoiceOver traversal did not reach " + identifier)
                return
            }
            let element = app.descendants(matching: .any)[identifier].firstMatch
            XCTAssertTrue(element.waitForExistence(timeout: 10), identifier)
            let frame = element.frame
            app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.midY)).tap()
            try speech(expected)
        }
        func activate() {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).doubleTap()
            Thread.sleep(forTimeInterval: 1.5)
        }
        app.launchArguments = ["--showcase-example=gallery", "--gallery-audit", "--collection-audit", "--showcase-audit", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(app.descendants(matching: .any)["collection-place-1"].firstMatch.waitForExistence(timeout: 15))
        Thread.sleep(forTimeInterval: 5)
        try explore("collection-place-1", "Open Cala Serena")
        XCTAssertTrue(try reader.currentSpeech().utterance.contains("Button"))
        XCTAssertTrue(try reader.moveForward().utterance.contains("Open Quiet dunes"))
        XCTAssertTrue(try reader.moveBackward().utterance.contains("Open Cala Serena"))
        print("JOLT_RECORD_START \(Date().timeIntervalSince1970)")
        activate()
        XCTAssertTrue(app.descendants(matching: .any)["gallery-close"].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        print("JOLT_CHECK opened")
        try explore("gallery-title", "Cala Serena")
        XCTAssertTrue(try reader.currentSpeech().utterance.contains("Heading"))
        try explore("gallery-zoom", "Zoom in")
        activate()
        try explore("gallery-reset", "Reset view")
        activate()
        try explore("gallery-zoom", "Zoom in")
        activate()
        try explore("gallery-close", "Back to the collection")
        activate()
        XCTAssertFalse(app.descendants(matching: .any)["gallery-close"].firstMatch.exists)
        try speech("Open Cala Serena")
        print("JOLT_CHECK returned")
        activate()
        try explore("gallery-move", "Move to end")
        activate()
        try explore("gallery-close", "Back to the collection")
        activate()
        try speech("Open Cala Serena")
        print("JOLT_CHECK moved-return")
        activate()
        try explore("gallery-remove", "Remove")
        activate()
        try explore("gallery-close", "Back to the collection")
        activate()
        try speech("Keep a little wonder.")
        XCTAssertTrue(try reader.currentSpeech().utterance.contains("Heading"))
        print("JOLT_CHECK removed-return")
        try explore("collection-reset", "Start again")
        activate()
        try explore("collection-reduce", "Reduce")
        activate()
        try explore("collection-place-2", "Open Quiet dunes")
        activate()
        try explore("gallery-zoom", "Zoom in")
        activate()
        try explore("gallery-close", "Back to the collection")
        activate()
        try speech("Open Quiet dunes")
        print("JOLT_CHECK reduced-return")
        print("JOLT_RECORD_STOP \(Date().timeIntervalSince1970)")
    }
}
