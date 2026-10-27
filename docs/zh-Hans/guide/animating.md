# 创建动画 {#animating}

`animate(target, keyframes, transition?)` 拍摄视图以及拍摄位置：

<Clip name="loops" caption="旋转器和心跳重复。" />

```ts
animate(card, { opacity: 0.5, y: -20 })
```

## 属性 {#properties}

| 属性                 | 单位                                   |
| -------------------- | -------------------------------------- |
| `opacity`            |                                        |
| `x`, `y`             | DIPs，与`translateX`、`translateY`相同 |
| `scale`              | 将 `scaleX` 和 `scaleY` 设置在一起     |
| `scaleX`, `scaleY`   |                                        |
| `rotate`             | 度                                     |
| `rotateX`, `rotateY` | 度，带透视                             |

还支持背景、边框和文本颜色。参见 [颜色](./colors)。有关数字装饰属性，请参阅 [角、边框和阴影](./decorations)。使用 [`animateSize()`](./size) 进行文本重排的实际宽度/高度/自动转换，或使用 [`animateLayout()`](./layout) 进行 FLIP 布局转换。

使用 [`path` 和 `orient`](./paths) 通过原生平移和可选的切线旋转来遵循 SVG 曲线。

## Android 淡出 {#android-fades}

对于不透明动画，当硬件加速处于活动状态时，Jolt 会在硬件层中临时缓存具有子级的容器。它在任何延迟结束时启动，保持缓存不重复，并在完成、停止、替换或卸载时恢复原始层。这可以减少静态内容（例如带有图像的卡片）的绘制工作。

应用程序配置的硬件或软件层保持不变。空容器、没有测量边界的视图以及比显示更宽或更高的容器将被跳过。大小限制避免缓存整个过大的内容树。带有 `setClipChildren(false)` 的容器也会被跳过：图层是视图的大小，因此在其外部绘制的子元素将在淡入淡出期间被切断。硬件纹理使用显存；不断变化的内容仍然会使其缓存失效。请参阅 [Android 淡入淡出基准](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/android-fade.md)。

Android 还会将半透明视图绘制到其自身大小的缓冲区中，即使容器没有裁剪它们，也会切断在其外部绘制的子视图。没有任何设置会使缓冲区变大：当视图消失时，Android 的渲染器会将其变成与视图一样大的图层。对于具有 `setClipChildren(false)` 的容器，Jolt 在 Android 7 及更高版本上使用 `forceHasOverlappingRendering(false)` 关闭缓冲区，因此溢出的辉光或阴影在消失时保持其形状。然后，子视图们一一消失：其中两个重叠的地方，下面的子视图就显露出来了。

要使重叠并在其容器外部绘制为一幅图像的内容淡出，请淡出包含所有内容的容器。使褪色视图与辉光一样大，内容居中于内部，这样就不会溢出它：

```xml
<!-- The glow fits inside the view that fades, so the dot never shows it through. -->
<GridLayout ref="badge" width="168" height="168">
  <Label class="glow" width="168" height="168" borderRadius="84" />
  <Label class="dot" width="64" height="64" borderRadius="32" />
</GridLayout>
```

对 `badge` 进行动画处理，然后使发光和点一起消失，在 Android 和 iOS 上都是如此。

<Clip name="fade-overflow-android" caption="在 Android 模拟器上，当容器淡出并返回时，比其容器大的光环保持其形状。" />

## 通过旋转研究 iOS 不透明度 {#investigating-ios-opacity-with-rotation}

[问题＃134](https://github.com/rafaelaugustos/jolt/issues/134) 跟踪当一个容器淡入淡出并旋转而其子容器在其边界之外绘制时相邻图像的副本的报告。该演示包括一个 SVG 再现场景，其中包含用于淡出容器或子项的开关、普通视图、慢动作和重复的启动播放。

<Clip name="opacity-rotation-ios" caption="iPhone 17 模拟器、iOS 26.0 上的调查场景，以正常速度：SVG 子项溢出四个淡出和旋转的容器。蓝色的兄弟一动不动。所报告的幽灵副本并未在该录屏中重现；这不是修复或真机验证的证据。" />

请参阅 [复制步骤和证据](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/ios-opacity-rotation.md)。记录的场景并未重现报告；调查的结论是在该范围内无法重现。失败的案例应该重新启动。 Jolt 的 iOS 驱动程序尚未更改以强制光栅化或禁用此报告的组不透明度。

## 3D 透视 {#_3d-perspective}

`rotateX`、`rotateY`、`flipInX` 和 `flipInY` 在两个平台上都使用视图的 `perspective`。 NativeScript 默认为 1000 DIPs；较小的正距离可提供更强的视角：

```ts
card.perspective = 600
animate(card, { rotateY: [-60, 0] })
```

Android 在启动原生动画制作器之前使用显示密度转换此距离。当旋转完成或以某个角度停止时，透视保持在原位。

## 关键帧 {#keyframes}

无论视图在哪里，单个值都会产生动画效果。数组是关键帧的列表，`null` 代表当前值：

```ts
animate(card, { x: [0, 100] }) // from 0, whatever x is now
animate(card, { x: [null, 20, -20, null] }) // out and back to where it was
```

## 相对关键帧 {#relative-keyframes}

设置 `relative: true` 以使用当前值作为基础：

```ts
animate(card, { x: [0, -10, 10, 0] }, { relative: true })
animate(card, { scale: [1, 1.06, 1] }, { relative: true })
animate(card, { y: 20 }, { relative: true }) // move 20 DIPs from its current y
```

平移和旋转值是偏移。比例和不透明度值是因素：`1.06` 的比例使每个轴增长 6%，保留 `scaleX` 和 `scaleY` 之间的任何差异。 `0` 的值表示偏移的起始位置，而 `1` 表示因子的起始值。 `null`始终保持当前值。

Jolt 在创建加载视图的轨迹时、在任何延迟或交错之前捕获一次基础。重复使用已解析的关键帧。如果另一个动画拥有该属性，则基础来自其在屏幕上的当前位置。相对顺序步骤在步骤开始时解析；当播放较早的步骤时，它不会更改或停止目标。

相对关键帧也适用于自定义预设：将 `relative: true` 放入预设的 `transition` 中。调用可以使用 `relative: false` 覆盖它。

## 目标 {#targets}

目标可以是视图，也可以是任何包含视图的东西：NativeScript-Vue 模板引用、Angular `ElementRef`。

```vue
<script setup lang="ts">
const card = ref()
const open = () => animate(card.value, 'popIn')
</script>

<template>
  <GridLayout ref="card" @tap="open" />
</template>
```

尚未加载的视图会立即获取其第一个绝对关键帧，并在屏幕上显示后播放。在 `onMounted` 中调用 `animate(title, 'fadeInUp')` 不会在标题淡入之前闪烁标题。相对动画在加载之前保留视图的值，然后根据这些值解析其关键帧。

## 你得到什么 {#what-you-get-back}

`animate()` 返回一个动画，您可以 `await`。当播放到最后时，它解析为 `true`；当它停止或接管时，它解析为 `false`。它从不拒绝。参见 [中断和停止](./interrupting)。
