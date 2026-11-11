import JoltSwiftUI
import SwiftUI

private let typeAccent = Color(red: 0.86, green: 1, blue: 0.48)
private let typeBackdrop = Color(red: 0.06, green: 0.08, blue: 0.12)
private let sentence = "Motion should feel like it belongs to the words it carries."
private let hebrew = "שלום עולם, ברוכים הבאים"
private let english = Locale(identifier: "en_US")
@MainActor private func dollars(_ value: Double) -> String {
  value.formatted(.currency(code: "USD").locale(english))
}
@MainActor private func percent(_ value: Double) -> String {
  (value / 100).formatted(.percent.precision(.fractionLength(1)).locale(english))
}
@MainActor private final class TypographyModel: ObservableObject {
  let scope = JoltScope()
  @Published private(set) var entrance: JoltTextEntrance
  @Published private(set) var rtl: JoltTextEntrance
  let balance: JoltRollingNumber
  let share: JoltRollingNumber
  init() {
    entrance = try! scope.retain(
      JoltTextEntrance(sentence, options: .init(by: .word, stagger: 70)))
    rtl = try! scope.retain(JoltTextEntrance(hebrew, options: .init(by: .word, stagger: 110)))
    balance = try! scope.retain(JoltRollingNumber(1249.9, format: dollars))
    share = try! scope.retain(
      JoltRollingNumber(42.5, format: percent, options: .init(stagger: 45)))
  }
  func enter(by split: JoltTextSplit, reduced: Bool) {
    scope.release(entrance)
    scope.release(rtl)
    let stagger: Double = split == .word ? 70 : 16
    entrance = try! scope.retain(
      JoltTextEntrance(
        sentence, options: .init(by: split, stagger: stagger), reducedMotion: reduced))
    rtl = try! scope.retain(
      JoltTextEntrance(
        hebrew, options: .init(by: split, stagger: stagger * 1.5), reducedMotion: reduced))
  }
  func replay() {
    entrance.replay()
    rtl.replay()
  }
}
private struct EntranceStatus: View {
  @ObservedObject var entrance: JoltTextEntrance
  var body: some View {
    let split = entrance.options.split.rawValue
    let state = entrance.state.rawValue
    Text("Entrance: \(split) · \(state) · \(entrance.progress, specifier: "%.2f")")
    .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
    .accessibilityIdentifier("text-status")
  }
}
private struct RollStatus: View {
  @ObservedObject var balance: JoltRollingNumber
  @ObservedObject var share: JoltRollingNumber
  var body: some View {
    Text("Roll: \(balance.state.rawValue) · \(balance.text) · \(share.text)")
      .font(.caption.monospacedDigit()).foregroundStyle(.secondary)
      .accessibilityIdentifier("roll-status")
  }
}
struct TypographyLab: View {
  @StateObject private var model = TypographyModel()
  @State private var reduced = false
  @State private var large = false
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        Text("JOLT · TEXT").font(.caption.bold()).tracking(2).foregroundStyle(typeAccent)
        JoltAnimatedText(model.entrance).font(.title2.bold())
          .frame(maxWidth: .infinity, alignment: .leading)
          .accessibilityIdentifier("text-sentence")
        JoltAnimatedText(model.rtl).font(.headline).foregroundStyle(typeAccent)
          .environment(\.layoutDirection, .rightToLeft)
          .frame(maxWidth: .infinity, alignment: .trailing)
          .accessibilityIdentifier("text-rtl")
        HStack {
          Button("By word") { model.enter(by: .word, reduced: reduced) }
            .accessibilityIdentifier("text-word")
          Button("By letter") { model.enter(by: .letter, reduced: reduced) }
            .accessibilityIdentifier("text-letter")
          Button("Replay") { model.replay() }.accessibilityIdentifier("text-replay")
        }.buttonStyle(.bordered)
        EntranceStatus(entrance: model.entrance)
        Divider()
        HStack(alignment: .firstTextBaseline) {
          Text("Balance").font(.headline).foregroundStyle(.secondary)
          Spacer()
          JoltRollingText(model.balance)
            .font(.system(size: 40, weight: .bold, design: .rounded))
            .accessibilityLabel("Balance").accessibilityIdentifier("roll-balance")
        }
        HStack {
          Button("Deposit") { try! model.balance.roll(to: 12980.6) }
            .accessibilityIdentifier("roll-up")
          Button("Spend") { try! model.balance.roll(to: 980.4) }
            .accessibilityIdentifier("roll-down")
          Button("Reset") { try! model.balance.roll(to: 1249.9) }
            .accessibilityIdentifier("roll-reset")
        }.buttonStyle(.bordered)
        HStack(alignment: .firstTextBaseline) {
          Text("Share").font(.headline).foregroundStyle(.secondary)
          Spacer()
          JoltRollingText(model.share).font(.title.bold()).foregroundStyle(typeAccent)
            .accessibilityLabel("Share").accessibilityIdentifier("roll-share")
        }
        HStack {
          Button("Share 87.5%") { try! model.share.roll(to: 87.5) }
            .accessibilityIdentifier("share-up")
          Button("Share 9.8%") { try! model.share.roll(to: 9.8) }
            .accessibilityIdentifier("share-down")
        }.buttonStyle(.bordered)
        RollStatus(balance: model.balance, share: model.share)
        Toggle("Reduce motion", isOn: $reduced).accessibilityIdentifier("text-reduce")
        #if os(iOS)
          Toggle("Larger text", isOn: $large).accessibilityIdentifier("text-large")
        #endif
        Text(
          "One Text per string keeps wrapping, Dynamic Type and right-to-left native. "
            + "VoiceOver reads the sentence once, and the target number from the first frame."
        ).font(.caption).foregroundStyle(.secondary)
      }.padding(24)
        .dynamicTypeSize(large ? .accessibility1 ... .accessibility1 : .xSmall ... .accessibility5)
    }.background(typeBackdrop).preferredColorScheme(.dark).joltScope(model.scope)
      .joltReduceMotion(reduced)
  }
}
