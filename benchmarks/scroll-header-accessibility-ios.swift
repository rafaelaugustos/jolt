import XCTest
import UIKit

/// Uses the actual VoiceOver service (Xcode/iOS 27), never synthetic focus events.
final class DocsTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "org.nativescript.jolt.benchmark")
    var initialReaderEnabled: Bool?

    @MainActor override func tearDownWithError() throws {
        if #available(iOS 27, *), let initialReaderEnabled {
            let reader = XCUIDevice.shared.voiceOverService
            if initialReaderEnabled { try reader.enable() }
            else { try reader.disable() }
        }
        try super.tearDownWithError()
    }

    @MainActor func testVoiceOver() throws {
        continueAfterFailure = false
        guard #available(iOS 27, *) else { throw XCTSkip("VoiceOver automation requires iOS 27") }
        let reader = XCUIDevice.shared.voiceOverService
        initialReaderEnabled = reader.isEnabled
        try reader.enable()
        func speech(containing expected: String) throws -> String {
            var last = ""
            for _ in 0..<25 {
                last = (try? reader.currentSpeech().utterance) ?? ""
                if last.contains(expected) { return last }
                Thread.sleep(forTimeInterval: 0.2)
            }
            XCTFail("VoiceOver did not announce \(expected); last speech: \(last)")
            return last
        }
        app.launchArguments = ["--showcase-example=scroll-header", "--scroll-header-audit", "--showcase-audit", "-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        let list = app.descendants(matching: .any)["scroll-header-list"].firstMatch
        XCTAssertTrue(list.waitForExistence(timeout: 15))
        // The showcase splash keeps its mounted route hidden from readers.
        Thread.sleep(forTimeInterval: 5)
        let title = app.descendants(matching: .any)["scroll-header-title"].firstMatch
        let titleFrame = title.frame
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: titleFrame.midX, dy: titleFrame.midY)).tap()
        let heading = try reader.currentSpeech().utterance
        print("JOLT_VOICEOVER " + heading)
        XCTAssertTrue(heading.contains("Slow tides.") && heading.contains("Heading"), "Expanded heading must be reachable by touch exploration")
        print("JOLT_RECORD_START \(Date().timeIntervalSince1970)")
        Thread.sleep(forTimeInterval: 3)
        let frame = list.frame
        XCTAssertNil(JoltReaderScroll(CGPoint(x: frame.midX - 40, y: frame.minY + frame.height * 0.8), -frame.height * 0.4))
        Thread.sleep(forTimeInterval: 1)
        let collapsedSpeech = try reader.currentSpeech().utterance
        print("JOLT_VOICEOVER_COLLAPSED " + collapsedSpeech)
        XCTAssertTrue(collapsedSpeech.contains("Slow tides.") && collapsedSpeech.contains("Heading"))
        XCTAssertLessThan(app.descendants(matching: .any)["scroll-header-hero"].firstMatch.frame.minY, frame.minY - 20)
        XCTAssertTrue(app.descendants(matching: .any)["scroll-header-compact-title"].firstMatch.exists)
        XCTAssertNil(JoltReaderScroll(CGPoint(x: frame.midX - 40, y: frame.minY + frame.height * 0.35), frame.height * 0.4))
        Thread.sleep(forTimeInterval: 1)
        let expandedSpeech = try reader.currentSpeech().utterance
        print("JOLT_VOICEOVER_EXPANDED " + expandedSpeech)
        XCTAssertTrue(expandedSpeech.contains("Slow tides.") && expandedSpeech.contains("Heading"))
        XCTAssertEqual(app.descendants(matching: .any)["scroll-header-hero"].firstMatch.frame.minY, frame.minY, accuracy: 1)
        var reachedJump = false
        for _ in 0..<8 {
            let speech = try reader.moveForward().utterance
            print("JOLT_VOICEOVER_FORWARD " + speech)
            if speech.contains("Jump to a later track") { reachedJump = true; break }
        }
        XCTAssertTrue(reachedJump)
        // A scroll while reading an unrelated control must not steal its focus.
        XCTAssertNil(JoltReaderScroll(CGPoint(x: frame.midX - 40, y: frame.minY + frame.height * 0.8), -frame.height * 0.4))
        XCTAssertTrue(try reader.currentSpeech().utterance.contains("Jump to a later track"))
        XCTAssertNil(JoltReaderScroll(CGPoint(x: frame.midX - 40, y: frame.minY + frame.height * 0.35), frame.height * 0.4))
        XCTAssertTrue(try reader.currentSpeech().utterance.contains("Jump to a later track"))
        let activation = app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: frame.midX, dy: frame.maxY - 50))
        activation.doubleTap()
        Thread.sleep(forTimeInterval: 1)
        let destination = try speech(containing: "Play A softer place")
        print("JOLT_VOICEOVER_DESTINATION " + destination)
        XCTAssertTrue(destination.contains("Play A softer place"), "Explicit navigation must focus the requested row")
        activation.doubleTap()
        Thread.sleep(forTimeInterval: 1)
        let top = app.descendants(matching: .any)["scroll-header-top"].firstMatch.frame
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: top.midX, dy: top.midY)).tap()
        _ = try speech(containing: "Back to the cover")
        activation.doubleTap()
        Thread.sleep(forTimeInterval: 1)
        _ = try speech(containing: "Slow tides.")
        XCTAssertEqual(app.descendants(matching: .any)["scroll-header-hero"].firstMatch.frame.minY, frame.minY, accuracy: 1)
        print("JOLT_VOICEOVER_RETURNED")
        let back = app.staticTexts["Back to collection"].firstMatch.frame
        app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: back.midX, dy: back.midY)).tap()
        _ = try speech(containing: "Back to collection")
        activation.doubleTap()
        Thread.sleep(forTimeInterval: 2)
        XCTAssertFalse(list.exists)
        print("JOLT_RECORD_STOP \(Date().timeIntervalSince1970)")
    }
}
