import JoltCore

/// A normalized stop. Its easing applies to the segment starting at this stop.
public struct JoltKeyframe: Sendable {
  public let at: Double, value: Double
  public let curve: [Double]
  public init(_ value: Double, at: Double, ease: JoltEase = .linear) throws {
    guard value.isFinite, abs(value) <= 1e12, at.isFinite, (0...1).contains(at) else {
      throw JoltError.invalidTimeline
    }
    self.value = value
    self.at = at
    guard case .tween(_, let curve) = try JoltTransition.tween(ease: ease).kind else {
      throw JoltError.invalidTransition
    }
    self.curve = curve
  }
  public init(_ value: Double, at: Double, curve: [Double]) throws {
    _ = try JoltTransition.cubicBezier(milliseconds: 1, points: curve)
    guard value.isFinite, abs(value) <= 1e12, at.isFinite, (0...1).contains(at) else {
      throw JoltError.invalidTimeline
    }
    self.value = value
    self.at = at
    self.curve = curve
  }
}
@MainActor public struct JoltKeyframeChannel {
  public let value: JoltMotionValue
  public let frames: [JoltKeyframe]
  public init(_ value: JoltMotionValue, _ frames: [JoltKeyframe]) {
    self.value = value
    self.frames = frames
  }
}
extension JoltTimeline {
  /// Finite passes; autoreverse alternates direction on each pass. At most 60 seconds total.
  /// Compilation validates every channel before taking any scalar lease.
  public static func keyframes(
    _ channels: [JoltKeyframeChannel], duration: Double, iterations: Int = 1,
    autoreverses: Bool = false, clock: JoltClock = .shared, reducedMotion: Bool = false,
    autoplay: Bool = true
  ) throws -> JoltTimeline {
    guard (1...128).contains(channels.count), duration.isFinite, duration > 0,
      (1...100).contains(iterations), duration * Double(iterations) <= 60_000,
      Set(channels.map { ObjectIdentifier($0.value) }).count == channels.count
    else { throw JoltError.invalidTimeline }
    var tracks: [JoltTimelineTrack] = []
    for channel in channels {
      let frames = channel.frames
      guard (2...256).contains(frames.count), frames.first?.at == 0, frames.last?.at == 1,
        zip(frames, frames.dropFirst()).allSatisfy({ $0.at < $1.at }),
        tracks.count + (frames.count - 1) * iterations <= 10_000
      else { throw JoltError.invalidTimeline }
      for pass in 0..<iterations {
        let reverse = autoreverses && pass % 2 == 1
        let indices =
          reverse ? Array((0..<(frames.count - 1)).reversed()) : Array(0..<(frames.count - 1))
        var cursor = Double(pass) * duration
        for (segment, index) in indices.enumerated() {
          let a = frames[index]
          let b = frames[index + 1]
          let c = a.curve
          let curve = reverse ? [1 - c[2], 1 - c[3], 1 - c[0], 1 - c[1]] : c
          let length =
            segment == indices.count - 1
            ? Double(pass + 1) * duration - cursor : (b.at - a.at) * duration
          tracks.append(
            .init(
              channel.value, to: reverse ? a.value : b.value,
              from: reverse ? b.value : a.value,
              at: cursor, transition: try .cubicBezier(milliseconds: length, points: curve)))
          cursor += length
        }
      }
    }
    return try .init(tracks: tracks, clock: clock, reducedMotion: reducedMotion, autoplay: autoplay)
  }
}
