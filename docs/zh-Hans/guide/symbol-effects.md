# SF Symbols 效果 {#sf-symbol-effects}

`symbolEffect()` 在 `Image` 上播放 Apple 的原生符号效果。使用 SF Symbol 源，例如 `sys://bell.fill`。

<Clip name="symbols" caption="在 SF Symbols 上弹跳、脉冲并替换。" />

```ts
import { symbolEffect } from '@rafaelaugusto/jolt'

symbolEffect(bell, 'bounce')
symbolEffect(heart, 'pulse')
symbolEffect(wifi, 'variableColor')
symbolEffect(favorite, { replace: 'sys://heart.fill' })
```

目标是一个 NativeScript `Image`，或持有一个的裁判。播放运行于 UIKit， 没有 JavaScript 每帧工作。此 API 与中的变换预设是分开的 `animate()`.

## 效果和选项 {#effects-and-options}

| 效果                        | 行为                                                             |
| --------------------------- | ---------------------------------------------------------------- |
| `bounce`                    | 反弹符号一次。                                                   |
| `pulse`                     | 脉冲一次其不透明度。                                             |
| `variableColor`             | 对元件的图层进行动画处理，例如 `wifi` 中的条形。外观取决于符号。 |
| `scale`                     | 缩放符号并保持直至停止。                                         |
| `{ replace: 'sys://name' }` | 转换到另一个符号并更新图像的 `src` 和 `imageSource`。            |

`speed` 是 Apple 计时的正乘数，而不是以毫秒为单位的持续时间。弹跳、脉冲和可变颜色接受 `repeat: true` 继续播放。缩放和更换不重复。

```ts
const loading = symbolEffect(wifi, 'variableColor', { repeat: true, speed: 0.8 })
loading.stop()

const selected = symbolEffect(star, 'scale')
selected.stop() // removes the held scale
```

## 完成和清理 {#completion-and-cleanup}

结果有 `finished`、`stop()` 和 `then()`，就像其他 Jolt 动画一样：

```ts
const completed = await symbolEffect(bell, 'bounce')

await sequence([
  () => symbolEffect(favorite, { replace: 'sys://heart.fill' }),
  () => animate(card, 'popIn'),
])
```

当 UIKit 报告完成时，有限效应会通过 `true` 解决。停止、取代或跳过的效果通过 `false` 解决。缩放和重复效果保持待定状态，直至停止。停止替换会保留目标图标。

同一图像上的新 `symbolEffect()` 取消了前一个。卸载视图或更改其源也会将其取消。在视图或其图像加载之前进行的调用会等待它。使用返回的句柄来停止符号效果； `stop(view)`控制`animate()`所发挥的属性。

替换同步加载新符号，保留 `loadMode`、色调和符号配置。如果 `src` 绑定到应用程序状态，也请保持该状态同步，以便以后的渲染不会恢复之前的图标。避免在 Jolt 拥有效果时使用 `iosSymbolEffect` 控制同一图像。

## 兼容性 {#compatibility}

效果需要 **iOS 17+**。在早期的 iOS 版本中，装饰效果会被跳过，替换会立即更新图标。不可用的符号会使当前图标保持不变，并解析为 `false`。

播放开始时启用“减少运动”，装饰效果将被跳过并立即替换。在 Android 上，每个调用都是 `false` 的无操作解析，包括替换。位图无法起到符号效果；将其替换为符号是立即的。

有关 Apple 的效果定义，请参阅 [符号框架](https://developer.apple.com/documentation/symbols?language=objc)。
