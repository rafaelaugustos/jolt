import XCTest

@testable import JoltCore

final class TextTests: XCTestCase {
  private let locale = Locale(identifier: "en_US")
  private func fixtures() throws -> [String: Any] {
    let url = Bundle.module.url(forResource: "text", withExtension: "json")!
    return try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
  }
  private func pieces(_ list: Any) -> [JoltTextPiece] {
    (list as! [[String: Any]]).map {
      .init(
        text: $0["text"] as! String, start: $0["start"] as! Int, end: $0["end"] as! Int,
        group: $0["group"] as? Int ?? -1)
    }
  }
  private func span(_ object: Any?) -> [String]? {
    guard let object = object as? [String: Any] else { return nil }
    return [object["text"] as! String, "\(object["start"]!)", "\(object["end"]!)"]
  }
  private func span(_ piece: JoltTextPiece?) -> [String]? {
    piece.map { [$0.text, "\($0.start)", "\($0.end)"] }
  }
  private func scalars(_ list: [JoltTextPiece]) -> [[UInt32]] {
    list.map { $0.text.unicodeScalars.map(\.value) }
  }
  private func dictionaryScript(_ scalar: Unicode.Scalar) -> Bool {
    switch scalar.value {
    case 0x0E00...0x0EFF, 0x1000...0x109F, 0x1780...0x17FF, 0x3040...0x30FF, 0x31F0...0x31FF,
      0x3400...0x4DBF, 0x4E00...0x9FFF, 0xF900...0xFAFF, 0x20000...0x2FA1F:
      true
    default: false
    }
  }

  func testLetterPiecesMatchTheWebGraphemes() throws {
    let data = try fixtures()
    XCTAssertEqual(data["maximumGraphemes"] as? Int, JoltText.maximumGraphemes)
    for sample in data["texts"] as! [[String: Any]] {
      let text = sample["text"] as! String
      let actual = JoltText.pieces(text, by: .letter, locale: locale)
      XCTAssertEqual(actual, pieces(sample["letter"]!), text)
      XCTAssertEqual(scalars(actual), scalars(pieces(sample["letter"]!)), text)
    }
  }

  func testWordPiecesMatchTheWebOutsideDictionaryScripts() throws {
    for sample in try fixtures()["texts"] as! [[String: Any]] {
      let text = sample["text"] as! String
      let expected = pieces(sample["word"]!)
      let actual = JoltText.pieces(text, by: .word, locale: locale)
      XCTAssertEqual(actual.map(\.text).joined(), text)
      XCTAssertEqual(actual.map(\.group), Array(actual.indices))
      if !(sample["dictionary"] as! Bool) {
        XCTAssertEqual(actual, expected, text)
        continue
      }
      let units = Array(text.utf16)
      let joined = { (offset: Int) -> Bool in
        let before = String(decoding: units[..<offset], as: UTF16.self).unicodeScalars.last
        let after = String(decoding: units[offset...], as: UTF16.self).unicodeScalars.first
        return before.map(self.dictionaryScript) == true && after.map(self.dictionaryScript) == true
      }
      let outside = { (list: [JoltTextPiece]) in
        list.map(\.start).filter { $0 > 0 && !joined($0) }
      }
      XCTAssertEqual(outside(actual), outside(expected), text)
    }
  }

  func testEntranceStaggerMatchesTheWeb() throws {
    for sample in try fixtures()["entrances"] as! [[String: Any]] {
      let text = sample["text"] as! String
      let options = try JoltTextEntranceOptions(
        by: JoltTextSplit(rawValue: sample["by"] as! String)!,
        duration: sample["duration"] as! Double, stagger: sample["stagger"] as! Double,
        delay: sample["delay"] as! Double)
      let all = JoltText.pieces(text, by: options.split, locale: locale)
      let visible = all.filter(\.visible)
      let expected = sample["pieces"] as! [[String: Any]]
      XCTAssertEqual(visible.map(\.group), expected.map { $0["group"] as! Int }, text)
      for (piece, timing) in zip(visible, expected) {
        XCTAssertEqual(options.start(of: piece), timing["start"] as! Double)
        XCTAssertEqual(options.start(of: piece) + options.duration, timing["end"] as! Double)
        for point in timing["samples"] as! [[String: Double]] {
          XCTAssertEqual(
            options.progress(of: piece, at: point["at"]!), point["progress"]!, accuracy: 1e-4,
            "\(text) group \(piece.group) at \(point["at"]!)")
        }
      }
      XCTAssertEqual(options.duration(of: all), sample["total"] as! Double, text)
    }
  }

