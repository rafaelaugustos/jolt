import JoltSwiftUI
import SwiftUI

@MainActor final class MotionContractsModel: ObservableObject {
  let scope = JoltScope()
  let value: JoltMotionValue
  let trimStart: JoltMotionValue
  let trimEnd: JoltMotionValue
  let drawing: JoltDrawing
  let particles: JoltParticles
  let reorder: JoltReorderModel
  let scroll: JoltScrollProgress
  var timeline: JoltTimeline?
  let first = try! JoltSVGPath(
    "M20 80C20 20 80 20 80 80C80 140 20 140 20 80Z M40 70L60 70L60 90L40 90Z")
  let second = try! JoltSVGPath(
    "M10 80C40 0 100 40 90 80C60 160 0 120 10 80Z M30 60L70 60L70 100L30 100Z")
  @Published var pathTarget = false
  @Published var lastCommit = "Drag a grip toward an edge"
  init() {
    value = try! scope.value(0)
    trimStart = try! scope.value(0)
    trimEnd = try! scope.value(1)
    drawing = try! scope.retain(
      JoltDrawing([
        .init(
          .svg(first), fill: .init(argb: 0xffdb_ff7a),
          stroke: .init(argb: 0xffa8_9aff), lineWidth: 3, lineCap: .round, lineJoin: .bevel,
          fillRule: .evenodd)
      ]))
    particles = try! scope.retain(
      JoltParticles(
        .init(
          colors: [.init(argb: 0xffdb_ff7a), .init(argb: 0xffa8_9aff)],
          lifetime: 3000, size: 5, velocity: 45, angle: -90, spread: 150, source: .bottom,
          capacity: 48)))
    scroll = try! .init()
    reorder = try! scope.retain(
      JoltReorderModel(
        (1...20).map { "Track \($0)" },
        rowHeight: 50, spacing: 6, measuresRows: true))
    try! reorder.updateMeasurements(
      Dictionary(
        uniqueKeysWithValues: reorder.keys.enumerated().map {
          ($0.element, $0.offset.isMultiple(of: 3) ? 66.0 : 50.0)
        }))
  }
  func move() {
    try! value.set(0)
    try! value.animate(to: 240, transition: .spring(mass: 1, stiffness: 25, damping: 5))
  }
  func replace() {
    timeline?.dispose()
    timeline = try! scope.retain(
      JoltTimeline(tracks: [
        .init(value, to: 20, transition: .spring(mass: 1, stiffness: 25, damping: 5))
      ]))
  }
  func morph() {
    pathTarget.toggle()
    try! drawing.morphPath(
      at: 0, to: pathTarget ? second : first,
      transition: .tween(milliseconds: 1800, ease: .linear))
  }
}

private struct ContractReading: View {
  @ObservedObject var value: JoltMotionValue
  var body: some View {
    Text(
      "Position \(value.value, specifier: "%.1f") · velocity \(value.velocity, specifier: "%.1f")"
    )
    .font(.caption.monospacedDigit()).accessibilityIdentifier("contract-value")
  }
}
private struct ParticleReading: View {
  @ObservedObject var field: JoltParticles
  var body: some View {
    Text(
      "\(field.elapsed / 1000, specifier: "%.1f") s · \(field.particles.count) particles · \(field.state.rawValue)"
    )
    .font(.caption.monospacedDigit()).accessibilityIdentifier("contract-particles-status")
  }
}
struct MotionContractsLab: View {
  @StateObject private var model = MotionContractsModel()
  @State private var tab = 0
  @State private var paused = false
  private let accent = Color(red: 0.86, green: 1, blue: 0.48)
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("JOLT · MOTION CONTRACTS").font(.caption.bold()).foregroundStyle(accent)
      Text("Continuity, shape & control").font(.title2.bold())
      Picker("Scene", selection: $tab) {
        Text("Motion").tag(0)
        Text("Custom grip").tag(1)
      }.pickerStyle(.segmented).accessibilityIdentifier("contract-tabs")
      if tab == 0 {
        Text("Velocity survives replacement").font(.headline)
        ZStack(alignment: .leading) {
          RoundedRectangle(cornerRadius: 12).fill(.white.opacity(0.07))
          Circle().fill(accent).frame(width: 34, height: 34).joltBind(.x, to: model.value)
            .padding(.leading, 8).accessibilityIdentifier("contract-marker")
        }.frame(height: 60)
        HStack {
          Button("Spring") { model.move() }.accessibilityIdentifier("contract-spring")
          Button("Replace") { model.replace() }.accessibilityIdentifier("contract-replace")
        }.buttonStyle(.bordered)
        ContractReading(value: model.value)
        Text("SVG morph · independent trim").font(.headline)
        JoltDrawingView(
          model.drawing, strokeStart: model.trimStart, strokeEnd: model.trimEnd,
          viewBox: try! .init(0, 0, 100, 160),
          accessibilityLabel: "Morphing shape with an even-odd cutout"
        )
        .frame(width: 100, height: 150).frame(maxWidth: .infinity)
        HStack {
          Button("Morph") { model.morph() }.accessibilityIdentifier("contract-morph")
          Button("Trim") {
            try! model.trimStart.animate(to: model.trimStart.target == 0 ? 0.2 : 0)
            try! model.trimEnd.animate(to: model.trimEnd.target == 1 ? 0.7 : 1)
          }.accessibilityIdentifier("contract-trim")
        }.buttonStyle(.bordered)
        Text("Continuous, bounded particles").font(.headline)
        JoltParticlesView(model.particles).frame(height: 100).background(
          .white.opacity(0.04), in: RoundedRectangle(cornerRadius: 12))
        ParticleReading(field: model.particles)
        HStack {
          Button("Emit") { try! model.particles.emit(rate: 12, duration: nil) }
            .accessibilityIdentifier("contract-emit")
          Button(paused ? "Resume" : "Pause") {
            paused.toggle()
            if paused { model.scope.pause() } else { model.scope.play() }
          }.accessibilityIdentifier("contract-pause")
          Button("Clear") { model.particles.cancel() }.accessibilityIdentifier("contract-clear")
        }.buttonStyle(.bordered)
      } else {
        ContractReorder(model: model.reorder, scroll: model.scroll)
      }
      Spacer(minLength: 0)
    }.padding(18).background(Color(red: 0.047, green: 0.071, blue: 0.13))
      .preferredColorScheme(.dark).joltScope(model.scope)
  }
}

