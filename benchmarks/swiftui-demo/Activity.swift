import JoltSwiftUI
import SwiftUI

#if os(macOS)
  import AppKit
#endif

@MainActor final class ActivityLog: ObservableObject {
  static let shared = ActivityLog()
  @Published private(set) var entries: [String] = []
  func record(_ host: String, active: Bool) {
    entries.append("\(host) \(active ? "active" : "inactive")")
    if entries.count > 12 { entries.removeFirst(entries.count - 12) }
  }
}

struct ActivityProbe: View {
  let host: String
  var body: some View { ActivityReadout(host: host).joltActivity() }
}

private struct ActivityReadout: View {
  let host: String
  @Environment(\.scenePhase) private var phase
  @Environment(\.joltActive) private var active
  @StateObject private var scope = JoltScope()
  @State private var value: JoltMotionValue?
  @State private var legs = 0
  @State private var frames: [Double] = []
  @State private var observation: JoltObservation?
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(host).font(.headline)
      ZStack(alignment: .leading) {
        Capsule().fill(Color.white.opacity(0.08)).frame(height: 28)
        if let value {
          Circle().fill(Color(red: 0.86, green: 1, blue: 0.48)).frame(width: 24, height: 24)
            .joltBind(.x, to: value).accessibilityIdentifier("activity-dot-\(host)")
        }
      }.frame(width: 220)
      Text(readout).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
        .accessibilityIdentifier("activity-\(host)")
    }
    .padding(16)
    .joltScope(scope)
    .onAppear(perform: start)
    .onChange(of: active) { _, next in ActivityLog.shared.record(host, active: next) }
  }
  private var readout: String {
    let name: String =
      switch phase {
      case .active: "active"
      case .inactive: "inactive"
      default: "background"
      }
    let position = Int((value?.value ?? 0).rounded())
    let rate = frames.count > 1 ? Double(frames.count - 1) / ((frames.last! - frames.first!) / 1000) : 0
    return "\(host): phase \(name) · jolt \(active ? "active" : "inactive") · x \(position) · legs \(legs) · \(Int(rate.rounded())) Hz"
  }
  private func start() {
    guard value == nil, let next = try? scope.value(0) else { return }
    value = next
    observation = try? next.subscribe { _ in
      let now = Date().timeIntervalSinceReferenceDate * 1000
      frames.append(now)
      frames.removeAll { $0 < now - 1000 }
    }
    leg(next, to: 196)
  }
  private func leg(_ value: JoltMotionValue, to target: Double) {
    try? value.animate(
      to: target, transition: .tween(milliseconds: 900, ease: .easeInOut)
    ) { completed in
      guard completed else { return }
      legs += 1
      leg(value, to: target == 0 ? 196 : 0)
    }
  }
}

struct ActivityLab: View {
  @ObservedObject private var log = ActivityLog.shared
  #if os(macOS)
    @Environment(\.openWindow) private var openWindow
  #endif
  @State private var pointer = JoltPointerSample.center
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        Text("JOLT · ACTIVITY").font(.caption.bold()).tracking(2)
        Text(
          "Each host reads its own scene phase and Jolt's activity. On the Mac, activity follows the hosting window, not focus."
        ).foregroundStyle(.secondary)
        ActivityProbe(host: "Main")
        #if os(macOS)
          HStack {
            Button("Second window") {
              openWindow(id: "second")
              DispatchQueue.main.async { HostedWindows.placeBeside("Second") }
            }
              .accessibilityIdentifier("open-second")
            Button("NSHostingView") { HostedWindows.open(.view) }
              .accessibilityIdentifier("open-hosting-view")
            Button("NSHostingController") { HostedWindows.open(.controller) }
              .accessibilityIdentifier("open-hosting-controller")
          }.buttonStyle(.bordered)
          HStack {
            Button("Cover hosted windows") { HostedWindows.cover() }
              .accessibilityIdentifier("cover-hosted")
            Button("Uncover") { HostedWindows.uncover() }
              .accessibilityIdentifier("uncover-hosted")
          }.buttonStyle(.bordered)
        #endif
        RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.06))
          .frame(height: 90)
          .overlay(Text("Pointer").foregroundStyle(.secondary))
          .joltPointerFollow { pointer = $0 }
          .accessibilityElement(children: .ignore)
          .accessibilityLabel("Pointer area")
          .accessibilityIdentifier("activity-pointer-area")
        Text(
          "Pointer: \(pointer.active ? "active" : "centered") \(String(format: "%.2f", pointer.x)), \(String(format: "%.2f", pointer.y))"
        ).font(.caption.monospacedDigit()).accessibilityIdentifier("activity-pointer")
        Text("Log: " + log.entries.joined(separator: ", ")).font(.caption)
          .foregroundStyle(.secondary).accessibilityIdentifier("activity-log")
      }.padding(24)
    }
    .background(Color(red: 0.06, green: 0.08, blue: 0.12)).preferredColorScheme(.dark)
  }
}

#if os(macOS)
  @MainActor enum HostedWindows {
    enum Kind { case view, controller }
    private static var windows: [NSWindow] = []
    static func open(_ kind: Kind) {
      let host = kind == .view ? "NSHostingView" : "NSHostingController"
      let root = ActivityProbe(host: host).frame(width: 300, height: 150)
        .background(Color(red: 0.06, green: 0.08, blue: 0.12)).preferredColorScheme(.dark)
      let window: NSWindow
      if kind == .view {
        window = NSWindow(
          contentRect: .init(x: 0, y: 0, width: 300, height: 150),
          styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.contentView = NSHostingView(rootView: root)
      } else {
        window = NSWindow(contentViewController: NSHostingController(rootView: root))
      }
      window.title = host
      window.isReleasedWhenClosed = false
      window.setFrameOrigin(
        .init(x: 80 + Double(windows.count) * 330, y: 80))
      windows.append(window)
      window.makeKeyAndOrderFront(nil)
    }
    static func placeBeside(_ title: String) {
      guard let main = NSApp.windows.first(where: { $0.title == "JoltSwiftUIMac" }),
        let window = NSApp.windows.first(where: { $0.title == title })
      else { return }
      window.setFrameOrigin(.init(x: main.frame.maxX + 16, y: main.frame.maxY - window.frame.height))
    }
    static func cover() {
      guard let main = NSApp.windows.first(where: { $0.title == "JoltSwiftUIMac" }) else { return }
      for window in windows {
        window.setFrame(
          .init(
            x: main.frame.midX - window.frame.width / 2,
            y: main.frame.midY - window.frame.height / 2,
            width: window.frame.width, height: window.frame.height), display: true)
        window.order(.below, relativeTo: main.windowNumber)
      }
      main.makeKeyAndOrderFront(nil)
    }
    static func uncover() {
      for (index, window) in windows.enumerated() {
        window.setFrameOrigin(.init(x: 80 + Double(index) * 330, y: 80))
        window.orderFront(nil)
      }
    }
  }
#endif
