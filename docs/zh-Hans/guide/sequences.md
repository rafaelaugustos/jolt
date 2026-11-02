# 动画序列 {#sequences-and-timelines}

## 联合播放 {#joint-playback}

`timeline(steps)` 接受与 `sequence()` 相同的视图元组和位置，加上动画值元组和可播放工厂：

```ts
const scene = timeline([
  [car, { path: route, orient: true }, { duration: 8000, ease: 'linear' }],
  [pulse, 1, { duration: 1000, repeat: 7, repeatType: 'reverse', at: '<' }],
  { at: 0, run: () => imageEffect(image, 'ripple', { duration: 8000 }) },
  [checkpoint, 'fadeIn', { at: 4000 }],
])
scene.pause()
scene.play()
await scene.finished
```

<Clip name="controlled-playback-ios" caption="一个暂停控制冻结活动运动、波纹和未来检查点，然后恢复它们的剩余计时。 iOS模拟器，实时。" />
<Clip name="controlled-playback-android" caption="联合时间线暂停和恢复与Android模拟器上的实际输入实时。" />

暂停保留正在运行的参与者和未来的启动，包括间隙和重叠。播放从该位置恢复，无需重新启动效果或计算暂停的挂钟间隔。两个命令都是幂等的。停止取消活动和挂起的工作，将 `finished` 解析为 false，并保持终端状态。作用域可以创建 `scope.timeline(steps)` 或拥有返回的句柄。

参与者必须公开 `pause()`、`play()` 和 `paused` 以及动画生命周期。视图动画、动画值动画、嵌套时间线、图像效果和 [原生属性动画](./native-properties) 支持此功能。 `shimmer()` 等清理函数和 `animateText()` 等纯基础动画则不会。不支持的回调结果拒绝 `finished` 并清理已开始和待处理的工作。工厂在激活时运行，因此在返回之前无法检查其能力。它们不相关的副作用是工厂作者的责任。

| 参与者                             | 联合暂停/恢复        | 持续时间                           |
| ---------------------------------- | -------------------- | ---------------------------------- |
| 视图/路径 `animate()` 和 `decay()` | 是                   | 有限或无限                         |
| `animate(motionValue)` 和标量层    | 是                   | 有限或无限                         |
| `imageEffect()`                    | 是                   | 有限；畸变是无限的                 |
| 原生适配器 `.animate()`            | 是                   | 有限或无限                         |
| 嵌套时间线                         | 是                   | 在每一步激活之前都可能保持未知状态 |
| 定制工厂                           | 必须执行播放合约     | 可选；总体进展需要它               |
| `animateText()` 和清理函数         | 否；使用`sequence()` | 不适用                             |

时间线不提供通用的搜索设置器：回调、触觉和触摸驱动效果不能作为一个组安全地倒回。 `duration` 是 `undefined`，直到每个步骤都处于活动状态、准备就绪并声明持续时间，然后是最大计划结束时间（或无限工作）。一旦该持续时间有限，`playbackProgress(scene)` 即可使用。当合成还包含无尽或尚未计划的效果时，观察已知的有限主轨道。在工厂使用新鲜的手柄；采用已经运行的句柄不会倒带或重新调整其过去的播放。

父级仅恢复其暂停的子级。独立暂停的子级保持暂停状态，停止/完成的句柄保持终端状态。独立寻找子视图或手动延迟可能会使时间线的计算结束时间无效；使用聚合进度时通过其父级控制场景。子中断保留现有的序列到达/所有权规则并使最终完成错误。

原生曲目保留原生播放。 JavaScript 在激活和控制边界运行，因此阻止 JavaScript 可能会延迟新工厂的启动。此 API 不声明任意回调的原生执行。应用程序所有者可以像演示一样在后台暂停并明确恢复。

## 顺序播放 {#sequential-playback}

如果没有位置，每一步都会在前一步看起来完成后开始：

<Clip name="timeline" caption="重叠的步骤和按顺序的步骤。" />

```ts
await sequence([
  [logo, 'popIn'],
  [[title, subtitle], 'fadeInUp', { stagger: 80 }],
  () => animate(button, 'fadeIn'),
])
```

