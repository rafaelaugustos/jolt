import SwiftUI

private struct SheetHeightKey: PreferenceKey {
  static let defaultValue = 0.0
  static func reduce(value: inout Double, nextValue: () -> Double) {
    value = max(value, nextValue())
  }
}
/// A bounded in-app panel. Background controls are excluded while open; returnFocus restores the app's opener.
public struct JoltBottomSheet<Background: View, Content: View>: View {
  @ObservedObject private var model: JoltSheetModel
  private let label: String
  private let background: () -> Background
  private let content: () -> Content
  private let returnFocus: () -> Void
  @StateObject private var scroll = makeSheetScroll()
  @State private var contentHeight = 0.0
  @State private var keyboardOverlap = 0.0
  @State private var visible = false
  @State private var handleContact = false
  @State private var contentContact = false
  @State private var contentOrigin = 0.0
  @GestureState private var handleActive = false
  @GestureState private var contentActive = false
  @FocusState private var handleFocused: Bool
  @AccessibilityFocusState private var accessibilityFocused: Bool
  @Environment(\.scenePhase) private var phase
  @Environment(\.isEnabled) private var enabled
  @Environment(\.accessibilityReduceMotion) private var reduced
  @Environment(\.joltReduceMotion) private var appReduced
  public init(
    _ model: JoltSheetModel, label: String,
    returnFocus: @escaping () -> Void = {},
    @ViewBuilder background: @escaping () -> Background,
    @ViewBuilder content: @escaping () -> Content
  ) {
    self.model = model
    self.label = label
    self.returnFocus = returnFocus
    self.background = background
    self.content = content
  }
  private func synchronize() {
    model.setReducedMotion(reduced || appReduced)
    if visible && enabled && phase == .active { model.resume() } else { model.suspend() }
  }
  private func measure(_ geometry: GeometryProxy) {
    guard geometry.size.height > 0, !model.disposed else { return }
    try? model.updateLayout(
      height: geometry.size.height, contentHeight: contentHeight + 48,
      safeTop: geometry.safeAreaInsets.top, safeBottom: geometry.safeAreaInsets.bottom,
      keyboardOverlap: keyboardOverlap)
  }
  private var handleGesture: some Gesture {
    DragGesture(minimumDistance: 4, coordinateSpace: .global)
      .updating($handleActive) { _, state, _ in state = true }
      .onChanged { event in
        if !handleContact {
          handleContact = true
          handleFocused = true
          _ = model.beginDrag()
        }
        model.drag(by: event.translation.height)
      }.onEnded { event in
        model.endDrag(velocity: event.velocity.height)
        handleContact = false
      }
  }
  private var scrollingGesture: some Gesture {
    DragGesture(minimumDistance: 8, coordinateSpace: .global)
      .updating($contentActive) { _, state, _ in state = true }
      .onChanged { event in
        if !contentContact {
          // Expand before scrolling; a downward drag at the scroll origin returns to the panel.
          let handoff =
            (!model.canExpand && scroll.offset <= 0.5 && event.translation.height > 0)
            || (model.canExpand && event.translation.height < 0)
            || (model.canExpand && scroll.offset <= 0.5 && event.translation.height > 0)
          if handoff && model.beginDrag() {
            contentContact = true
            contentOrigin = event.translation.height
          }
        }
        if contentContact { model.drag(by: event.translation.height - contentOrigin) }
      }.onEnded { event in
        if contentContact { model.endDrag(velocity: event.velocity.height) }
        contentContact = false
      }
  }
  public var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .top) {
        background().frame(maxWidth: .infinity, maxHeight: .infinity)
          .disabled(model.isOpen).accessibilityHidden(model.isOpen)
        if let layout = model.geometry, !model.disposed {
          Color.black.opacity(0.35 * min(1, model.visibleHeight / max(1, layout.height)))
            .contentShape(Rectangle()).onTapGesture { model.dismiss() }
            .allowsHitTesting(model.isOpen && model.dismissible).accessibilityHidden(true)
          VStack(spacing: 0) {
            Button {
              if model.canExpand { model.expand() } else if model.canCollapse { model.collapse() }
            } label: {
              HStack {
                Image(systemName: "line.3.horizontal")
                Text(label).font(.headline)
                Spacer()
                Text("\(Int(model.visibleHeight)) pt").font(.caption.monospacedDigit())
              }.padding(.horizontal, 16).frame(height: 48).frame(maxWidth: .infinity)
                .contentShape(Rectangle())
            }.buttonStyle(.plain).highPriorityGesture(handleGesture)
              .accessibilityIdentifier("jolt-sheet-handle")
              .accessibilityLabel(label)
              .accessibilityValue("\(Int(model.visibleHeight)) points")
              .accessibilityActions {
                if model.canExpand { Button("Expand") { model.expand() } }
                if model.canCollapse { Button("Collapse") { model.collapse() } }
                if model.dismissible { Button("Dismiss") { model.dismiss() } }
              }
              .focusable().focused($handleFocused).accessibilityFocused($accessibilityFocused)
              .modifier(SheetKeys(model: model))
            JoltScrollView(progress: scroll) {
              content().frame(maxWidth: .infinity).fixedSize(horizontal: false, vertical: true)
                .background(
                  GeometryReader { contentGeometry in
                    Color.clear.preference(
                      key: SheetHeightKey.self, value: contentGeometry.size.height)
                  })
            }
            .accessibilityIdentifier("jolt-sheet-scroll")
            .scrollDisabled(model.canExpand || model.dragging)
            .simultaneousGesture(scrollingGesture)
          }
          .frame(
            width: geometry.size.width, height: max(1, model.visibleHeight) + layout.bottomExtension
          )
          .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
          .clipShape(RoundedRectangle(cornerRadius: 18))
          .offset(y: layout.top + model.position)
          .allowsHitTesting(model.isOpen && enabled && phase == .active)
          .accessibilityHidden(!model.isOpen)
        }
      }
      .frame(width: geometry.size.width, height: geometry.size.height).clipped()
      .transaction { $0.animation = nil }
      .modifier(SheetExit(model: model))
      .background(
        SheetKeyboardProbe(active: visible && enabled && phase == .active && !model.disposed) {
          keyboardOverlap = $0
        }.allowsHitTesting(false).accessibilityHidden(true)
      )
      .onPreferenceChange(SheetHeightKey.self) { next in
        if abs(contentHeight - next) > 0.5 {
          contentHeight = next
          measure(geometry)
        }
      }
      .onAppear {
        visible = true
        synchronize()
        measure(geometry)
        handleFocused = model.isOpen
        accessibilityFocused = model.isOpen
      }
      .onDisappear {
        visible = false
        synchronize()
      }
      .onChange(of: geometry.size) { _, _ in measure(geometry) }
      .onChange(of: geometry.safeAreaInsets) { _, _ in measure(geometry) }
      .onChange(of: keyboardOverlap) { _, _ in measure(geometry) }
      .onChange(of: model.isOpen) { _, next in
        handleFocused = next
        accessibilityFocused = next
        if !next { returnFocus() }
      }
      .onChange(of: phase) { _, _ in synchronize() }
      .onChange(of: enabled) { _, _ in synchronize() }
      .onChange(of: reduced) { _, _ in synchronize() }
      .onChange(of: appReduced) { _, _ in synchronize() }
      .onChange(of: handleActive) { _, next in
        if !next {
          if handleContact { model.cancel() }
          handleContact = false
        }
      }
      .onChange(of: contentActive) { _, next in
        if !next {
          if contentContact { model.cancel() }
          contentContact = false
        }
      }
    }
  }
}
private struct SheetKeys: ViewModifier {
  @ObservedObject var model: JoltSheetModel
  func body(content: Content) -> some View {
    #if os(macOS)
      content.onMoveCommand { direction in
        if direction == .up { model.expand() }
        if direction == .down { model.collapse() }
      }
    #else
      content
    #endif
  }
}
@MainActor private func makeSheetScroll() -> JoltScrollProgress { try! .init() }

private struct SheetExit: ViewModifier {
  @ObservedObject var model: JoltSheetModel
  func body(content: Content) -> some View {
    #if os(macOS)
      content.onExitCommand { if model.isOpen { model.dismiss() } }
    #else
      content
    #endif
  }
}
