# 流光效果 {#shimmer}

将光带扫过加载占位符：

<Clip name="shimmer" caption="加载占位符时闪烁。" />

```ts
import { shimmer } from '@rafaelaugusto/jolt'

const stopShimmer = shimmer(placeholder)
// Once the content is ready:
stopShimmer()
```

传递视图或持有视图的裁判。将其应用到容器上以扫过其所有骨架形状。蒙版会改变它们的不透明度，因此它们的颜色和背景决定了对比度；深色背景上的浅色形状营造出明亮的氛围。

## 时序 {#timing}

```ts
const stopShimmer = shimmer(placeholder, { duration: 2000 })
```

`duration` 是每次扫描的毫秒数，包括进入和离开视图的波段。默认值为 `1500`。它必须是一个正有限数。

在iOS上，`CAGradientLayer`蒙版在Core Animation中为其`locations`设置动画。本地重复播放，每帧没有 JavaScript 回调。布局更改会调整蒙版的大小，而无需重新启动扫描。

## 清理 {#cleanup}

返回的函数删除微光及其侦听器。再次调用它是无害的。在同一视图上启动另一个闪烁会取代前一个闪烁；它旧的清理功能无法阻止新的效果。

加载之前进行的调用等待视图和非零布局。卸载视图会删除原生掩码和可访问性观察者；再次加载它会开始新的扫描。这还可以处理后台运行和返回应用程序。调用返回的函数以永久结束闪烁，包括在卸载视图时。

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'nativescript-vue'
import { shimmer } from '@rafaelaugusto/jolt'

const placeholder = ref()
let stop: (() => void) | undefined

onMounted(() => {
  stop = shimmer(placeholder.value)
})
onUnmounted(() => stop?.())
</script>

<template>
  <StackLayout ref="placeholder" />
</template>
```

现有遮罩，包括 NativeScript 剪辑路径，保持在原位。清理仅删除 Jolt 的渐变。 Shimmer 不会更改视图的不透明度、变换、交互或可访问性属性。使用`stopShimmer()`来停止它； `stop(view)` 控制 `animate()` 轨道。

## 兼容性 {#compatibility}

第一个实现是 **仅 iOS**。在 Android 上，占位符保持不变，清理功能不执行任何操作。

启用“减少运动”后，占位符将以其正常的不透明度保持静态。在微光处于活动状态时更改该首选项会自动删除或恢复扫描。
