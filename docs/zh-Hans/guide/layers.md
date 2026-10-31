# 分层动画 {#layered-motion}

属性通常一次只有一个动画：一个新的动画将接管它。而是在其旁边播放一个图层。拖拽之上会出现摇晃，卡片移动时会出现呼吸脉冲，按下按钮会缩放仍在输入的卡片：

```ts
animate(card, { x: 120 }, 'snappy') // the base
animate(card, 'shake', { layer: 'feedback' }) // on top of it
```

<Clip name="layers-ios" caption="在 iOS 模拟器上，当卡片移动和晃动时，呼吸层会持续存在，然后卡片被拖动。实时播放。" />

## 图层如何组合 {#how-layers-combine}

层由 `layer` 选项命名。它的关键帧就是它添加的内容：到基础层和其他层的平移和旋转 **添加**、缩放和不透明度 **乘以**。无论卡片位于何处，震动都是 `x: [0, -10, 10, 0]`，而无论其规模如何，脉冲都是 `scale: [1, 1.08, 1]`。相关预设（例如 `shake`、`pulse` 和 `heartbeat`）作为图层工作不变。

```ts
animate(card, { y: -8 }, { duration: 200, layer: 'hover' }) // stays lifted
animate(
  card,
  { scale: [1, 1.08] },
  {
    duration: 700,
    repeat: Infinity,
    repeatType: 'reverse',
    layer: 'breathe',
  },
)
```

图层适用于 `x`、`y`、`scale`、`scaleX`、`scaleY`、`rotate`、`rotateX`、`rotateY` 和 `opacity`。颜色、角落、边框、阴影和路径保持单一所有者。图层采用 `animate()` 执行的每个转换并返回相同的动画，包括 `pause()`、`play()` 和 `progress`。它也适用于序列、范围和运动状态。

## 更换和停止 {#replacing-and-stopping}

每一层的工作方式就像它自己的属性一样。同一层上的新动画将取代它，从该层当时添加的内容及其速度开始。没有图层的新动画将替换基础动画并让图层保持运行。使用 [减少运动](./configure#reduced-motion)，变换层跳到末尾，并且不透明层仍然播放。

```ts
stop(card, ['x'], { layer: 'feedback' }) // that layer stops, and what it adds goes away
stop(card, undefined, { layer: 'hover' }) // also after it finished
stop(card) // everything stops; what is on screen becomes the new value
```

要缓和图层，请将其动画化为空：`animate(card, { scale: 1 }, { duration: 250, layer: 'breathe' })`。

拖动会保持其图层：拖动时，同一视图上会发生震动或脉冲。

<Clip name="layers-android" caption="在Android模拟器上，卡片在拖动时会晃动，呼吸层会打开和关闭。实时播放。" />

## 玩法如何 {#how-it-plays}

虽然属性具有图层，但 Jolt 将其基础和图层作为一个复合原生轨道播放。当发生变化时，它会对合成进行采样：动画开始、结束、暂停、搜索或停止，或者拖动移动底座。在这些时刻之间，JavaScript 中没有任何运行。无尽的层在其周期的最小公倍数（最多 30 秒）内成为原生循环；除此之外，原生合成器会让各图层按各自的时钟播放，无需任何重建。未包含 Jolt 原生类的应用则回退为每隔几秒重新采样合成。当最后一层消失并且没有添加任何内容时，该属性将返回到纯动画。

## 动画值 {#motion-values}

[`animate(value, target, { layer })`](./motion-values#layers-on-a-value) 在所有派生映射之前添加标量贡献。值图层使用零作为中性，包括映射到比例或不透明度时。请参阅有关停止、拖动和原生合成的动画值指南。

**0.1.0-rc.2 中的修复：** [独立层中的 press](./press#layered-press) 仅将自身贡献恢复为中性值。视图层播放还会补偿创建原生关键帧所耗费的时间，使新组合与源时钟保持同步。

<Clip name="motion-rfc-ios" caption="iOS 26.0 模拟器，英文 Layers 演示，启用可选 RFC 审计：真实持续触摸、入场期间移除 shake、释放后保留基础状态，以及两个没有公共周期的无限层在原生合成器中跨过原四秒窗口边界持续播放。原速原生播放，不代表真机性能测量。" />
<Clip name="motion-rfc-android" caption="Android 16 / API 36 模拟器，英文 Layers 演示，启用可选 RFC 审计：通过真实 ADB 点击和持续触摸验证按压、独立层与窗口切换。原速播放，属于模拟器正确性证据。" />
