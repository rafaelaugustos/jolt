import SwiftUI
import XCTest
@testable import JoltSwiftUI

final class ScrollRangeTests: XCTestCase {
  @MainActor func testOneSourceFeedsIndependentRangesAndDisposal() throws {
    let scroll=try JoltScrollProgress(), collapse=try scroll.subrange(0...200), title=try scroll.subrange(150...200)
    scroll.update(offset: 175, extent: 1000)
    XCTAssertEqual(scroll.progress, 0.175)
    XCTAssertEqual(collapse.progress, 0.875)
    XCTAssertEqual(title.progress, 0.5)
    title.pause(); scroll.update(offset: 200, extent: 1000)
    XCTAssertEqual(title.progress, 0.5)
    title.play(); XCTAssertEqual(title.progress, 1)
    collapse.dispose(); scroll.update(offset: -20, extent: 1000)
    XCTAssertEqual(title.progress, 0)
    XCTAssertEqual(title.offset, -20)
    scroll.dispose(); XCTAssertTrue(title.disposed)
  }
  @MainActor func testRemeasuredRangeUsesCurrentOffsetAndRejectsInvalidBounds() throws {
    let progress=try JoltScrollProgress(range: 0...200)
    progress.update(offset: 50, extent: 1000)
    try progress.setRange(0...100)
    XCTAssertEqual(progress.progress, 0.5)
    XCTAssertThrowsError(try progress.setRange(2...2))
    XCTAssertEqual(progress.progress, 0.5)
    progress.update(offset: .nan, extent: 20)
    XCTAssertEqual(progress.progress, 0.5)
  }
  func testStructuralTranslationSeparatesLayoutFromDecoration() throws {
    let to=try JoltPose(x: 10, y: -200, scale: 2, rotate: 45)
    let structural=scrollChannels(from: .identity, to: to, progress: 0.5, reduced: true, role: .structuralTranslation)
    XCTAssertEqual(structural.storage[0],5); XCTAssertEqual(structural.storage[1],-100)
    XCTAssertEqual(structural.storage[2],1); XCTAssertEqual(structural.storage[4],0)
    XCTAssertEqual(scrollChannels(from: .identity, to: to, progress: 0.5, reduced: true, role: .decorative).storage[1],0)
    XCTAssertEqual(scrollChannels(from: .identity, to: to, progress: 0.5, reduced: true, role: .structuralPose).storage[2],1.5)
  }
  func testEffectiveSettingCombinesAppAndSystem() {
    var env=EnvironmentValues()
    env.joltReduceMotion=true
    XCTAssertTrue(env.joltEffectiveReduceMotion)
    env.joltReduceMotion=false
    XCTAssertEqual(env.joltEffectiveReduceMotion, env.accessibilityReduceMotion)
  }
}
