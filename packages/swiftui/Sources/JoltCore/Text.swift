import CoreFoundation
import Foundation

public enum JoltTextSplit: String, CaseIterable, Sendable { case letter, word }

/// A grapheme or word segment of a string. Offsets count UTF-16 code units, like the Web and
/// NativeScript; `group` is the position in text order, whitespace included.
public struct JoltTextPiece: Equatable, Sendable {
  public let text: String
  public let start: Int
  public let end: Int
  public let group: Int
  public init(text: String, start: Int, end: Int, group: Int) {
    self.text = text
    self.start = start
    self.end = end
    self.group = group
  }
  /// Whitespace keeps its place in the order but draws nothing.
  public var visible: Bool { !text.unicodeScalars.allSatisfy(JoltText.isWhitespace) }
  public static func == (a: Self, b: Self) -> Bool {
    a.start == b.start && a.end == b.end && a.group == b.group
      && a.text.unicodeScalars.elementsEqual(b.text.unicodeScalars)
  }
}

public struct JoltRollChange: Equatable, Sendable {
  /// The grapheme that rolls in, placed in the new text.
  public let next: JoltTextPiece
  /// The grapheme it replaces at the same position from the end, when there is one.
  public let previous: JoltTextPiece?
}

public struct JoltRollDiff: Equatable, Sendable {
  /// Positions that differ, from the last one backwards.
  public let changes: [JoltRollChange]
  /// Old graphemes to the left of the new text's first one; they roll out alone.
  public let removed: [JoltTextPiece]
}

/// Text splitting and alignment shared with the Web `animateText` and `rollTo`.
public enum JoltText {
  public static let maximumGraphemes = 256

  /// Extended grapheme clusters, so accented letters and joined emoji stay whole.
  public static func graphemes(_ text: String) -> [JoltTextPiece] {
    var pieces: [JoltTextPiece] = []
    var offset = 0
    for character in text {
      let length = character.utf16.count
      pieces.append(
        .init(text: String(character), start: offset, end: offset + length, group: pieces.count))
      offset += length
    }
    return pieces
  }

  /// Letters are graphemes. Words are the Unicode word segments the system tokenizer reports for
  /// `locale`, with spaces and punctuation as pieces of their own.
  public static func pieces(
    _ text: String, by split: JoltTextSplit, locale: Locale = .current
  ) -> [JoltTextPiece] {
    let letters = graphemes(text)
    guard split == .word, !letters.isEmpty else { return letters }
    let string = text as NSString
    let length = string.length
    let tokenizer = CFStringTokenizerCreate(
      nil, string as CFString, CFRange(location: 0, length: length),
      kCFStringTokenizerUnitWordBoundary, locale as CFLocale)
    let edges = Set(letters.map(\.start))
    var bounds: [Int] = [0]
    while !CFStringTokenizerAdvanceToNextToken(tokenizer).isEmpty {
      let range = CFStringTokenizerGetCurrentTokenRange(tokenizer)
      for edge in [range.location, range.location + range.length]
      where edge > bounds.last! && edge < length && edges.contains(edge) {
        bounds.append(edge)
      }
    }
    bounds.append(length)
    return zip(bounds, bounds.dropFirst()).enumerated().map { group, range in
      .init(
        text: string.substring(with: NSRange(location: range.0, length: range.1 - range.0)),
        start: range.0, end: range.1, group: group)
    }
  }

  /// Milliseconds from the start of the effect until the piece at `index` begins.
  public static func staggeredStart(_ index: Int, stagger: Double, delay: Double) -> Double {
    delay + Double(index) * stagger
  }

  /// Aligns both texts on their last grapheme, so the units digit stays put when the count grows.
  /// Graphemes compare by their exact scalars, as the Web does.
  public static func diff(from previous: String, to next: String) -> JoltRollDiff {
    let before = graphemes(previous)
    let after = graphemes(next)
    var changes: [JoltRollChange] = []
    var removed: [JoltTextPiece] = []
    for offset in stride(from: 1, through: max(before.count, after.count), by: 1) {
      let old = offset <= before.count ? before[before.count - offset] : nil
      let piece = offset <= after.count ? after[after.count - offset] : nil
      if let piece {
        if old.map({ !$0.text.unicodeScalars.elementsEqual(piece.text.unicodeScalars) }) ?? true {
          changes.append(.init(next: piece, previous: old))
        }
      } else if let old {
        removed.append(old)
      }
    }
    return .init(changes: changes, removed: removed)
  }

