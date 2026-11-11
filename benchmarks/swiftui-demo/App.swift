import JoltSwiftUI
import SwiftUI

#if os(macOS)
  import AppKit
#endif

@main struct JoltSwiftUIDemo: App {
  private let activityLab = ProcessInfo.processInfo.arguments.contains("--activity-lab")
  @ViewBuilder private var root: some View {
    if activityLab {
      ActivityLab()
    } else if ProcessInfo.processInfo.arguments.contains("--panel-lab") {
      PanelLab()
    } else if ProcessInfo.processInfo.arguments.contains("--geometry-lab") {
      GeometryLab()
    } else if ProcessInfo.processInfo.arguments.contains("--key-gesture-lab") {
      KeyGestureLab()
    } else if ProcessInfo.processInfo.arguments.contains("--transfer-lab") {
      TransferLab()
    } else if ProcessInfo.processInfo.arguments.contains("--character-lab") {
      CharacterLab()
    } else if ProcessInfo.processInfo.arguments.contains("--dynamics-lab") {
      DynamicsLab()
    } else if ProcessInfo.processInfo.arguments.contains("--graphics-lab") {
      GraphicsLab()
    } else if ProcessInfo.processInfo.arguments.contains("--viewport-lab") {
      ViewportLab()
    } else if ProcessInfo.processInfo.arguments.contains("--interaction-lab") {
      InteractionLab()
    } else if ProcessInfo.processInfo.arguments.contains("--composition-lab") {
      CompositionLab()
    } else if ProcessInfo.processInfo.arguments.contains("--scroll-lab") {
      ScrollLab()
    } else if ProcessInfo.processInfo.arguments.contains("--text-lab") {
      TypographyLab()
    } else if ProcessInfo.processInfo.arguments.contains("--depth-lab") {
      DepthLab()
    } else {
      Demo()
    }
  }
  var body: some Scene {
    WindowGroup {
      #if os(macOS)
        root.frame(width: 560, height: min(850, (NSScreen.main?.visibleFrame.height ?? 866) - 16))
      #else
        root
      #endif
    }
    #if os(macOS)
      .windowResizability(.contentSize)
    #endif
    #if os(macOS)
      WindowGroup("Second", id: "second") {
        ActivityProbe(host: "Second").frame(width: 300, height: 150)
          .background(Color(red: 0.06, green: 0.08, blue: 0.12)).preferredColorScheme(.dark)
      }
      .windowResizability(.contentSize)
      .defaultPosition(.topTrailing)
      Settings {
        ActivityProbe(host: "Settings").frame(width: 300, height: 150)
      }
      MenuBarExtra("Jolt activity", systemImage: "bolt.circle", isInserted: .constant(activityLab)) {
        ActivityProbe(host: "Menu bar").frame(width: 300, height: 150)
      }
      .menuBarExtraStyle(.window)
    #endif
  }
}

struct Demo: View {
  @State private var pose: JoltPose = .identity
  @State private var mounted = true
  @State private var identity = 0
  @State private var actions = 0
  @State private var reduced = false
  @State private var preset: JoltPreset = .popIn
  @State private var presetActive = false
  @Environment(\.scenePhase) private var phase
  private let green = Color(red: 0.86, green: 1, blue: 0.48)
  private let move = try! JoltPose(x: 80, y: -12, scale: 1.08, rotate: 18)
  private let interrupt = try! JoltPose(x: -65, y: 8, scale: 0.9, rotate: -15)
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          Text("JOLT · SWIFTUI").font(.caption.bold()).tracking(2).foregroundStyle(green)
          Text("Swift motion.\nShared recipes.").font(
            .system(size: 34, weight: .bold, design: .rounded))
          Text(
            "A standalone Swift Package. State changes drive motion, and SwiftUI owns the view lifecycle."
          ).foregroundStyle(.secondary)
          ZStack {
            RoundedRectangle(cornerRadius: 24).fill(Color.white.opacity(0.05))
            if mounted {
              Button {
                actions += 1
              } label: {
                VStack(spacing: 8) {
                  Image(systemName: "sparkles").font(.title)
                  Text("Press me").font(.headline)
                }.frame(width: 112, height: 112).background(
                  green, in: RoundedRectangle(cornerRadius: 24)
                ).foregroundStyle(.black)
              }.buttonStyle(.plain)
                .accessibilityIdentifier("motion-card")
                .joltMotion(to: pose, transition: .spring(.bouncy))
                .id(identity)
            }
          }.frame(height: 190)
          HStack {
            Button("Move") { pose = move }.accessibilityIdentifier("move")
            Button("Interrupt") { pose = interrupt }.accessibilityIdentifier("interrupt")
            Button("Reset") { pose = .identity }.accessibilityIdentifier("reset")
          }.buttonStyle(.bordered)
          HStack {
            Button("Replace") { identity += 1 }.accessibilityIdentifier("replace")
            Button(mounted ? "Unmount" : "Remount") { mounted.toggle() }.accessibilityIdentifier(
              "toggle")
          }.buttonStyle(.bordered)
          Toggle("Reduce motion", isOn: $reduced).tint(green).accessibilityIdentifier("reduce")
          Text("Actions: \(actions) · Identity: \(identity)").font(.caption.monospacedDigit())
            .foregroundStyle(.secondary).accessibilityIdentifier("counts")
          Divider()
          Text("Recipes shared with native and Web").font(.headline)
          Picker("Preset", selection: $preset) {
            Text("Pop").tag(JoltPreset.popIn)
            Text("Rise").tag(JoltPreset.fadeInUp)
            Text("Zoom").tag(JoltPreset.zoomIn)
          }.pickerStyle(.segmented)
          ZStack {
            RoundedRectangle(cornerRadius: 20).stroke(Color.white.opacity(0.16))
            Text("JOLT").font(.system(size: 28, weight: .black, design: .rounded)).tracking(4)
              .frame(width: 160, height: 70).background(
                Color.indigo, in: RoundedRectangle(cornerRadius: 16)
              )
              .joltPreset(preset, active: presetActive)
          }.frame(height: 115)
          HStack {
            Button("Preset start") { presetActive = false }.accessibilityIdentifier("preset-start")
            Button("Play preset") { presetActive = true }.accessibilityIdentifier("preset-play")
          }.buttonStyle(.bordered)
          NavigationLink("Open details") {
            VStack(spacing: 16) {
              Image(systemName: "checkmark.seal").font(.largeTitle)
              Text("SwiftUI owns navigation and removal.")
              Text("Jolt adds no JavaScript runtime or persistent frame timer.").foregroundStyle(
                .secondary)
            }.padding().navigationTitle("Lifecycle")
          }.accessibilityIdentifier("details")
          NavigationLink("Interaction lab") { InteractionLab() }
          NavigationLink("Composition lab") { CompositionLab() }
          NavigationLink("Scroll lab") { ScrollLab() }
          NavigationLink("Dynamics lab") { DynamicsLab() }
          NavigationLink("Graphics lab") { GraphicsLab() }
          NavigationLink("Viewport lab") { ViewportLab() }
          NavigationLink("Activity lab") { ActivityLab() }
          NavigationLink("Text lab") { TypographyLab() }
          NavigationLink("Depth lab") { DepthLab() }
          Text(phase == .active ? "Scene active" : "Scene inactive").font(.caption).foregroundStyle(
            .secondary
          ).accessibilityIdentifier("phase")
        }.padding(24)
      }.background(Color(red: 0.06, green: 0.08, blue: 0.12)).preferredColorScheme(.dark)
    }.joltReduceMotion(reduced)
  }
}
