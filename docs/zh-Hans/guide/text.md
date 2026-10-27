# 文字 {#text}

逐个字母地显示标题，或一次显示一个单词：

<div class="clips">
<Clip name="text-ios" caption="iOS 上的字母和单词入口。" />
<Clip name="text-android" caption="Android 上的相同入口。" />
</div>

```ts
import { animateText } from '@rafaelaugusto/jolt'

await animateText(title)
await animateText(title, { by: 'word', stagger: 100 })
```

目标必须是 NativeScript `Label`，或持有一个的模板引用/`ElementRef`。空格、换行符、对齐方式和格式化样式保持不变。组合字符（例如重音字母和连接的表情符号）保持在一起。

每个片段都会淡入并移动到其原始基线。原始标签保留其布局和可访问性元素，并在整个过程中提供完整的可访问文本，并且每帧 JavaScript 中没有任何内容运行。

- **iOS:** TextKit 在 Jolt 将其形状字形分成临时图像层（Core Animation 播放）之前布局完整的文本。共享连字的字母一起动画。临时层不添加辅助功能元素。
- **Android:** 跨度仅影响绘图淡入淡出，并在一位本地动画师的指导下提升每幅作品。 TextView 保留其文本、换行符、截断和格式化文本范围；不再测量任何内容。

## 选项 {#options}

| 选项       | 默认       | 含义                                                       |
| ---------- | ---------- | ---------------------------------------------------------- |
| `by`       | `'letter'` | `'letter'` 或 `'word'`；在单词模式下，标点符号跟随其单词。 |
| `duration` | `400`      | 每件毫秒。                                                 |
| `stagger`  | `35`       | 片段之间的毫秒数，按文本顺序。                             |
| `delay`    | `0`        | 第一段之前的毫秒数。                                       |
| `y`        | `12`       | DIPs 中的初始垂直偏移；负值从上方输入。                    |

总播放次数为 `delay + duration + (pieces - 1) * stagger`。空格不会添加字母模式步骤。零持续时间立即显示全文，包括何时请求延迟。

## 停止和改变 {#stopping-and-changes}

```ts
const entrance = animateText(title, { by: 'word', y: 18 })
entrance.stop()

await sequence([() => animateText(title), () => animate(button, 'fadeIn')])
```

返回一个`Animation`：`await`，读取`finished`，或者调用`stop()`。原生完成解析为 `true`。停止会恢复全文并以 `false` 解析。在同一标签上启动另一个 `animateText()` 会取消先前的入口并重新开始。

卸载、不同的原生视图或更改文本/样式取消播放并恢复全文；在 iOS 上，调整边界大小也是如此。应用程序对文本和辅助功能标签的更改将被保留。在 iOS 上减少运动并在 Android 上删除动画（禁用动画师）跳过入口；在播放期间启用“减少运动”会立即恢复全文并解析为 `true`。

## 范围 {#scope}

此效果适用于标题和短段落。超过 256 件标签保留其原始文本并解析为 `false`。空文本立即完成。

在 iOS 上，截断的标签、嵌入附件和使用自动字体缩小的标签将保留其原始文本并使用 `false` 进行解析。当快照超过 400 万像素（约 16 MB RGBA 数据）时，同样适用。影响布局的动态类型更改取消入口；然后，普通标签将使用更新后的布局。

在Android上，升级后重建应用程序，以便包含原生类；如果没有它，调用将解析为 `false` 并保留文本。截断的文本按照绘制的方式播放，并且在播放入口时，片段边界两侧的字母会失去连字。