private struct ContractReorder: View {
  @ObservedObject var model: JoltReorderModel
  @ObservedObject var scroll: JoltScrollProgress
  @State private var connection: JoltObservation?
  @State private var pointer = 0.0
  @State private var edgeIndex = 0
  @State private var key: String?
  @State private var taps = 0
  private let coordinate = "contract-reorder-space"
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Your grip. Jolt's edge clock.").font(.headline)
      Text("Only the purple grip drags. Row buttons keep their own actions.").font(.subheadline)
        .foregroundStyle(.secondary)
      Text(
        "First: \(model.keys.first ?? "") · offset \(scroll.offset, specifier: "%.0f") · actions \(taps)"
      )
      .font(.caption.monospacedDigit()).accessibilityIdentifier("contract-order")
      GeometryReader { geometry in
        ScrollViewReader { proxy in
          JoltScrollView(progress: scroll) {
            VStack(spacing: model.spacing) {
              ForEach(model.preview, id: \.self) { item in
                HStack {
                  Image(systemName: "circle.grid.2x2.fill").foregroundStyle(.white)
                    .frame(width: 44, height: 44).background(
                      .purple, in: RoundedRectangle(cornerRadius: 10)
                    )
                    .contentShape(Rectangle()).accessibilityLabel("Move \(item)")
                    .accessibilityIdentifier("contract-grip-" + item)
                    .gesture(
                      DragGesture(minimumDistance: 4, coordinateSpace: .named(coordinate))
                        .onChanged { event in
                          if key == nil {
                            key = item
                            edgeIndex = model.keys.firstIndex(of: item) ?? 0
                            model.begin(
                              item, pointerY: event.startLocation.y, scrollOffset: scroll.offset)
                          }
                          pointer = event.location.y
                          model.move(
                            viewportY: pointer, scrollOffset: scroll.offset,
                            viewportHeight: geometry.size.height)
                        }.onEnded { _ in
                          model.end()
                          key = nil
                        })
                  Text(item).frame(maxWidth: .infinity, alignment: .leading)
                  Button("Play") { taps += 1 }.accessibilityIdentifier("contract-row-" + item)
                }.padding(.horizontal, 8).frame(height: model.height(for: item))
                  .background(
                    .white.opacity(model.active == item ? 0.16 : 0.06),
                    in: RoundedRectangle(cornerRadius: 12)
                  ).id(item)
              }
            }
          }.coordinateSpace(name: coordinate).accessibilityIdentifier("contract-list")
            .onAppear {
              model.resume()
              connection = try? model.connectEdgeScroll { direction in
                let visible =
                  model.index(
                    at: max(0, scroll.offset + (direction > 0 ? geometry.size.height : 0)),
                    inPreview: true) ?? 0
                let next = min(
                  model.keys.count - 1,
                  max(0, direction > 0 ? max(edgeIndex + 1, visible) : min(edgeIndex - 1, visible)))
                guard next != edgeIndex else { return false }
                edgeIndex = next
                proxy.scrollTo(model.preview[next], anchor: direction > 0 ? .bottom : .top)
                return true
              }
            }
            .onChange(of: scroll.offset) { _, _ in
              model.move(
                viewportY: pointer, scrollOffset: scroll.offset,
                viewportHeight: geometry.size.height)
            }
            .onDisappear {
              model.suspend()
              connection?.dispose()
              connection = nil
            }
        }
      }
    }
  }
}