  /// The characters JavaScript's `String.prototype.trim` removes.
  static func isWhitespace(_ scalar: Unicode.Scalar) -> Bool {
    switch scalar.value {
    case 0x09...0x0D, 0x20, 0xA0, 0x1680, 0x2000...0x200A, 0x2028, 0x2029, 0x202F, 0x205F,
      0x3000, 0xFEFF:
      true
    default: false
    }
  }
}

/// Validated text entrance: each piece fades in and rises `y` points to its place on an ease-out
/// tween of `duration` milliseconds, starting `delay + group × stagger` milliseconds in.
public struct JoltTextEntranceOptions: Equatable, Sendable {
  public let split: JoltTextSplit
  public let duration: Double
  public let stagger: Double
  public let delay: Double
  public let y: Double
  public init(
    by split: JoltTextSplit = .letter, duration: Double = 400, stagger: Double = 35,
    delay: Double = 0, y: Double = 12
  ) throws {
    guard [duration, stagger, delay].allSatisfy({ $0.isFinite && (0...60_000).contains($0) }),
      y.isFinite, abs(y) <= 10_000
    else { throw JoltError.invalidMotion }
    self.split = split
    self.duration = duration
    self.stagger = stagger
    self.delay = delay
    self.y = y
  }
  public func start(of piece: JoltTextPiece) -> Double {
    JoltText.staggeredStart(piece.group, stagger: stagger, delay: delay)
  }
  /// Eased progress from 0 to 1 at `elapsed` milliseconds since the entrance began. A zero
  /// duration shows every piece at once, whatever the delay.
  public func progress(of piece: JoltTextPiece, at elapsed: Double) -> Double {
    guard duration > 0 else { return 1 }
    let motion = try! JoltScalarMotion(
      from: 0, to: 1, transition: .tween(milliseconds: duration, ease: .easeOut))
    return motion.sample(at: elapsed - start(of: piece)).position
  }
  /// Milliseconds until the last visible piece arrives; zero when nothing draws.
  public func duration(of pieces: [JoltTextPiece]) -> Double {
    pieces.filter(\.visible).map { start(of: $0) + duration }.max() ?? 0
  }
}

public enum JoltRollDirection: String, CaseIterable, Sendable {
  case auto, up, down
  /// 1 rolls up (the old glyph leaves through the top), -1 rolls down. `auto` rolls down only to
  /// a lower number.
  public func sign(from previous: Double, to next: Double) -> Double {
    switch self {
    case .up: 1
    case .down: -1
    case .auto: next < previous ? -1 : 1
    }
  }
}

/// Validated rolling number timing, shared with the Web `rollTo` defaults.
public struct JoltRollOptions: Equatable, Sendable {
  public let duration: Double
  public let bounce: Double
  public let stagger: Double
  public let delay: Double
  public let direction: JoltRollDirection
  public let transition: JoltTransition
  public init(
    duration: Double = 600, bounce: Double = 0.2, stagger: Double = 0, delay: Double = 0,
    direction: JoltRollDirection = .auto
  ) throws {
    guard [stagger, delay].allSatisfy({ $0.isFinite && (0...60_000).contains($0) }) else {
      throw JoltError.invalidMotion
    }
    transition = try .spring(milliseconds: duration, bounce: bounce)
    self.duration = duration
    self.bounce = bounce
    self.stagger = stagger
    self.delay = delay
    self.direction = direction
  }
}

extension JoltTransition {
  /// A spring described like SwiftUI's: `milliseconds` is the period of the undamped spring and
  /// `bounce` runs from -1 (overdamped) through 0 (critically damped) to 1. Bounce is limited to
  /// ±0.99, as on the Web.
  public static func spring(milliseconds: Double, bounce: Double) throws -> Self {
    guard milliseconds.isFinite, milliseconds > 0, milliseconds <= 60_000, bounce.isFinite,
      (-1...1).contains(bounce)
    else { throw JoltError.invalidTransition }
    let omega = 2 * Double.pi / (milliseconds / 1000)
    let b = min(max(bounce, -0.99), 0.99)
    let ratio = b >= 0 ? 1 - b : 1 / (1 + b)
    return try .spring(mass: 1, stiffness: omega * omega, damping: 2 * ratio * omega)
  }
}
