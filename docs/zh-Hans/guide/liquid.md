# 液态图像 {#liquid-images}

`liquid()` 为 iOS `Image` 提供缓慢、连续的变形。纹理的某些部分相对于彼此移动，而图像的边界保持固定。

<Clip name="liquid-ios" caption="语音球在 iOS 模拟器中变形、暂停和恢复。该演示还展示了其整体规模和旋转的动画。" />

```ts
import { liquid } from '@rafaelaugusto/jolt'

const flow = liquid(orb, { intensity: 0.9, duration: 7200 })

flow.pause() // freeze the current shape
flow.resume() // continue from that shape
flow.stop() // remove the effect and restore the original image
```

## 选项 {#options}

| 选项        | 默认   | 含义                                       |
| ----------- | ------ | ------------------------------------------ |
| `intensity` | `0.7`  | 变形强度从`0`到`1`。零使图像保持不变。     |
| `duration`  | `8000` | 每个无缝周期毫秒。必须是有限的并且大于零。 |

手柄仅控制此效果。变换和不透明度仍然属于 `animate()`；停止这些动画并不会停止液体效果。当其所有者被处置时，请致电 `flow.stop()`。在同一图像上再次调用 `liquid()` 会替换之前的效果。无效选项不会影响运行效果。

## 渲染和生命周期 {#rendering-and-lifecycle}

Jolt 在 24 × 24 纹理网格上准备周期性位移场。 SpriteKit 通过原生重复动作在每个周期插入 64 个阶段。 GPU 使像素变形；没有 JavaScript 帧回调、计时器、自定义着色器编译或图像资源序列。

原生渲染器位于现有图像视图内。它保留图像的 Alpha、可访问性、蒙版、变换和拉伸模式（`aspectFit`、`aspectFill`、`fill` 或 `none`）。布局更改会调整渲染器的大小，而无需重新启动循环。原始图像源保留在NativeScript模型中。

暂停会冻结当前变形。应用程序不活动也会暂停渲染；除非您明确暂停，否则将恢复活动状态。卸载释放场景、纹理和原生动作；加载重新创建效果。源更改会重建纹理。减少运动或隐藏图像会删除渲染器并显示原始图像；重新打开运动或显示图像重新创建它。

## 支持的内容 {#supported-content}

该助手接受 NativeScript `Image` 目标及其模板引用。它使用一张静态光栅图像。动画图像、模板图像/SF Symbols、缺失图像和超过 16 兆像素的图像保持其原始渲染。 Android 返回惰性句柄，而不访问 iOS API。

该效果使现有艺术品变形。它不会生成新的折叠或模拟流体，也不是用于任意视图的通用着色器 API。该工作在 [#35](https://github.com/rafaelaugustos/jolt/issues/35) 中单独跟踪。

有关暂停/恢复和卸载清理的完整示例，请参阅助手的 [语音画面](https://github.com/rafaelaugustos/jolt/blob/main/demo/src/assistant/Voice.vue)。
