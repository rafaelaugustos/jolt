# SwiftUI：文字入场与滚动数字

等待 [PR #488](https://github.com/rafaelaugustos/jolt/pull/488) 合并并发布；0.1.0-rc.13 尚未包含。 支持 iOS 17+ 和 macOS 14+，无需 NativeScript 或 JavaScript。平台限制请参阅[安装](./swiftui)、[生命周期](./swiftui-motion)和[交互与几何](./swiftui-geometry)。它们沿用 Web 的 [`animateText` 与 `rollTo`](./web-effects#text)，并通过可移植核心共享拆分、错开和对齐规则。

<Clip name="swiftui-text-ios" caption="iOS 模拟器，原生 SwiftUI：一句话按词和按字母入场并可重播，一行希伯来文按从右到左的顺序入场，货币和百分比数值上下滚动并被中途打断，以及“减弱动态效果”和更大的动态字体。不是实体设备录制。" />

<Clip name="swiftui-text-macos" caption="macOS 原生 SwiftUI，由真实的 XCTest 鼠标点击驱动：按词和按字母入场并重播，货币和百分比滚动并被中途打断，以及“减弱动态效果”。macOS 没有动态字体。" />

## 文字入场

`JoltTextEntrance` 持有一个字符串及其播放状态。`JoltAnimatedText` 把它绘制为单个 SwiftUI `Text`，样式来自外层的 `font`、`foregroundStyle`、`multilineTextAlignment` 和 `lineLimit` 修饰符。每个可见片段的不透明度从 0 变为 1，并以 ease-out 补间上升 `y` 点回到原位。默认值与 Web 相同：按字母、每个片段 400 毫秒、错开 35 毫秒、无延迟、12 点。

```swift
@StateObject private var title = try! JoltTextEntrance(
    "Motion should feel like it belongs to the words it carries.",
    options: .init(by: .word, duration: 400, stagger: 70, y: 12))

JoltAnimatedText(title).font(.title2.bold())
Button("重播") { title.replay() }
// try title.replay("新的标题")   // 先校验，再重播
```

`by: .letter` 按扩展字素簇拆分，因此带重音的字母、旗帜或组合的家庭表情都是一个片段。`by: .word` 使用系统分词器针对当前区域设置给出的 Unicode 单词片段；空格和标点各自成为片段。空白不绘制任何内容，但在顺序中保留位置：位于第 _k_ 个位置的片段在 `delay + k × stagger` 毫秒时开始，空格也计入，与 Web 完全一致。入场持续到最后一个可见片段到位。时长为零时，无论延迟多少，都会立即显示完整文字。

时长、错开和延迟均为有限的毫秒数，范围 0 到 60,000。`y` 以点为单位，有限，范围 ±10,000；负值从上方进入。文字最多 256 个字素，最后一个片段必须在 60,000 毫秒内到位。无效输入会在任何改变之前抛出 `JoltError.invalidMotion`：用无效字符串调用 `replay(_:)` 时，当前入场继续播放。

入场是由 `JoltClock` 驱动的 `JoltResource`。它创建后即开始播放；`autoplay: false` 时会隐藏在第一帧，直到调用 `play()` 或 `replay()`。`pause()` 冻结播放；`cancel()` 显示完整文字并保留重播能力；`dispose()` 永久显示完整文字。`state`、`elapsed` 和 `progress` 报告播放状态。`JoltScope` 可以持有它。视图离屏、iOS 场景不活跃，或 macOS 窗口隐藏、最小化或被遮挡时，`JoltAnimatedText` 会挂起它；手动暂停在恢复后仍然保留。播放开始前、暂停期间和完成之后都不运行时钟。

**无障碍。** 视图是一个无障碍元素，其标签从第一帧起就是完整字符串，与片段当前的绘制状态无关。片段不会增加元素。

**减弱动态效果。** 系统设置、祖先视图上的 `joltReduceMotion(true)` 以及 `reducedMotion: true` 都会立即显示最终文字并完成入场。在入场过程中开启它也会立即完成入场。

**布局、动态字体与从右到左。** 在 iOS 18 和 macOS 15 及以上版本中，每个片段都是同一个已排版 `Text` 中的一段文字，由 `TextRenderer` 绘制。换行、动态字体、双向排序和阿拉伯文连写都由 SwiftUI 自身处理；视图尺寸与普通 `Text` 相同。入场过程中动态字体发生变化时，文字会重新排版，播放从当前时间继续。在从右到左的文字中，片段按阅读顺序入场，因此希伯来文或阿拉伯文最右侧的第一个词最先进入。字母移动期间，跨越两个片段的连字会被绘制为分开的字母；静止时视图就是普通 `Text`。移动中的字形最多会绘制到框外 `y` 点。在没有 `TextRenderer` 的 iOS 17 和 macOS 14 上，视图直接显示最终文字，入场一开始即完成。macOS 没有动态字体。

**平台差异。** 按字母拆分时与 Web 逐字素一致。单词边界来自各平台的文本引擎：Web 使用 `Intl.Segmenter`，Apple 使用系统分词器。凡由 Unicode 单词规则决定之处两者一致，共享测试数据针对英文、标点、表情符号、组合附加符号、韩文、阿拉伯文、希伯来文和数字进行了验证。中文和日文的单词来自不同的词典：`你好世界` 在 Web 上是 `你好 | 世界`，在 Apple 上是 `你 | 好 | 世界`。NativeScript 的 `animateText` 与两者都不同：那里空格不增加字母步数，标点并入所属单词。

## 滚动数字

`JoltRollingNumber` 保存一个数值以及应用格式化器为它生成的文字。`roll(to:)` 会立即设置 `value`、`text` 和无障碍值；只有绘制在移动。`JoltRollingText` 负责绘制：在每个发生变化的位置，屏幕上的字形滑出，新字形以弹簧滑入。保持不变的字形不会移动。

```swift
@StateObject private var balance = try! JoltRollingNumber(
    1249.9,
    format: { $0.formatted(.currency(code: "CNY")) },
    options: .init(duration: 600, bounce: 0.2, stagger: 0))

HStack {
    Text("余额")
    Spacer()
    JoltRollingText(balance)  // tabular: true, alignment: .trailing
        .font(.largeTitle.bold())
        .accessibilityLabel("余额")
}
Button("存入") { try? balance.roll(to: 12980.6) }
```

`format` 是 `@MainActor (Double) -> String`，返回结果最多 256 个字素；默认的 `JoltRollingNumber.plain` 把整数写成不带小数的形式，其他数值写成 Swift 的最短十进制表示。数值必须有限。`duration`（大于 0，最多 60,000 毫秒）和 `bounce`（−1 到 1）与 SwiftUI 和 Web 一样描述弹簧：`JoltTransition.spring(milliseconds:bounce:)` 返回与 Web 相同的刚度和阻尼，bounce 限制在 ±0.99。`stagger` 和 `delay` 为 0 到 60,000 毫秒。无效输入会在文字或正在进行的滚动改变之前抛出错误。

两个字符串都会拆分为字素，并按最后一个字素对齐，因此数字变大时个位保持不动：`99` 变为 `100` 时，两个 9 滚动为 0，左侧滚入一个 `1`。字素按精确的 Unicode 标量比较，与 Web 相同，因此 `é` 与“`e` 加组合重音符”也会滚动。错开从右侧开始计算发生变化的位置，然后是没有替换、单独滚出的旧字素。`direction: .auto` 在数值变大时向上滚动，变小时向下滚动；向上滚动表示旧字形从顶部离开，新字形从下方进入。`roll(to:direction:)` 可以单次覆盖方向。`set(_:)` 直接跳转而不滚动。

**中途打断。** 滚动过程中设置新目标时，`text` 和无障碍值立即更新。在两个目标中相同的字形继续按原来的方式移动。其他字形从当前绘制的位移和不透明度离开，因此不会跳动。最多保留八代正在离开的字形；更早的会消失。在 Web 上，新目标会把当前绘制内容压平，并让整段新文字滚入。

**绘制与布局。** 移动中的字形会被裁剪在所在行内，如同里程表。视图采用新文字的尺寸，并以支持动态字体的原生 `Text` 排版。离开的字形按自然宽度排成一行，并放在视图内的 `alignment` 位置：默认的 `.trailing` 让各列从末尾对齐，适合末尾对齐的行中的数字。请使用容器在宽度变化时保持固定的那一侧对齐；固定宽度或 `tabular: true`（等宽数字，默认开启）可获得最稳定的列。在从右到左的布局中，`.trailing` 是左边缘；当数字位于从右到左的文字中时，请显式设置对齐方式。在 iOS 17 和 macOS 14 上会立即显示最终文字。

**无障碍与减弱动态效果。** 视图是一个元素，从变化的第一帧起，其无障碍值就是格式化后的目标；请用 `.accessibilityLabel` 为它设置标签。“减弱动态效果”、`joltReduceMotion(true)` 和 `reducedMotion: true` 会立即显示最终文字。滚动数字也是 `JoltResource`，暂停、挂起、作用域和释放规则与文字入场相同。

## 共享测试数据

`npm run swiftui:check` 会从可移植核心重新生成 `Fixtures/text.json`，数据过期时检查失败。其中包括：含 ASCII、标点、ZWJ 表情序列、组合附加符号、中日韩文字、阿拉伯文、希伯来文和混合数字的字符串按字母和按词拆分的片段；三组时长/错开/延迟组合下入场的开始时间和缓动进度；带错开时间的滚动差异；以及由时长和 bounce 得到的弹簧参数。`JoltCoreTests` 会全部复现，其中中文和日文的单词边界只在词典分词片段之外比较。