每个元组采用与 `animate()` 相同的参数，并在其选项中加上 `at` 。回调可以启动并返回动画。当弹簧在完全稳定之前接近目标时，即视为已到达。

## 重叠和固定位置 {#overlap-and-fixed-positions}

```ts
sequence([
  [logo, 'popIn'],
  [title, 'fadeInUp', { at: '-150' }],
  [buttons, 'fadeIn', { at: '<', stagger: 50 }],
  [footer, 'fadeIn', { at: 900 }],
])
```

| `at`     | 开始该步骤          |
| -------- | ------------------- |
| 省略     | 在上一步到达时      |
| `'-150'` | 到达前 150 毫秒     |
| `'+100'` | 到达后 100 毫秒     |
| `'<'`    | 与上一步的激活一起  |
| `900`    | 距序列原点 900 毫秒 |

所有位置都使用毫秒的动画时间。数字位置是绝对且非负的；相对偏移量是带符号的十进制字符串。绝对位置独立于早期步骤，并且可能不按时间顺序显示。每个未定位的步骤仍遵循 **上一个列出的步骤**，而不是最后完成的动画。

`'<'` 指的是在步骤自己的 `delay` 之前激活。该延迟及其每个酒店的延迟仍然适用。例如，共享一个延迟 200 毫秒和 50 毫秒开始的两个步骤开始相隔 150 毫秒移动。

第一步使用序列原点作为参考：`'<'`、`'-150'`和`0`立即开始； `'+100'` 等待 100 毫秒。在其前任激活之前的负偏移量被固定到该激活。调度程序不会倒带动画来恢复错过的开始。

要将命名弹簧与位置组合，请使用其对象形式：

```ts
import { sequence, springs } from '@rafaelaugusto/jolt'

sequence([
  [card, 'popIn'],
  [title, 'fadeInUp', { ...springs.bouncy, at: '-100' }],
])
```

## 到达和装载 {#arrivals-and-loading}

负偏移量使用实际轨道的到达预测，包括初始延迟、每个属性的计时、重复和最后交错视图。卸载的目标会等到其轨迹存在后再提供预测。绝对激活时间保持独立；他们的目标仍在等待加载，然后才能开始原生播放。

返回 `animate()` 或 `decay()` 的回调也提供预测。暂停、播放或寻找该句柄会重新安排待处理的负关注者。一旦关注者启动，以后的更改就不会撤消或重播它。

任意效果、自定义动画或嵌套序列不会公开预测。它可以位于未定位步骤、正偏移量或 `'<'` 之前；由于设置错误而拒绝 `finished` 并取消序列的其他工作后，会出现负偏移。无尽的动画没有有限的预测；它的相关追随者会等待，直到它被打断。绝对位置仍然可以开始其他步骤。

正偏移遵循 **实际到货**。如果上一步在预测之前被中断，则额外等待将从该中断开始。当其前任被打断时，未决的负追随者也会前进，而不是保留过时的截止日期。

## 起始价值和所有权 {#starting-values-and-ownership}

稍后的视图在创建序列时采用其第一个绝对关键帧，因此它们在轮到之前保持隐藏状态。准备工作保持列表顺序：涉及属性的第一个列出的步骤提供其初始状态，即使绝对位置不按时间顺序排列。相对和 `null` 关键帧在其步骤激活时读取当前值。

同一属性上的重叠步骤使用正常的 [中断规则](./interrupting)：稍后的激活接管屏幕上的值和速度。显式的第一个关键帧仍然设置显式的开始。不同的属性和视图保持独立。

## 完成和清理 {#completion-and-cleanup}

一旦 **每** 步骤开始并到达，序列就到达。它的 `finished` 承诺等待所有启动的动画完成稳定，包括较长的重叠步骤。如果任何步骤被中断或停止，则会以 `false` 进行解析。这包括在同一财产上故意重叠。

`stop()` 取消未来的启动并停止所有活动或稳定步骤。当时间线的所有者离开屏幕时调用它：

