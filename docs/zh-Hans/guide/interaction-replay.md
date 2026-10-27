# 交互回放 {#record-and-replay-an-interaction}

保留重现错误的输入，冻结其预期运动，并在下一个构建中重播它们。可选的 **@rafaelaugusto/jolt/testing** 条目提供版本化数字跟踪、选择加入记录器和基于适配器的运行器。 **@rafaelaugusto/jolt/testing/native** 添加了受控的 Jolt 驱动程序、核心平移捕获和原生演示读取。

::: warning 开发工具
自 **0.1.0-beta.18** 起在核心包中可用。为原生重播助手重建原生应用程序。在隔离的开发装置中使用这些条目。它们不是生产遥测技术，并且不会仅仅通过导入来安装观察器。
:::

<Clip name="interaction-replay-ios" caption="iOS 模拟器，真实的 XCTest 点击和拖动：接受弹簧拍摄，重播它，检测故意错误的检查点，然后取消并重播拖动。重播使用记录的逻辑时间；它的挂钟持续时间不是性能衡量标准。" />

<Clip name="interaction-replay-android" caption="Android 模拟器，具有真实的 ADB 点击和滑动功能。应用程序会在接触继续时取消拖动。首先在引擎中检查保存的轨迹，然后根据原生视图位置进行检查。原始录制速度。" />

## Record only the inputs you choose {#record-only-the-inputs-you-choose}

```ts
import { recordInteraction } from '@rafaelaugusto/jolt/testing'
import {
  observeTraceInputs,
  traceMetadata,
  traceNow,
  traceSettings,
} from '@rafaelaugusto/jolt/testing/native'

const take = recordInteraction({
  now: traceNow,
  seed: 63,
  metadata: traceMetadata(),
  settings: traceSettings(),
  motions: [
    {
      id: 'card',
      kind: 'spring',
      axis: 'x',
      initial: 0,
      stiffness: 170,
      damping: 26,
      mass: 1,
      min: 0,
      max: 240,
      snap: [],
    },
  ],
})

take.input({ type: 'target', id: 'card', value: 180 })
// Apply the same target to your graph. Sample at its controlled clock boundary:
take.checkpoint('card', { position: 0, velocity: 0, settled: false })

// Optional environment capture. These events need an application replay adapter.
const detach = observeTraceInputs(cardView, 'card', take, {
  layout: true,
  keyboard: true,
  lifecycle: true,
})
detach()
const trace = take.stop()
saveFixture(JSON.stringify(trace))
```

调用者拥有持久性和单调时钟。相等的时间戳保留插入顺序。输入包括目标更改、平移位置/速度/接触槽、布局矩形、滚动偏移、键盘插入和生命周期更改。坐标为 DIP，速度为 DIP/s，时间戳为从记录开始算起的毫秒数。接触槽描述了活动接触计数；它们不是原生指针标识，并且不重建多点触摸识别。

该架构拒绝未知字段、未知视图 ID、非有限值、向后时间戳和不受支持的版本。跟踪不包含字段文本、图像字节、视图对象或原生句柄。选择非个人稳定 ID 和操作系统/型号标签。第 1 版将录屏限制为 5,000 个条目、5 分钟和 32 个动作； JSON 输入限制为 2 MB。达到极限的记录器会抛出异常，因此其所有者必须分离观察者并停止记录。

**检查点必须使用与重放相同的逻辑时钟。** 原生动画制作器可以在输入回调之后启动，并呈现比引擎样本晚的帧。预览单独保留原始演示捕获，然后 **拍完** 冻结受控引擎基线一次。后续重播将使用保存的基线而不重新生成它。检查并提交该 JSON 作为回归预言。 Canonical CI 装置使用独立的、冻结的检查点，而不是在每次运行时接受当前的实现。

## 运行引擎，然后运行原生探针 {#run-the-engine-then-the-native-probe}

```ts
import { parseTrace } from '@rafaelaugusto/jolt/testing'
import { motionTraceGraph, replayWithDriver } from '@rafaelaugusto/jolt/testing/native'

const trace = parseTrace(savedJSON)
for (const native of [false, true]) {
  const report = await replayWithDriver(
    trace,
    (trace) => motionTraceGraph(trace.motions, (id) => views.get(id)!, { native }),
    { native },
  )
  if (!report.passed) {
    saveArtifact('trace.json', JSON.stringify(report.trace))
    saveArtifact('expected-observed.svg', report.plot)
    throw new Error(report.errors.join('\n'))
  }
}
```

原生夹具必须已经加载视图。首先配置其时间尺度和解析的简化运动以匹配轨迹。运行程序暂时替换Jolt的全局驱动程序并将其恢复到**终于**中。一次运行一个单独的重播，没有不相关的动画。它不控制保留的实时弹簧时钟或原生手势会话。

**重播时钟** 每个不同的记录时间戳前进一次。 288 毫秒的间隙保持一帧很长。本地轨道被保存并寻找到相应的逻辑时间；探测器在有限的期限内等待两个呈现帧。 iOS 读取表示层而无需模型层回退； Android 以 DIP 读取原生翻译。速度和稳定状态来自引擎，而不是有限差分本地速度测量。

