import XCTest
import UIKit

final class ReaderTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "dev.jolt.nativeci")
    var initialReader: Bool?
    @MainActor override func tearDownWithError() throws {
        if #available(iOS 27, *), let initialReader {
            if initialReader { try XCUIDevice.shared.voiceOverService.enable() }
            else { try XCUIDevice.shared.voiceOverService.disable() }
        }
        try super.tearDownWithError()
    }
    @MainActor func element(_ id: String) -> XCUIElement {
        let value = app.descendants(matching: .any)[id].firstMatch
        XCTAssertTrue(value.waitForExistence(timeout: 10), id + "\n" + app.debugDescription)
        return value
    }
    @MainActor func explore(_ id: String, _ speech: String) throws {
        let value = element(id), frame = value.frame
        XCTAssertNil(JoltNativeTap(CGPoint(x: frame.midX, y: frame.midY)))
        try expectSpeech(speech)
    }
    @MainActor func expectSpeech(_ expected: String) throws {
        guard #available(iOS 27, *) else { return }
        let reader = XCUIDevice.shared.voiceOverService
        var actual = ""
        for _ in 0..<20 {
            actual = (try? reader.currentSpeech().utterance) ?? ""
            if actual.contains(expected) { print("JOLT_READER " + actual); return }
            Thread.sleep(forTimeInterval: 0.15)
        }
        XCTFail("Expected speech \(expected); got \(actual)")
    }
    @MainActor func activate(_ id: String, _ speech: String, delay: Double = 0.5) throws {
        try explore(id, speech)
        let frame = element(id).frame
        XCTAssertNil(JoltReaderDoubleTap(CGPoint(x: frame.midX, y: frame.midY)))
        Thread.sleep(forTimeInterval: delay)
    }
    @MainActor func start() throws {
        continueAfterFailure = false
        guard #available(iOS 27, *) else { throw XCTSkip("Requires real VoiceOver service") }
        let reader = XCUIDevice.shared.voiceOverService
        initialReader = reader.isEnabled
        app.launchArguments = ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        _ = element("reader-exits")
        try reader.enable()
        Thread.sleep(forTimeInterval: 1)
    }
    @MainActor func testExitTraversal() throws {
        try start()
        guard #available(iOS 27, *) else { return }
        let reader = XCUIDevice.shared.voiceOverService
        print("JOLT_RECORD_START exits \(Date().timeIntervalSince1970)")
        try explore("card-alpha", "Card Alpha")
        XCTAssertTrue(try reader.moveForward().utterance.contains("Card Bravo"))
        try activate("exit-remove", "Remove Bravo", delay: 0.1)
        try explore("card-alpha", "Card Alpha")
        let next = try reader.moveForward().utterance
        print("JOLT_EXIT_NEXT " + next)
        XCTAssertTrue(next.contains("Card Charlie"), next)
        XCTAssertFalse(app.descendants(matching: .any)["card-bravo"].firstMatch.exists)
        XCTAssertTrue(try reader.moveBackward().utterance.contains("Card Alpha"))
        try activate("exit-cancel", "Cancel exit")
        try activate("exit-reset", "Reset cards")
        try activate("exit-remove", "Remove Bravo", delay: 0.1)
        try activate("exit-reinsert", "Reinsert Bravo")
        try explore("card-alpha", "Card Alpha")
        XCTAssertTrue(try reader.moveForward().utterance.contains("Card Bravo"))
        try activate("exit-reduced", "Reduced removal")
        try explore("card-alpha", "Card Alpha")
        XCTAssertTrue(try reader.moveForward().utterance.contains("Card Charlie"))
        try activate("reader-dispose", "Dispose scene")
        XCTAssertFalse(app.descendants(matching: .any)["card-alpha"].firstMatch.exists)
        print("JOLT_RECORD_STOP exits \(Date().timeIntervalSince1970)")
    }
    @MainActor func testListFocus() throws {
        try checkList(collection: false)
    }
    @MainActor func testCollectionFocus() throws {
        try checkList(collection: true)
    }
    @MainActor func checkList(collection: Bool) throws {
        try start()
        guard #available(iOS 27, *) else { return }
        let reader = XCUIDevice.shared.voiceOverService
        try activate(collection ? "reader-collections" : "reader-lists", collection ? "Collection focus" : "List focus")
        let scene = collection ? "collections" : "lists"
        print("JOLT_RECORD_START \(scene) \(Date().timeIntervalSince1970)")
        try activate("list-move", "Arm move", delay: 0.1)
        try explore("reader-row-1", "Row 1")
        Thread.sleep(forTimeInterval: 9.5)
        try expectSpeech("Row 1")
        let next = try reader.moveForward().utterance
        print("JOLT_LIST_NEXT " + next)
        XCTAssertTrue(next.contains("Row 3"), next)
        try activate("list-insert", "Arm insert", delay: 0.1)
        try explore("reader-row-3", "Row 3")
        Thread.sleep(forTimeInterval: 9.5)
        try expectSpeech("Row 3")
        XCTAssertTrue(try reader.moveForward().utterance.contains("Row 4"))
        try activate("list-interrupt", "Arm interrupt", delay: 0.1)
        try explore("reader-row-2", "Row 2")
        Thread.sleep(forTimeInterval: 10)
        try expectSpeech("Row 2")
        try activate("list-move", "Arm move", delay: 0.1)
        try explore("outside-anchor", "Outside anchor")
        Thread.sleep(forTimeInterval: 9.5)
        try expectSpeech("Outside anchor")
        try activate("list-reduced", "Reduced move", delay: 0.1)
        try explore("reader-row-1", "Row 1")
        Thread.sleep(forTimeInterval: 8.8)
        try expectSpeech("Row 1")
        try activate("reader-dispose", "Dispose scene")
        XCTAssertFalse(app.descendants(matching: .any)["reader-row-1"].firstMatch.exists)
        print("JOLT_RECORD_STOP \(scene) \(Date().timeIntervalSince1970)")
    }
}