```ts
const animation = sequence(steps)
onUnmounted(() => animation.stop())
```

返回的句柄保留基本 `Animation` 生命周期；整个时间线暂停和擦洗不会暴露。在开始或应用关键帧之前抛出无效位置。创建回调时出错或延迟步骤在取消其他工作后拒绝 `finished`；播放取消本身通过 `false` 解决。

## 原生计时 {#native-timing}

在Android上，位置计时器和绝对时间线时钟遵循系统的**动画师持续时间比例**。禁用动画后，定位步骤将继续前进，而无需等待其请求的持续时间。 iOS使用其动画时钟。

JavaScript 在步骤激活时运行，而不是每个动画帧运行一次。阻塞的 JS 线程可能会延迟启动；当 JavaScript 不可用时，此 API 无法启动新的 JS 创建的步骤。一旦步骤开始，其正常的原生播放和平台限制将适用。

游乐场使用同一入口比较重叠、顺序到达和固定时间。

## RC.6：可定位的有限场景 {#seekable-scenes}

`seekableTimeline()` 为**0.1.0-rc.6**增加显式声明式契约。现有 `timeline()` 和 `sequence()` 保留回调行为。

```ts
const scene = seekableTimeline(
  [
    {
      target: card,
      keyframes: { x: [0, 160] },
      transition: { duration: 1600, ease: 'linear' },
    },
    {
      target: card,
      at: 400,
      keyframes: { scale: [1, 1.5], opacity: [0.4, 1] },
      transition: { duration: 800 },
    },
    { value: progress, keyframes: [0, 1], transition: { duration: 1600 } },
  ],
  { paused: true },
)
scene.progress = 0.6
scene.progress = 1
scene.progress = 0.2
scene.play()
```

| 参与者                                       | 契约                                                      |
| -------------------------------------------- | --------------------------------------------------------- |
| 已加载的原生视图                             | transforms/opacity 的显式有限数值关键帧；支持命名 layer。 |
| 数值 `motionValue()`                         | 基础通道；现有绑定跟随场景时间。                          |
| 嵌套 `{ at, steps }`                         | 准备时展开；位置是所在场景内的绝对毫秒。                  |
| 回调、实时 follower、手势、触觉和现有 handle | 在修改所有权之前拒绝；使用现有 timeline 接口。            |

每个目标/属性/layer 只能有一个 track；连续动作应写进其关键帧。嵌套场景之间的重复通道也会拒绝。没有可独立控制的子 handle。首版不含 null/当前值帧、path、绘制/装饰、相对配方、stagger 或数值 layer。支持内置/cubic-bezier easing 和有限 spring/tween/gravity；不支持回调 easing 或随机重复间隔。上限为 256 通道、16 层嵌套、100 次重复、每 track 未缩放十分钟、每编译通道 100,000 个样本。

全部验证与编译先于所有权变更。延迟 track 保持显式初值，短 track 保持终值直到场景结束。重复会展开为原生关键帧；loop 重置最多占场景区间的百万分之一，以避免 float 零长度区间。普通播放无需逐帧 JavaScript 协调器，并遵循全局 timeScale 和 Android animator 时钟。

Seek 保持暂停/播放状态。旧场景不能夺回新应用动画接管的通道；其余通道继续，发生中断后整体完成结果为 false。暂停的终点可后退；完成或停止后 handle 终止。后台会暂停并自动恢复原本播放的场景，显式暂停保持暂停。视图卸载结束场景，重新加载需要新 handle。编译时读取减少动态效果设置：空间轨迹直接到终值，opacity 保留时间。构建失败会停止本场景刚创建的工作。

<Clip name="seekable-scene-ios" caption="iOS 模拟器，英文界面：真实滑块操作定位位置、重叠的缩放/透明度及绑定的进度值，并从暂停终点后退。" />
<Clip name="seekable-scene-android" caption="Android 模拟器，英文界面：ADB 真实滑块手势和播放控制验证相同有限场景。原始速度，不代表实体设备性能。" />

[原生验证与复现](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-capabilities.md).