  func testRollDiffMatchesTheWeb() throws {
    for sample in try fixtures()["rolls"] as! [[String: Any]] {
      let previous = sample["previous"] as! String
      let next = sample["next"] as! String
      let diff = JoltText.diff(from: previous, to: next)
      let stagger = sample["stagger"] as! Double
      let delay = sample["delay"] as! Double
      let changes = sample["changes"] as! [[String: Any]]
      XCTAssertEqual(diff.changes.count, changes.count, "\(previous) → \(next)")
      for (index, (change, expected)) in zip(diff.changes, changes).enumerated() {
        XCTAssertEqual(span(change.next), span(expected["next"]))
        XCTAssertEqual(span(change.previous), span(expected["previous"]))
        XCTAssertEqual(
          JoltText.staggeredStart(index, stagger: stagger, delay: delay),
          expected["start"] as! Double)
      }
      let removed = sample["removed"] as! [[String: Any]]
      XCTAssertEqual(diff.removed.map(span), removed.map { span($0["piece"]) })
      for (index, expected) in removed.enumerated() {
        XCTAssertEqual(
          JoltText.staggeredStart(diff.changes.count + index, stagger: stagger, delay: delay),
          expected["start"] as! Double)
      }
    }
  }

  func testSpringFromDurationAndBounceMatchesTheWeb() throws {
    for sample in try fixtures()["springs"] as! [[String: Double]] {
      let transition = try JoltTransition.spring(
        milliseconds: sample["duration"]!, bounce: sample["bounce"]!)
      guard case .spring(let mass, let stiffness, let damping) = transition.kind else {
        return XCTFail("Expected a spring")
      }
      XCTAssertEqual(mass, sample["mass"]!)
      XCTAssertEqual(stiffness, sample["stiffness"]!, accuracy: 1e-9)
      XCTAssertEqual(damping, sample["damping"]!, accuracy: 1e-9)
    }
  }

  func testOptionsRejectInvalidInput() throws {
    XCTAssertThrowsError(try JoltTextEntranceOptions(duration: -1))
    XCTAssertThrowsError(try JoltTextEntranceOptions(stagger: .nan))
    XCTAssertThrowsError(try JoltTextEntranceOptions(delay: 60_001))
    XCTAssertThrowsError(try JoltTextEntranceOptions(y: .infinity))
    XCTAssertThrowsError(try JoltRollOptions(duration: 0))
    XCTAssertThrowsError(try JoltRollOptions(bounce: 1.5))
    XCTAssertThrowsError(try JoltRollOptions(stagger: -1))
    XCTAssertEqual(try JoltRollOptions().transition, try .spring(milliseconds: 600, bounce: 0.2))
    XCTAssertEqual(JoltRollDirection.auto.sign(from: 10, to: 9), -1)
    XCTAssertEqual(JoltRollDirection.auto.sign(from: 9, to: 9), 1)
    XCTAssertEqual(JoltRollDirection.down.sign(from: 1, to: 2), -1)
    XCTAssertEqual(JoltRollDirection.up.sign(from: 2, to: 1), 1)
  }

  func testWhitespaceDrawsNothingAndCanonicalTwinsStillRoll() {
    let pieces = JoltText.pieces("a\u{00A0}\u{3000}b\u{FEFF}", by: .letter)
    XCTAssertEqual(pieces.map(\.visible), [true, false, false, true, false])
    XCTAssertEqual(JoltText.diff(from: "é", to: "e\u{301}").changes.count, 1)
    XCTAssertTrue(JoltText.diff(from: "42", to: "42").changes.isEmpty)
  }
}
