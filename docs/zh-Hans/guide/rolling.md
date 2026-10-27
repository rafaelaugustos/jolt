# 滚动数字 {#rolling-numbers}

更改数字并使不同的数字滚动到位：

<div class="clips">
<Clip name="rolling-ios" caption="iOS 上滚动的数字。" />
<Clip name="rolling-android" caption="Android 上滚动的数字。" />
</div>

```ts
import { rollTo } from '@rafaelaugusto/jolt'

await rollTo(balance, 1249.9, { format: (value) => value.toFixed(2) })
await rollTo(timer, '00:42')
```

目标必须是 NativeScript `Label`，或持有一个的模板引用/`ElementRef`。标签立即接收其最终文本，因此布局、绑定和可访问性保留第一帧的新值。只有绘图会移动：在每个改变的位置，旧的字形滑出，而新的字形在 Jolt 弹簧上滑入其后面，夹在标签上。保持不变的数字不会移动。

号码先经过 `format`，默认为 `String`。字符串按原样显示。

## 选项 {#options}

| 选项        | 默认     | 含义                                                 |
| ----------- | -------- | ---------------------------------------------------- |
| `format`    | `String` | 将数字转换为文本来显示。                             |
| `duration`  | `600`    | 弹簧感觉有多长，以毫秒为单位。                       |
| `bounce`    | `0.2`    | 弹簧弹跳，从 -1 到 1，如 [弹簧](./transitions)。     |
| `stagger`   | `0`      | 更改位置之间的毫秒数，从最右边的位置开始。           |
| `delay`     | `0`      | 第一个位置移动之前的毫秒数。                         |
| `direction` | `'auto'` | `'auto'`、`'up'` 或 `'down'`。                       |
| `tabular`   | `true`   | 原生标签上的表格数字，因此每个数字都具有相同的宽度。 |

对于 `'auto'`，较高的数字向上滚动，较低的数字向下滚动。比较使用该标签上之前的 `rollTo()` 中的数字，或者在解析为数字时使用之前的文本；弦卷起来。向上卷意味着旧的字形从顶部离开，而新的字形从下面进入。

## 职位如何匹配 {#how-positions-match}

两个文本都被分成字素，因此带重音的字母或连接的表情符号算作一个位置，并在最后一个字符上对齐。当数字增加时，个位数保持不变：通过将两个 9 滚入零并在左侧滚入 `1`，`99` 变为 `100`；通过单独滚出 `1`，`100` 变为 `99`。不改变的分隔符和后缀保持不变。

交错从右开始计算变化的位置：个位数字首先移动，然后是其左侧的每个位置，最后是没有任何进来的滚出的数字。

## 平台 {#platforms}

在 iOS 上，TextKit 在标签的当前边界中布置旧文本和新文本，而 Jolt 将它们的字形分成临时图像层，就像 [文字入口](./text) 所做的那样。 Core Animation 播放弹簧和淡入淡出，每帧没有 JavaScript，而标签自己的文本绘制为透明。文本指南的限制适用：截断的标签、嵌入的附件和自动字体缩小显示最终文本并使用 `false` 进行解析。

在 Android 上，每个更改位置的跨度都会绘制旧的和新的字形，并且一名本地动画师按照系统动画师的持续时间比例移动它们。 `TextView` 始终保留真实文本。升级后重新构建 Android 应用程序，以便包含原生类；如果没有它，标签将显示最终文本，并且调用将解析为 `false`。

当 `tabular` 打开时，Jolt 会询问表格数字的原生标签：iOS 上的数字间距字体功能和 Android 上的 `tnum` 设置。当 `1` 变为 `8` 时，比例字体将停止移动该行的其余部分。 NativeScript 可以在下次样式更改时再次设置字体；下一卷再次应用该功能。

卷在其开始时使用标签边界。当数字计数发生变化时，标签自身的宽度会在下一个布局过程中发生变化，从而移动居中且右对齐的文本。带有表格数字或固定宽度的左对齐标签可以提供最干净的结果。

## StackLayout 内的自动高度 {#auto-height-inside-a-stacklayout}

当该行适合其文本时，在周围的 `GridLayout` 上声明 `rows="auto"`。没有行定义的网格可以将其隐式行拉伸到可用高度，水平 `StackLayout` 可以将该高度传递给其标签。 `rollTo()` 不添加布局子项：其原生绘图覆盖不能确定标签的测量高度。

```vue
<StackLayout>
  <GridLayout rows="auto" columns="auto,auto,*,auto">
    <StackLayout orientation="horizontal">
      <Label ref="range" text="312" fontSize="40" minWidth="180" />
    </StackLayout>
    <Label col="1" text="mi" verticalAlignment="middle" />
    <Label col="3" text="78%" verticalAlignment="middle" />
  </GridLayout>
</StackLayout>
```

这里的宽度为改变位数保留了空间；高度保持自动。配对演示比较了 40 和 64 DIP 字体大小的动画标签和普通标签，包括增大/缩小的数字和取消。 iOS 检查还验证播放期间是否存在滚动覆盖并在播放后删除。

[模型调查](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/model-motion-values.md) 复制了一个 554 pt 标签 **之前**，称为 `rollTo()`。添加 `rows="auto"` 将其在调用前后减少到 48.7 pt，具有相同的 Inter Display 字体，并且没有固定高度。当旧的或新的字形被截断时，狭窄的标签可能仍会回退到最终文本；需要滚动效果时预留足够的宽度。

<Clip name="rolling-layout-ios" caption="在 iOS 模拟器上，动画和纯文本通过数字更改和取消保留匹配的自动高度。宽度预留；没有固定的高度。实时播放。" />

<Clip name="rolling-layout-android" caption="在 Android 模拟器上，动画和纯文本通过数字更改和取消保留匹配的自动高度。宽度预留；没有固定的高度。实时播放。" />

## 停止和改变 {#stopping-and-changes}

```ts
const roll = rollTo(balance, 2000, { format })
roll.stop()

await sequence([() => rollTo(score, 10), () => animate(badge, 'popIn')])
```

返回一个`Animation`：`await`，读取`finished`，或者调用`stop()`。原生完成解析为 `true`。停止会将最终文本保留在原处并以 `false` 解析。当文本没有更改时，调用会立即解析为 `true`。在同一标签上启动另一个 `rollTo()` 会取消前一个标签，并从它所选择的文本中滚动。

卸载、不同的原生视图以及应用程序对文本或样式所做的更改取消滚动并保留应用程序设置的内容。 `formattedText` 被滚动的纯文本替换。 iOS 上的“减少运动”和 Android 上的禁用动画师会立即显示最终文本并使用 `true` 进行解析。超过 256 个更改位置显示最终文本并以 `false` 解析。
