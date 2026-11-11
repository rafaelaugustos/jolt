import XCTest

final class SwiftUIAcceptance: XCTestCase {
  #if os(iOS)
    @MainActor func testStandaloneMotionAndLifecycle() {
      continueAfterFailure = false
      let app = XCUIApplication()
      app.launchArguments = [
        "-AppleLanguages", "(en)", "-AppleLocale", "en_US", "-ApplePersistenceIgnoreState", "YES",
      ]
      app.launch()
      let card = app.buttons["motion-card"]
      XCTAssertTrue(card.waitForExistence(timeout: 10))
      cue("start")
      let origin = card.frame.midX
      app.buttons["move"].tap()
      Thread.sleep(forTimeInterval: 0.16)
      app.buttons["interrupt"].tap()
      XCTAssertTrue(wait { card.frame.midX < origin - 40 })
      app.buttons["reset"].tap()
      XCTAssertTrue(wait { abs(card.frame.midX - origin) < 3 })
      card.tap()
      XCTAssertTrue(
        wait { self.label(app, "counts").contains("Actions: 1") },
        app.staticTexts["counts"].debugDescription)
      app.buttons["replace"].tap()
      XCTAssertTrue(card.exists)
      app.buttons["toggle"].tap()
      XCTAssertFalse(card.exists)
      app.buttons["toggle"].tap()
      XCTAssertTrue(card.waitForExistence(timeout: 3))
      app.switches["reduce"].tap()
      app.buttons["move"].tap()
      XCTAssertTrue(wait { card.frame.midX > origin + 60 })
      XCUIDevice.shared.press(.home)
      Thread.sleep(forTimeInterval: 0.6)
      app.activate()
      XCTAssertTrue(card.waitForExistence(timeout: 5))
      XCTAssertTrue(
        wait { self.label(app, "counts").contains("Actions: 1") },
        app.staticTexts["counts"].debugDescription)
      app.buttons["reset"].tap()
      app.swipeUp()
      app.buttons["preset-play"].tap()
      Thread.sleep(forTimeInterval: 0.8)
      app.buttons["preset-start"].tap()
      Thread.sleep(forTimeInterval: 0.7)
      app.buttons["preset-play"].tap()
      app.buttons["details"].tap()
      XCTAssertTrue(app.navigationBars["Lifecycle"].waitForExistence(timeout: 3))
      app.navigationBars.buttons.element(boundBy: 0).tap()
      app.swipeDown()
      XCTAssertTrue(card.waitForExistence(timeout: 3))
      cue("stop")
    }
  #else
    @MainActor func testStandaloneMacMotionAndLifecycle() {
      continueAfterFailure = false
      let app = XCUIApplication()
      app.launchArguments = [
        "-AppleLanguages", "(en)", "-AppleLocale", "en_US", "-ApplePersistenceIgnoreState", "YES",
      ]
      app.launch()
      let card = app.buttons["motion-card"]
      XCTAssertTrue(card.waitForExistence(timeout: 10))
      cue("start")
      let origin = card.frame.midX
      app.buttons["move"].click()
      app.buttons["interrupt"].click()
      XCTAssertTrue(wait { card.frame.midX < origin - 40 })
      app.buttons["reset"].click()
      XCTAssertTrue(wait { abs(card.frame.midX - origin) < 3 })
      card.click()
      XCTAssertTrue(
        wait { self.label(app, "counts").contains("Actions: 1") },
        app.staticTexts["counts"].debugDescription)
      app.buttons["replace"].click()
      app.buttons["toggle"].click()
      XCTAssertFalse(card.exists)
      app.buttons["toggle"].click()
      XCTAssertTrue(card.waitForExistence(timeout: 3))
      app.checkBoxes["reduce"].click()
      app.buttons["move"].click()
      XCTAssertTrue(wait { card.frame.midX > origin + 60 })
      app.buttons["reset"].click()
      app.buttons["preset-play"].click()
      Thread.sleep(forTimeInterval: 0.7)
      app.buttons["preset-start"].click()
      Thread.sleep(forTimeInterval: 0.7)
      app.buttons["preset-play"].click()
      Thread.sleep(forTimeInterval: 0.8)
      cue("stop")
    }
  #endif
  @MainActor private func click(_ element: XCUIElement) {
    #if os(macOS)
      element.click()
    #else
      element.tap()
    #endif
  }
  @MainActor private func label(_ app: XCUIApplication, _ id: String) -> String {
    let element = app.staticTexts[id]
    return element.label + " " + String(describing: element.value ?? "")
  }
  @MainActor private func scrollProgress(_ app: XCUIApplication) -> Double {
    let text = label(app, "scroll-status")
    guard let start = text.range(of: "Progress: ") else { return -1 }
    return Double(text[start.upperBound...].prefix { $0 != " " && $0 != "·" }) ?? -1
  }
  @MainActor private func lab(_ argument: String) -> XCUIApplication {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchArguments = [
      "-AppleLanguages", "(en)", "-AppleLocale", "en_US", "-ApplePersistenceIgnoreState", "YES",
      argument,
    ]
    app.launch()
    #if os(macOS)
      if app.windows.count == 0 { app.typeKey("n", modifierFlags: .command) }
    #endif
    return app
  }
  @MainActor func testInteractionExpansion() {
    let app = lab("--interaction-lab")
    let card = app.buttons["presence-card"]
    XCTAssertTrue(card.waitForExistence(timeout: 10))
    Thread.sleep(forTimeInterval: 0.7)
    cue("start")
    click(card)
    XCTAssertTrue(
      wait { self.label(app, "presence-count").contains("Actions: 1") },
      label(app, "presence-count"))
    click(app.buttons["press-disable"])
    XCTAssertFalse(card.isEnabled)
    click(app.buttons["press-disable"])
    let identity = String(describing: card.value)
    click(app.buttons["presence-interrupt"])
    XCTAssertTrue(card.waitForExistence(timeout: 2))
    Thread.sleep(forTimeInterval: 0.8)
    XCTAssertTrue(card.exists)
    XCTAssertEqual(String(describing: card.value), identity)
    click(card)
    XCTAssertTrue(wait { self.label(app, "presence-count").contains("Actions: 2") })
    click(app.buttons["presence-toggle"])
    XCTAssertTrue(wait { !card.exists })
    click(app.buttons["presence-toggle"])
    XCTAssertTrue(card.waitForExistence(timeout: 2))
    #if os(macOS)
      let region = app.otherElements["pointer-region"].firstMatch
      region.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.2)).hover()
      XCTAssertTrue(wait { self.label(app, "pointer-status").contains("active") })
      app.buttons["presence-toggle"].hover()
      XCTAssertTrue(wait { self.label(app, "pointer-status").contains("centered") })
    #else
      XCTAssertTrue(label(app, "pointer-status").contains("centered"))
    #endif
    let drag = app.descendants(matching: .any)["drag-card"].firstMatch
    XCTAssertTrue(drag.exists)
    let origin = drag.frame.midX
    let start = drag.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    let end = start.withOffset(CGVector(dx: 75, dy: 0))
    start.press(forDuration: 0.1, thenDragTo: end)
    XCTAssertTrue(wait { drag.frame.midX > origin + 85 })
    click(app.buttons["drag-left"])
    XCTAssertTrue(wait { drag.frame.midX < origin - 85 })
    click(app.buttons["drag-right"])
    XCTAssertTrue(wait { drag.frame.midX > origin + 85 })
    #if os(macOS)
      click(app.checkBoxes["lab-reduce"])
    #else
      click(app.switches["lab-reduce"])
    #endif
    click(app.buttons["drag-left"])
    XCTAssertTrue(wait { drag.frame.midX < origin - 85 })
    cue("stop")
  }
  @MainActor func testCompositionExpansion() {
    let app = lab("--composition-lab")
    let card = app.descendants(matching: .any)["value-card"].firstMatch
    XCTAssertTrue(card.waitForExistence(timeout: 10))
    cue("start")
    let origin = card.frame.midX
    click(app.buttons["value-right"])
    XCTAssertTrue(wait { card.frame.midX > origin + 60 })
    click(app.buttons["value-left"])
    XCTAssertTrue(wait { card.frame.midX < origin - 90 })
    click(app.buttons["stagger-play"])
    XCTAssertTrue(wait { self.label(app, "cue-status").contains("Events: 1") })
    click(app.buttons["timeline-cancel"])
    Thread.sleep(forTimeInterval: 3.5)
    XCTAssertTrue(label(app, "cue-status").contains("Events: 1"), label(app, "cue-status"))
    click(app.buttons["stagger-play"])
    XCTAssertTrue(
      wait { self.label(app, "cue-status").contains("Events: 2") }, label(app, "cue-status"))
    click(app.buttons["sequence-play"])
    Thread.sleep(forTimeInterval: 1.5)
    click(app.buttons["layout-toggle"])
    Thread.sleep(forTimeInterval: 0.8)
    XCTAssertTrue(app.staticTexts["Expanded"].exists)
    click(app.buttons["layout-toggle"])
    Thread.sleep(forTimeInterval: 0.8)
    XCTAssertTrue(app.staticTexts["Card"].exists)
    #if os(iOS)
      app.swipeUp()
    #endif
    XCTAssertTrue(app.descendants(matching: .any)["inspector-panel"].firstMatch.exists)
    cue("stop")
  }
  @MainActor func testScrollExpansion() {
    let app = lab("--scroll-lab")
    XCTAssertTrue(app.staticTexts["scroll-status"].waitForExistence(timeout: 10))
    cue("start")
    let header = app.descendants(matching: .any)["scroll-header"].firstMatch
    let initial = header.frame.height
    let scroll = app.scrollViews["motion-scroll"].firstMatch
    #if os(macOS)
      scroll.scroll(byDeltaX: 0, deltaY: -380)
    #else
      scroll.swipeUp()
    #endif
    XCTAssertTrue(wait { self.scrollProgress(app) > 0.5 }, label(app, "scroll-status"))
    XCTAssertTrue(wait { header.frame.height < initial - 4 })
    #if os(macOS)
      click(app.checkBoxes["lab-reduce"])
      scroll.scroll(byDeltaX: 0, deltaY: 380)
    #else
      click(app.switches["lab-reduce"])
      scroll.swipeDown()
    #endif
    XCTAssertTrue(wait { header.frame.height >= initial - 2 })
    cue("stop")
  }
  @MainActor func testDynamicsExpansion() {
    let app = lab("--dynamics-lab")
    let mapped = app.descendants(matching: .any)["mapped-card"].firstMatch
    XCTAssertTrue(mapped.waitForExistence(timeout: 10))
    XCTAssertTrue(label(app, "seek-status").contains("0.00"))
    cue("start")
    let origin = mapped.frame.midX
    click(app.buttons["map-right"])
    XCTAssertTrue(wait { mapped.frame.midX > origin + 180 })
    click(app.buttons["map-left"])
    XCTAssertTrue(wait { abs(mapped.frame.midX - origin) < 3 })
    let group = app.descendants(matching: .any)["group-card"].firstMatch
    let center = group.frame.midX
    click(app.buttons["state-focus"])
    XCTAssertTrue(wait { group.frame.midX > center + 70 && group.frame.width > 70 })
    click(app.buttons["state-rest"])
    XCTAssertTrue(wait { abs(group.frame.midX - center) < 3 })
    click(app.buttons["behavior-pet"])
    click(app.buttons["behavior-dress"])
    click(app.buttons["behavior-eat"])
    XCTAssertTrue(
      label(app, "request-status").contains("eat: blocked"), label(app, "request-status"))
    XCTAssertTrue(
      wait { self.label(app, "behavior-status").contains("rest") }, label(app, "behavior-status"))
    XCTAssertTrue(wait { abs(group.frame.midX - center) < 3 })
    click(app.buttons["seek-quarter"])
    XCTAssertTrue(label(app, "seek-status").contains("0.25"))
    click(app.buttons["seek-threequarters"])
    XCTAssertTrue(label(app, "seek-status").contains("0.75"))
    XCTAssertTrue(label(app, "activity-status").contains("idle"))
    click(app.buttons["seek-play"])
    XCTAssertTrue(wait { self.label(app, "seek-status").contains("completed") })
    XCTAssertTrue(wait { self.label(app, "activity-status").contains("idle") })
    cue("stop")
  }
  @MainActor func testGraphicsExpansion() {
    let app = lab("--graphics-lab")
    XCTAssertTrue(app.staticTexts["gradient-title"].waitForExistence(timeout: 10))
    cue("start")
    let marker = app.descendants(matching: .any)["path-marker"].firstMatch
    let origin = marker.frame.midX
    click(app.buttons["graphics-play"])
    XCTAssertTrue(wait { marker.frame.midX > origin + 40 })
    click(app.buttons["graphics-pause"])
    let frozen = marker.frame.midX
    Thread.sleep(forTimeInterval: 0.5)
    XCTAssertEqual(marker.frame.midX, frozen, accuracy: 2)
    XCTAssertTrue(label(app, "drawing-status").contains("21"))
    click(app.buttons["graphics-pause"])
    XCTAssertTrue(wait { marker.frame.midX > origin + 240 })
    XCTAssertTrue(wait { self.label(app, "activity-status").contains("idle") })
    let drag = app.descendants(matching: .any)["inertia-card"].firstMatch
    let center = drag.frame.midX
    let start = drag.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
    start.press(forDuration: 0.1, thenDragTo: start.withOffset(CGVector(dx: 70, dy: 0)))
    XCTAssertTrue(wait { drag.frame.midX > center + 60 })
    Thread.sleep(forTimeInterval: 0.6)
    XCTAssertLessThanOrEqual(drag.frame.midX, center + 117)
    click(app.buttons["graphics-play"])
    Thread.sleep(forTimeInterval: 0.8)
    click(app.buttons["graphics-clear"])
    XCTAssertTrue(label(app, "drawing-status").contains("0"))
    cue("stop")
  }
  @MainActor func testViewportExpansion() {
    let app = lab("--viewport-lab")
    XCTAssertTrue(app.staticTexts["viewport-status"].waitForExistence(timeout: 10))
    XCTAssertTrue(
      label(app, "viewport-status").contains("Once: 0 · Replay: 0"), label(app, "viewport-status"))
    cue("start")
    let scroll = app.scrollViews["viewport-scroll"].firstMatch
    #if os(macOS)
      scroll.scroll(byDeltaX: 0, deltaY: -560)
    #else
      scroll.swipeUp()
    #endif
    XCTAssertTrue(
      wait { self.label(app, "viewport-status").contains("Once: 1 · Replay: 1") },
      label(app, "viewport-status"))
    Thread.sleep(forTimeInterval: 0.8)
    #if os(macOS)
      scroll.scroll(byDeltaX: 0, deltaY: 560)
    #else
      scroll.swipeDown()
    #endif
    Thread.sleep(forTimeInterval: 0.5)
    #if os(macOS)
      scroll.scroll(byDeltaX: 0, deltaY: -560)
    #else
      scroll.swipeUp()
    #endif
    XCTAssertTrue(
      wait { self.label(app, "viewport-status").contains("Once: 1 · Replay: 2") },
      label(app, "viewport-status"))
    click(app.buttons["viewport-toggle"])
    XCTAssertFalse(app.staticTexts["viewport-once"].exists)
    click(app.buttons["viewport-toggle"])
    XCTAssertTrue(
      wait { self.label(app, "viewport-status").contains("Once: 1 · Replay: 3") },
      label(app, "viewport-status"))
    cue("stop")
  }
  @MainActor func testKeyGestureExpansion() {
    let app = lab("--key-gesture-lab")
    let card = app.descendants(matching: .any)["gesture-card"].firstMatch
    XCTAssertTrue(card.waitForExistence(timeout: 10))
    cue("start")
    click(app.buttons["key-play"])
    Thread.sleep(forTimeInterval: 0.5)
    click(app.buttons["key-pause"])
    XCTAssertTrue(label(app, "key-status").contains("paused"))
    let marker = app.descendants(matching: .any)["key-marker"].firstMatch
    let frozen = marker.frame.midX
    Thread.sleep(forTimeInterval: 0.4)
    XCTAssertEqual(marker.frame.midX, frozen, accuracy: 2)
    click(app.buttons["key-resume"])
    XCTAssertTrue(wait { self.label(app, "key-status").contains("completed") })
    let origin = card.frame.midX
    let start = card.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5))
    start.press(forDuration: 0.1, thenDragTo: start.withOffset(.init(dx: 60, dy: 15)))
    XCTAssertTrue(wait { card.frame.midX > origin + 35 }, label(app, "gesture-status"))
    click(app.buttons["gesture-reset"])
    XCTAssertTrue(wait { abs(card.frame.midX - origin) < 3 })
    #if os(iOS)
      card.pinch(withScale: 1.5, velocity: 1)
      XCTAssertTrue(wait { card.frame.width > 130 }, label(app, "gesture-status"))
      click(app.buttons["gesture-reset"])
      XCTAssertTrue(wait { self.label(app, "gesture-status").contains("scale 1.00 · angle 0") })
      card.rotate(.pi / 3, withVelocity: 0.5)
      XCTAssertFalse(label(app, "gesture-status").contains("angle 0"), label(app, "gesture-status"))
    #else
      click(app.buttons["gesture-zoom"])
      click(app.buttons["gesture-turn"])
      XCTAssertTrue(wait { self.label(app, "gesture-status").contains("angle 30") })
    #endif
    click(app.buttons["gesture-reset"])
    XCTAssertTrue(wait { self.label(app, "gesture-status").contains("scale 1.00 · angle 0") })
    #if os(iOS)
      // Custom accessibility actions wrap the Button as "Other" on iOS 18.
      // Touch its visible center; the tap counter still verifies real Button delivery.
      card.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5)).tap()
    #else
      click(card)
    #endif
    XCTAssertTrue(label(app, "gesture-taps").contains("Taps: 1"))
    click(app.buttons["gesture-toggle"])
    XCTAssertFalse(card.exists)
    click(app.buttons["gesture-toggle"])
    XCTAssertTrue(card.waitForExistence(timeout: 3))
    #if os(iOS)
      // Custom accessibility actions wrap the Button as "Other" on iOS 18.
      // Touch its visible center; the tap counter still verifies real Button delivery.
      card.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5)).tap()
    #else
      click(card)
    #endif
    XCTAssertTrue(label(app, "gesture-taps").contains("Taps: 2"))
    #if os(macOS)
      click(app.checkBoxes["character-reduce"])
    #else
      let reduce = app.switches["character-reduce"]
      reduce.coordinate(withNormalizedOffset: .init(dx: 0.94, dy: 0.5)).tap()
      XCTAssertEqual(reduce.value as? String, "1")
    #endif
    click(app.buttons["key-play"])
    XCTAssertTrue(wait { self.label(app, "key-status").contains("completed") })
    cue("stop")
  }
  @MainActor func testTransferExpansion() {
    let app = lab("--transfer-lab")
    let source = app.descendants(matching: .any)["drop-source"].firstMatch
    XCTAssertTrue(source.waitForExistence(timeout: 10))
    cue("start")
    let origin = source.frame.midX
    let locked = app.descendants(matching: .any)["drop-locked"].firstMatch
    source.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5)).press(
      forDuration: 0.1,
      thenDragTo: locked.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5)))
    XCTAssertTrue(
      wait { self.label(app, "drop-status").contains("rejected") }, label(app, "drop-status"))
    XCTAssertTrue(wait { abs(source.frame.midX - origin) < 3 })
    let basket = app.descendants(matching: .any)["drop-basket"].firstMatch
    source.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5)).press(
      forDuration: 0.1,
      thenDragTo: basket.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5)))
    XCTAssertTrue(
      wait { self.label(app, "drop-status").contains("accepted · basket · effects 1") },
      label(app, "drop-status"))
    click(app.buttons["drop-return"])
    XCTAssertTrue(wait { self.label(app, "drop-status").contains("returned · effects 0") })
    click(app.buttons["drop-send"])
    XCTAssertTrue(label(app, "drop-status").contains("effects 1"))
    click(app.buttons["drop-return"])
    let first = app.descendants(matching: .any)["jolt-reorder-handle-Item 1"].firstMatch
    let third = app.descendants(matching: .any)["jolt-reorder-handle-Item 3"].firstMatch
    first.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5)).press(
      forDuration: 0.2,
      thenDragTo: third.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5)))
    XCTAssertTrue(
      wait { self.label(app, "order-status").contains("Item 2, Item 3, Item 1") },
      label(app, "order-status"))
    click(app.buttons["order-reset"])
    click(app.buttons["order-down"])
    XCTAssertTrue(label(app, "order-status").contains("Item 2, Item 1, Item 3"))
    click(app.buttons["order-reset"])
    let start = first.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5))
    start.press(
      forDuration: 0.2, thenDragTo: start.withOffset(.init(dx: 0, dy: 180)), withVelocity: .slow,
      thenHoldForDuration: 1)
    XCTAssertFalse(
      label(app, "order-status").contains("Order: Item 1,"), label(app, "order-status"))
    click(app.buttons["order-reset"])
    cue("stop")
  }
  @MainActor func testCharacterExpansion() {
    let app = lab("--character-lab")
    let flower = app.descendants(matching: .any)["rig-flower"].firstMatch
    XCTAssertTrue(flower.waitForExistence(timeout: 10))
    cue("start")
    let origin = flower.frame.midY
    click(app.buttons["rig-wave"])
    XCTAssertTrue(wait { flower.frame.midY < origin - 40 })
    click(app.buttons["rig-blend"])
    Thread.sleep(forTimeInterval: 0.9)
    XCTAssertTrue(flower.frame.midY < origin - 10)
    click(app.buttons["rig-rest"])
    XCTAssertTrue(wait { abs(flower.frame.midY - origin) < 3 })
    click(app.buttons["particle-burst"])
    XCTAssertTrue(wait { self.label(app, "particle-status").contains("100 · running") })
    Thread.sleep(forTimeInterval: 0.7)
    click(app.buttons["particle-cancel"])
    XCTAssertTrue(label(app, "particle-status").contains("0 · cancelled"))
    click(app.buttons["particle-burst"])
    XCTAssertTrue(wait { self.label(app, "particle-status").contains("100 · running") })
    XCTAssertTrue(wait { self.label(app, "particle-status").contains("0 · completed") })
    click(app.buttons["particle-emit"])
    XCTAssertTrue(
      wait {
        self.label(app, "particle-status").contains("running")
          && !self.label(app, "particle-status").contains("Particles: 0")
      })
    XCTAssertTrue(wait { self.label(app, "particle-status").contains("0 · completed") })
    #if os(macOS)
      click(app.checkBoxes["character-reduce"])
    #else
      let reduce = app.switches["character-reduce"]
      reduce.coordinate(withNormalizedOffset: .init(dx: 0.94, dy: 0.5)).tap()
      XCTAssertEqual(reduce.value as? String, "1")
    #endif
    click(app.buttons["rig-wave"])
    click(app.buttons["particle-burst"])
    XCTAssertTrue(wait { flower.frame.midY < origin - 40 })
    XCTAssertTrue(label(app, "particle-status").contains("0"))
    cue("stop")
  }
  @MainActor func testPanelExpansion() {
    let app = lab("--panel-lab")
    let open = app.buttons["panel-open"]
    XCTAssertTrue(open.waitForExistence(timeout: 10))
    cue("start")
    click(open)
    let handle = app.descendants(matching: .any)["jolt-sheet-handle"].firstMatch
    XCTAssertTrue(wait { self.label(app, "panel-status").contains("230 pt") })
    let compactY = handle.frame.midY
    click(app.buttons["panel-expand"])
    XCTAssertTrue(wait { handle.frame.midY < compactY - 100 })
    click(app.buttons["panel-expand"])
    Thread.sleep(forTimeInterval: 0.5)
    let expandedY = handle.frame.midY
    let firstStop = app.descendants(matching: .any)["panel-stop-1"].firstMatch
    let firstStopY = firstStop.frame.midY
    #if os(iOS)
      let scroll = app.scrollViews["jolt-sheet-scroll"].firstMatch
      let scrollStart = scroll.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.82))
      scrollStart.press(
        forDuration: 0.05,
        thenDragTo: scroll.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.25)),
        withVelocity: .slow, thenHoldForDuration: 0.1)
      XCTAssertTrue(wait { firstStop.frame.midY < firstStopY - 40 })
      XCTAssertEqual(handle.frame.midY, expandedY, accuracy: 4)
      scroll.swipeDown()
    #else
      app.scrollViews["jolt-sheet-scroll"].firstMatch.scroll(byDeltaX: 0, deltaY: -180)
      XCTAssertTrue(wait { firstStop.frame.midY < firstStopY - 40 })
      XCTAssertEqual(handle.frame.midY, expandedY, accuracy: 4)
      app.scrollViews["jolt-sheet-scroll"].firstMatch.scroll(byDeltaX: 0, deltaY: 600)
    #endif
    let field = app.textFields["panel-note"]
    XCTAssertTrue(field.waitForExistence(timeout: 3))
    click(field)
    field.typeText("Bring a camera")
    #if os(iOS)
      XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 3))
      XCTAssertLessThan(field.frame.maxY, app.keyboards.firstMatch.frame.minY)
      app.keyboards.buttons["Done"].tap()
    #else
      click(app.buttons["panel-done"])
    #endif
    click(app.buttons["panel-compact"])
    XCTAssertTrue(wait { abs(handle.frame.midY - compactY) < 4 })
    let start = handle.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5))
    start.press(
      forDuration: 0.15, thenDragTo: start.withOffset(.init(dx: 0, dy: -180)), withVelocity: .slow,
      thenHoldForDuration: 0.2)
    XCTAssertTrue(wait { handle.frame.midY < compactY - 80 })
    #if os(macOS)
      // Drag focuses the handle; Escape dismisses and returns focus.
      handle.typeKey(.escape, modifierFlags: [])
    #else
      click(app.buttons["panel-close"])
    #endif
    XCTAssertTrue(wait { self.label(app, "panel-status").contains("closed") })
    XCTAssertTrue(wait { self.label(app, "panel-focus").contains("1") })
    click(open)
    XCTAssertTrue(wait { self.label(app, "panel-status").contains("230 pt") })
    click(app.buttons["panel-mount"])
    XCTAssertFalse(handle.exists)
    XCTAssertTrue(self.label(app, "panel-status").contains("suspended"), label(app, "panel-status"))
    click(app.buttons["panel-mount"])
    XCTAssertTrue(handle.waitForExistence(timeout: 3))
    XCTAssertTrue(
      wait {
        handle.frame.midY < compactY - 80 && self.label(app, "panel-status").contains("completed")
      })
    #if os(macOS)
      app.typeKey(.escape, modifierFlags: [])
    #else
      click(app.buttons["panel-close"])
    #endif
    XCTAssertTrue(wait { self.label(app, "panel-status").contains("closed") })
    #if os(macOS)
      click(app.checkBoxes["panel-reduce"])
    #else
      app.switches["panel-reduce"].coordinate(withNormalizedOffset: .init(dx: 0.94, dy: 0.5)).tap()
    #endif
    click(open)
    XCTAssertTrue(wait { self.label(app, "panel-status").contains("230 pt") })
    click(app.buttons["panel-close"])
    cue("stop")
  }
  @MainActor func testGeometryExpansion() {
    let app = lab("--geometry-lab")
    let marker = app.descendants(matching: .any)["curve-marker"].firstMatch
    XCTAssertTrue(marker.waitForExistence(timeout: 10))
    cue("start")
    let origin = marker.frame.midX
    click(app.buttons["curve-play"])
    XCTAssertTrue(wait { self.label(app, "curve-status").contains("1.00") })
    XCTAssertGreaterThan(marker.frame.midX, origin + 220)
    click(app.buttons["curve-reverse"])
    Thread.sleep(forTimeInterval: 0.6)
    click(app.buttons["curve-cancel"])
    let frozen = marker.frame.midX
    Thread.sleep(forTimeInterval: 0.4)
    XCTAssertEqual(marker.frame.midX, frozen, accuracy: 1)
    click(app.buttons["curve-reverse"])
    XCTAssertTrue(wait { abs(marker.frame.midX - origin) < 3 })
    let first = app.descendants(matching: .any)["jolt-reorder-handle-Stop 1"].firstMatch
    let second = app.descendants(matching: .any)["jolt-reorder-handle-Stop 2"].firstMatch
    let third = app.descendants(matching: .any)["jolt-reorder-handle-Stop 3"].firstMatch
    XCTAssertGreaterThan(
      third.frame.midY - second.frame.midY, second.frame.midY - first.frame.midY - 10)
    first.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5)).press(
      forDuration: 0.15,
      thenDragTo: third.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5)).withOffset(
        .init(dx: 0, dy: 12)))
    XCTAssertTrue(
      wait { self.label(app, "measured-status").contains("Stop 2, Stop 3, Stop 1") },
      label(app, "measured-status"))
    click(app.buttons["measured-reset"])
    let height = app.descendants(matching: .any)["measured-Stop 2"].firstMatch.frame.height
    click(app.buttons["measured-resize"])
    XCTAssertTrue(
      wait {
        app.descendants(matching: .any)["measured-Stop 2"].firstMatch.frame.height > height + 20
      })
    click(app.buttons["measured-resize"])
    #if os(macOS)
      click(app.checkBoxes["geometry-reduce"])
    #else
      app.switches["geometry-reduce"].coordinate(withNormalizedOffset: .init(dx: 0.94, dy: 0.5))
        .tap()
    #endif
    click(app.buttons["curve-play"])
    XCTAssertTrue(wait { marker.frame.midX > origin + 220 })
    click(app.buttons["measured-reset"])
    cue("stop")
  }
  @MainActor func testCharacterHandleExpansion() {
    let app = lab("--character-handle-lab")
    let grip = app.descendants(matching: .any)["handle-grip"].firstMatch
    XCTAssertTrue(grip.waitForExistence(timeout: 10))
    let card = app.descendants(matching: .any)["handle-card"].firstMatch
    let backlog = app.descendants(matching: .any)["handle-backlog"].firstMatch
    let done = app.descendants(matching: .any)["handle-done"].firstMatch
    let locked = app.descendants(matching: .any)["handle-locked"].firstMatch
    func drag(to target: XCUIElement, _ dx: Double, _ dy: Double, hold: Double = 0.4) {
      grip.coordinate(withNormalizedOffset: .init(dx: 0.5, dy: 0.5)).press(
        forDuration: 0.15,
        thenDragTo: target.coordinate(withNormalizedOffset: .init(dx: dx, dy: dy)),
        withVelocity: .slow, thenHoldForDuration: hold)
    }
    cue("start")
    let origin = card.frame
    click(app.buttons["handle-open"])
    XCTAssertTrue(wait { app.buttons["handle-open"].label.contains("Open · 1") })
    let body = card.coordinate(withNormalizedOffset: .init(dx: 0.85, dy: 0.2))
    body.press(forDuration: 0.15, thenDragTo: body.withOffset(.init(dx: 140, dy: 60)))
    Thread.sleep(forTimeInterval: 0.4)
    XCTAssertEqual(card.frame.midX, origin.midX, accuracy: 2)
    XCTAssertEqual(card.frame.midY, origin.midY, accuracy: 2)
    XCTAssertFalse(label(app, "handle-status").contains("Dropped"), label(app, "handle-status"))
    drag(to: backlog, 0.3, 0.06, hold: 0.8)
    XCTAssertTrue(
      wait { self.label(app, "handle-status").contains("Dropped in backlog · drag") },
      label(app, "handle-status"))
    XCTAssertTrue(
      wait { abs(card.frame.midY - origin.midY) < 3 }, "\(card.frame) \(origin) \(label(app, "handle-status"))")
    let short = done.frame
    drag(to: done, 0.3, 1 + 30 / short.height)
    XCTAssertTrue(
      wait { self.label(app, "handle-status").contains("Dropped in done · drag") },
      label(app, "handle-status"))
    XCTAssertTrue(wait { card.frame.midX > short.minX && card.frame.midX < short.maxX })
    let settled = card.frame
    drag(to: locked, 0.3, 0.5)
    XCTAssertTrue(
      wait { self.label(app, "handle-status").contains("Rejected by locked") },
      label(app, "handle-status"))
    XCTAssertTrue(wait { abs(card.frame.midY - settled.midY) < 3 })
    #if os(macOS)
      click(app.checkBoxes["handle-reduce"])
    #else
      let reduce = app.switches["handle-reduce"]
      reduce.coordinate(withNormalizedOffset: .init(dx: 0.94, dy: 0.5)).tap()
      XCTAssertEqual(reduce.value as? String, "1")
    #endif
    drag(to: locked, 0.3, 0.5, hold: 0.2)
    XCTAssertTrue(abs(card.frame.midY - settled.midY) < 3, "Reduced motion did not return at once")
    click(app.buttons["handle-send"])
    XCTAssertTrue(
      wait { self.label(app, "handle-status").contains("Dropped in backlog · request") },
      label(app, "handle-status"))
    XCTAssertTrue(wait { abs(card.frame.midX - origin.midX) < 3 })
    cue("stop")
  }
  private func cue(_ action: String) {
    let device = ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "macos"
    let directory = URL(fileURLWithPath: "/tmp/jolt-swiftui-recording-control-" + device)
    guard FileManager.default.fileExists(atPath: directory.path) else { return }
    #if os(macOS)
      // The macOS XCTest runner is sandboxed. Handshake inside its own temp directory.
      let ack = FileManager.default.temporaryDirectory.appendingPathComponent("jolt-recording-ack")
    #else
      let ack = directory.appendingPathComponent("ack")
    #endif
    try? FileManager.default.removeItem(at: ack)
    #if os(macOS)
      print("JOLT_CAPTURE_\(action) \(ack.path)")
    #else
      do {
        try action.write(
          to: directory.appendingPathComponent("request"), atomically: true, encoding: .utf8)
      } catch {
        XCTFail("Recorder cue failed: \(error)")
        return
      }
    #endif
    let deadline = Date().addingTimeInterval(30)
    while Date() < deadline {
      if (try? String(contentsOf: ack, encoding: .utf8)) == action { return }
      Thread.sleep(forTimeInterval: 0.05)
    }
    XCTFail("Recorder did not acknowledge " + action)
  }
  private func wait(_ condition: @escaping () -> Bool) -> Bool {
    XCTWaiter.wait(
      for: [XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in condition() }, object: nil)],
      timeout: 6) == .completed
  }
}
