public import JoltCore
import SwiftUI

public typealias JoltScrollHeaderGeometry = JoltCore.JoltScrollHeaderGeometry

/// Owns the scroll source/ranges; the caller owns the header's content and stable row keys.
@MainActor public final class JoltScrollHeaderController: ObservableObject, JoltResource {
  @Published public private(set) var geometry: JoltScrollHeaderGeometry
  private var measurement = 0
  public let scroll: JoltScrollController
  public let collapse: JoltScrollProgress, title: JoltScrollProgress, toolbar: JoltScrollProgress
  public var disposed: Bool { scroll.disposed }
  public init(geometry: JoltScrollHeaderGeometry, clock: JoltClock = .shared) throws {
    self.geometry=geometry; scroll=try JoltScrollController(clock: clock)
    collapse=try scroll.progress.subrange(0...geometry.range)
    title=try scroll.progress.subrange((geometry.titleFade.lowerBound*geometry.range)...(geometry.titleFade.upperBound*geometry.range))
    toolbar=try scroll.progress.subrange((geometry.toolbarFade.lowerBound*geometry.range)...(geometry.toolbarFade.upperBound*geometry.range))
    scroll.pinnedHeight=geometry.minimum+geometry.section
  }
  /// Update measured sizes after dynamic type/content changes; preserve the visible content edge.
  public func remeasure(_ geometry: JoltScrollHeaderGeometry? = nil) async throws {
    guard !disposed else { throw JoltError.disposed }
    measurement += 1
    let request=measurement, revision=scroll.revision
    let before=self.geometry, offset=scroll.progress.offset
    if let geometry {
      self.geometry=geometry; scroll.pinnedHeight=geometry.minimum+geometry.section
      try collapse.setRange(0...geometry.range)
      try title.setRange((geometry.titleFade.lowerBound*geometry.range)...(geometry.titleFade.upperBound*geometry.range))
      try toolbar.setRange((geometry.toolbarFade.lowerBound*geometry.range)...(geometry.toolbarFade.upperBound*geometry.range))
    }
    await scroll.remeasure()
    if geometry != nil && request == measurement && revision == scroll.revision && !disposed { try scroll.scrollTo(self.geometry.resizedOffset(offset, from: before), animated: false) }
  }
  @discardableResult public func scrollToTop(animated: Bool = true) throws -> Bool { try scroll.scrollToTop(animated: animated) }
  @discardableResult public func scrollTo(_ offset: Double, animated: Bool = true) throws -> Bool { try scroll.scrollTo(offset, animated: animated) }
  @discardableResult public func preserveAnchor(_ change: @MainActor () async throws -> Void) async rethrows -> Bool { try await scroll.preserveAnchor(change) }
  public func pause() { scroll.pause() }
  public func play() { scroll.play() }
  public func suspend() { scroll.suspend() }
  public func resume() { scroll.resume() }
  public func dispose() { scroll.dispose() }
}

/// Retained overlays, one content spacer, and one native scroll probe. Toolbar/section stay pinned.
public struct JoltScrollHeader<Artwork: View, Title: View, Toolbar: View, CompactTitle: View, Section: View, Content: View>: View {
  @ObservedObject private var controller: JoltScrollHeaderController
  @ObservedObject private var progress: JoltScrollProgress
  private let artwork: () -> Artwork, title: () -> Title, toolbar: () -> Toolbar
  private let compactTitle: () -> CompactTitle, section: () -> Section, content: () -> Content
  @Environment(\.joltEffectiveReduceMotion) private var reduced
  @AccessibilityFocusState private var titleFocus: Bool
  @AccessibilityFocusState private var compactFocus: Bool
  public init(controller: JoltScrollHeaderController,
    @ViewBuilder artwork: @escaping () -> Artwork, @ViewBuilder title: @escaping () -> Title,
    @ViewBuilder toolbar: @escaping () -> Toolbar, @ViewBuilder compactTitle: @escaping () -> CompactTitle,
    @ViewBuilder section: @escaping () -> Section, @ViewBuilder content: @escaping () -> Content) {
    self.controller=controller; self.progress=controller.scroll.progress
    self.artwork=artwork; self.title=title; self.toolbar=toolbar; self.compactTitle=compactTitle; self.section=section; self.content=content
  }
  private func fade(_ interval: ClosedRange<Double>, _ p: Double) -> Double { min(1,max(0,(p-interval.lowerBound)/(interval.upperBound-interval.lowerBound))) }
  public var body: some View {
    let geometry=controller.geometry
    let p=min(1,max(0,progress.offset/geometry.range)), collapse=min(geometry.range,progress.offset)
    let compact=p >= (reduced ? geometry.handoff : geometry.focusHandoff)
    let titleAlpha=reduced ? (p>geometry.handoff ? 0.0:1.0) : 1-fade(geometry.titleFade,p)
    let toolbarAlpha=reduced ? (p>geometry.handoff ? 1.0:0.0) : fade(geometry.toolbarFade,p)
    ZStack(alignment: .top) {
      JoltScrollView(controller: controller.scroll) {
        VStack(spacing: 0) {
          Color.clear.frame(height: geometry.spacer).accessibilityHidden(true)
          content()
        }
      }
      ZStack(alignment: .bottomLeading) {
        artwork().frame(maxWidth: .infinity).frame(height: geometry.expanded)
          .offset(y: reduced ? 0 : geometry.parallax*p).accessibilityHidden(true).allowsHitTesting(false)
        title().opacity(titleAlpha).accessibilityHidden(compact).accessibilityFocused($titleFocus)
          .allowsHitTesting(!compact)
      }.frame(height: geometry.expanded, alignment: .bottomLeading).clipped().offset(y: -collapse)
      section().frame(maxWidth: .infinity).frame(height: geometry.section).offset(y: geometry.expanded-collapse)
      ZStack { toolbar(); compactTitle().accessibilityFocused($compactFocus) }
        .frame(maxWidth: .infinity).frame(height: geometry.minimum).opacity(toolbarAlpha)
        .accessibilityHidden(!compact).allowsHitTesting(compact)
    }
    .clipped().contentShape(Rectangle()).transaction { $0.animation=nil }
    .onChange(of: compact) { _, next in
      if next && titleFocus { compactFocus=true }
      else if !next && compactFocus { titleFocus=true }
    }
  }
}
