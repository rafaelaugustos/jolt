# 跟随键盘 {#follow-the-keyboard}

使用软件键盘移动作曲家、按钮或工具栏：

<Clip name="keyboard" caption="作曲家在 Android 上跟随键盘。" />

```ts
import { followKeyboard } from '@rafaelaugusto/jolt'

const release = followKeyboard(composer)
followKeyboard(sendButton, { offset: 12 })
```

当键盘出现时，视图会以键盘自身的速度和曲线精确地上升其原本应覆盖的距离。当键盘改变高度时，视图也会随之改变。当它隐藏起来时，视野就会恢复原状。键盘无法到达的视图会停留在原来的位置。

目标是一个视图或任何持有视图的东西，例如 `animate()`。在键盘出现之前附加效果；它对键盘变化做出反应，并且不会自行读取键盘的当前位置。

## 偏移量 {#offset}

`offset` 在视图的底部边缘和键盘之间保留额外的 DIPs：

```ts
followKeyboard(composer, { offset: 8 })
```

默认值为零，因此视图结束于触摸键盘顶部。

## 什么移动 {#what-moves}

该效果拥有视图的 `translateY`。它写入 NativeScript 属性，因此应用程序读取的值和值 Jolt 开始其下一个动画是屏幕上的值。在键盘接管之前，`y` 上的任何 Jolt 动画都会停止在当前位置，因此两者永远不会打架。其他属性和其他视图未受影响。

当键盘移动时，测量视图的未平移位置。不跟随键盘打开时的布局更改；接下来键盘再次更改措施。

## iOS {#ios}

Jolt 遵循 `UIKeyboardWillChangeFrameNotification`，涵盖 iPad 上的显示、隐藏、高度变化以及拆分和浮动布局。通知携带键盘的结束帧、持续时间和曲线。该帧被转换为视图的窗口，并且视图在具有该持续时间和曲线的 `UIView` 动画内移动，因此它在整个运动中保持连接到键盘边缘。曲线是私有值，仅存在于动画选项中； Jolt 会为您做到这一点。

硬件键盘和零持续时间更改立即应用新位置。

<Clip name="keyboard-ios" caption="在 iOS 模拟器上，作曲家随键盘一起升起，并在隐藏时向后倾斜，而 onKeyboard() 则缩小键盘自身弹簧上的徽章。实时播放。" />

## Android {#android}

Android 11 及更高版本通过 `WindowInsetsAnimation` 报告每一帧的键盘进度。 Jolt 在视图上安装原生回调，因此每帧工作在 Java 中运行，并且当键盘移动时不会与 JavaScript 交叉。回调测量键盘布局之前和之后的视图，因此它适用于 `adjustResize`（视图已布局在键盘上方，仅平滑运动）以及 `adjustPan` 和 `adjustNothing`（视图通过其重叠进行平移）。 JavaScript 在运动开始时调用一次，在运动结束时调用一次。

应用程序的活动需要设置 `android:windowSoftInputMode`，就像 NativeScript 模板已经对 `adjustResize` 所做的那样，以便窗口接收键盘插入。升级后重新构建 Android 应用程序，以便包含原生类。

Android 7到10没有逐帧进度。在那里，Jolt 从每个布局上窗口的可见框架中读取键盘。当键盘布局移动视图时，Jolt 将其放回原来的位置，并以键盘通常的时间将其动画到键盘上方的位置：大约 150 毫秒，在显示时减速，在隐藏时加速，这是在 Android 9 模拟器上测量的。其中包括 `adjustResize`（其中布局已提升视图）以及 `adjustPan` 和 `adjustNothing`（其中视图通过其重叠进行平移）。该动画是常规的原生 Jolt 动画，每次更改启动一次。

<Clip name="keyboard-android-9" caption="在 Android 9 模拟器上，作曲家从布局将其移动到键盘上方的位置升起，并在隐藏时返回，而 onKeyboard() 报告 297 DIPs 和测量的 150 毫秒。实时播放。" />

## 键盘状态 {#keyboard-state}

屏幕通常需要以其他方式做出反应：压缩标题、移动插图、在滚动视图末尾添加空间。 `onKeyboard()` 报告键盘覆盖了多少窗口以及它如何到达那里：

```ts
import { animate, onKeyboard } from '@rafaelaugusto/jolt'

const off = onKeyboard(({ visible, height, duration, transition }) => {
  animate(header, { scale: visible ? 0.8 : 1 }, transition)
})
```

<Clip name="keyboard-state-android" caption="在 Android 模拟器上，onKeyboard() 报告 336 DIPs 和键盘的 285 毫秒，并且徽章沿着键盘自己的曲线收缩，而作曲家则跟随它。实时播放。" />

| 字段         | 含义                                                                |
| ------------ | ------------------------------------------------------------------- |
| `visible`    | 对接键盘覆盖了部分窗口                                              |
| `height`     | DIPs 窗口被覆盖，从其底部边缘开始；隐藏或浮动时为零                 |
| `duration`   | 键盘到达那里所需的毫秒数；当它立即改变时为零                        |
| `transition` | 键盘自己的时序，为 `animate()` 做好准备，因此其他视图会随之同步移动 |

当覆盖高度发生变化时运行回调：显示、隐藏、切换到更高的键盘。浮动或未对接的 iPad 键盘不会覆盖任何内容并报告 `visible: false`。所有侦听器共享一个观察者，在上次清理时将其删除。

在 iOS 上，键盘在弹簧上移动，Core Animation 在 500 毫秒内进行临界阻尼； `transition` 就是那个弹簧（`stiffness: 1000`、`mass: 3`）。 iOS 仅在发生键盘更改时报告键盘更改，因此在第一个侦听器订阅时已经打开的键盘会在下一次更改时报告。在 Android 11 及更高版本上，窗口上的原生回调读取键盘的持续时间并对其插值器进行采样，因此 `transition` 遵循相同的曲线。从一开始就知道键盘已经打开。在 Android 7 到 10 上，高度来自窗口的可见框架，`duration` 为 150，`transition` 为 150 毫秒 `quadOut`（键盘显示）和 `quadIn`（隐藏），在 Android 9 仿真器上测量的时序；高度包括键盘下方的导航栏，与 Android 11 上的一样。

在 Vue 中，[`useKeyboard()`](./vue#keyboard) 提供了一个在组件卸载之前保持最新的引用。

## 清理 {#cleanup}

返回值消除效果：

```ts
const release = followKeyboard(composer)
release() // stops following and clears the translation it applied
```

卸载视图也会释放它，因此消失的屏幕不会保留观察者。重新使用卸载的视图时再次附加。调用清理两次是无害的。