每个检查点都会将位置和速度与明确的公差（默认值：3 DIP 和 30 DIP/s）以及精确的稳定状态进行比较。运行程序在成功、不匹配、取消或错误时处置适配器，然后要求其拥有的资源计数为零。报告包含观察结果、错误、剩余资源、轨迹和预期/观察到的位置图。

## 应用适配器和覆盖范围 {#application-adapters-and-coverage}

参考图使用真实的**动画**、**motionValue**、**绑定**、**拖动**和**motionScope**。它涵盖了#63中的初始情况：中断的弹簧、精确目标切换的连续性、取消的单指针拖动、忽略的取消后运动、生命周期暂停和处置。故意错误的原生检查点必定会失败。回归套件还捕获并修复了发动机在确切的切换时刻下降的传入弹簧速度。

布局、键盘、滚动和加载/卸载事件被保留，但需要应用程序路由。参考图拒绝不支持的事件；它永远不会默默地忽视他们。使用其 **环境** 回调或提供带有 **输入**、**读**、**处置** 和 **资源** 的 **重播适配器**。纯 **replayInteraction** 运行程序接受您的 **advanceTo** 时钟并将本地种子随机函数传递给适配器工厂。它永远不会取代全球 **数学.随机**。

下面的滚动到表格适配器涵盖了 **bottomSheet** 使用的原生手势会话中的联系人所有权。现有的真实操作系统 [手势](./gestures) 和 [底部面板](./bottom-sheet) 测试保留识别器和配方覆盖范围。合成图重播绕过识别器，并且不证明命中测试、键盘动画计时或剪辑。

实验 **57 — 互动重播** 已本地化为英语和葡萄牙语。 [验证指南](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/interaction-replay.md) 列出了命令、工件和限制。

<Clip name="interaction-replay-pt-ios" caption="iOS 模拟器上的巴西葡萄牙语嵌入式预览：真正的春季录制和原生重播，以原始录制速度使用实际的 XCTest 拍子。" />

## 滚动→纸张切换 {#scroll-→-sheet-handoff}

实验57中，选择**滚动 → 表**。在笔记内记录拉动并反转它：在纸张向下移动之前滚动到达顶部；反转时，工作表会在内容滚动之前展开。接受镜头、重放它或故意破坏滚动检查点。

<Clip name="scroll-handoff-replay-ios" caption="iOS 模拟器：真实的 XCTest 将联系人从内容拖动到工作表并返回，然后通过原生会话重播保存的数字跟踪。检测到错误的滚动检查点。原始捕捉速度；重播使用逻辑时间。" />

<Clip name="scroll-handoff-replay-android" caption="Android 模拟器：真实的 ADB 拖动、录制重播和原生所有权负控制。检查图纸平移和原生滚动偏移。没有真机性能声明。" />

```ts
import { parseTrace, scrollHandoffTraceGraph } from '@rafaelaugusto/jolt/testing'
import {
  nativeScrollHandoffTraceGraph,
  replayWithDriver,
} from '@rafaelaugusto/jolt/testing/native'

const trace = parseTrace(savedJSON)
for (const native of [false, true]) {
  const report = await replayWithDriver(
    trace,
    (trace) =>
      native
        ? nativeScrollHandoffTraceGraph(trace.motions, gestureSurface, scrollView)
        : scrollHandoffTraceGraph(trace.motions),
    { native },
  )
  if (!report.passed) saveFailure(report)
}
```

无头适配器是一个独立的所有权合同。原生适配器调用生产手势会话使用的相同消耗代码：iOS 的滚动增量路由和 Android 的预滚动/子滚动/后滚动序列。它不实现第二个原生近似。原始操作系统输入仍然由剪辑中单独的 XCTest/ADB 断言覆盖。

使用 **轴：'y'**、空 **快照** 阵列以及稳定 ID **表** 和 **滚动** 配置两个 **拖动** 运动。滚动最小值为零；其最大值必须与 1 DIP 以内的加载滚动范围相匹配。两个适配器都接受可选的 **{ 工作表，滚动 }** ID 映射。必须加载原生视图，滚动必须是无主 **手势表面** 的垂直后代，并且必须重建原生类。仅重放原生会话会禁用操作系统输入并拒绝已拥有的表面。

输入使用累积窗口相对接触位置；联系成员资格更改变基而不移动工作表。滚动事件设置外部偏移量。取消、暂停和卸载终止旧的联系；恢复/加载需要重新开始。不支持的目标、键盘和布局路由抛出。该适配器保持在释放位置：抛掷、自动卡扣选择和自由运行的固定弹簧属于该配方的单独测试。

**observeScrollHandoffInputs（scrollView，录屏机，traceNow）** 可选择捕获原始 Core 触摸接触和起始滚动偏移；在重播之前处理其返回的函数。捕获是数字的，不包含列表文本或原生句柄。它记录原始接触，而不是识别器的决定。预览会冻结独立合约在捕获期间的预期状态；重播使这些检查点保持不变。标准装置还包括同接触反转、长帧、取消、指针变基、边界和小分数步。 Android 在样本之间携带分数像素，而不是累积舍入误差。

原生报告读取实际的工作表呈现和原生滚动偏移。片材速度是样本移动片材时的原始保持输入速度，否则为零；该适配器不测量滚动速度。稳定状态意味着接触结束并且原生节点处于静止状态。故意错误的滚动检查点必须失败，并且处置必须将原生节点计数返回到其基线。参见 [复制和限制](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-handoff.md)。
