# 加载指示器 {#loaders}

将加载指示器添加到空视图：

<Clip name="loaders" caption="点、条和环。" />

```ts
import { loader } from '@rafaelaugusto/jolt'

const stopLoading = loader(slot, {
  style: 'dots',
  color: '#71717a',
  size: 48,
  duration: 1200,
})

stopLoading() // when the content is ready
```

指示器保持在目标中心。它使用带有一个动画源层的 `CAReplicatorLayer`：三个脉冲点、五个均衡器条或环周围的十二个淡入淡出点。 Core Animation 播放循环，无需每帧 JavaScript 回调或附加 NativeScript 视图。

## 选项 {#options}

| 选项       | 默认        | 含义                                            |
| ---------- | ----------- | ----------------------------------------------- |
| `style`    | `'dots'`    | `'dots'`、`'bars'` 或 `'ring'`。                |
| `color`    | `'#71717a'` | NativeScript 颜色字符串。                       |
| `size`     | `48`        | DIPs 中的最大宽度和高度。缩小以适应目标的边界。 |
| `duration` | `1200`      | 每个周期毫秒。                                  |

大小和持续时间必须是正有限数。在替换现有加载程序之前抛出无效选项。指示器跟随布局更改而无需重新启动其动画。

目标需要非零的宽度和高度；加载器没有给它一个内在的大小。它添加了一个层，而无需更改现有内容、掩码、转换或命中测试。空的 `GridLayout` 可以作为一个合适的插槽。现有的剪裁仍然适用。

```vue
<GridLayout ref="slot" width="80" height="64" accessibilityLabel="Loading results" />
```

在应用程序中设置可访问标签或提供附近的加载状态。装饰层不会创建辅助功能元素，并且 Jolt 使目标的辅助功能设置保持不变。

## 清理和生命周期 {#cleanup-and-lifecycle}

`loader()` 接受一个视图或持有一个的引用并返回一个幂等清理函数。在同一目标上启动另一个加载程序会替换前一个加载程序。较旧的清理功能无法删除其替代功能。使用返回的函数来停止加载程序； `stop(view)` 控制 `animate()` 轨道。

加载之前进行的调用等待窗口和非零布局。卸载（包括应用程序进入后台时）会删除原生图层和“减少运动”观察器。加载会重新创建指标。零大小的目标会暂时将其删除，直到返回可用的布局。

显式清理也会删除侦听器并防止任何重新启动。保留该函数并在拥有的组件被释放时调用它。

## Reduce Motion and platforms {#reduce-motion-and-platforms}

启用“减少运动”后，点、条或环仍然可见，但没有动画。加载器在加载时响应首选项更改，如果设置被禁用，则恢复运动。

这个实现是**仅 iOS**。 Android 返回一个无操作清理函数并且不绘制指标。
