# 按压 {#press}

```ts
const remove = press(button) // scales to 0.96 while pressed
press(card, { scale: 0.97, opacity: 0.8 })
press(tile, { scale: 0.9, rotate: -4 }, 'bouncy')
```

<Clip name="press" caption="Android 上的三种按压效果。" />

当手指按下时动画到给定值，并在手指抬起或通过滚动取消触摸后返回到视图所在的位置。 `isEnabled` 设置为 `false` 的视图​​不会做出反应。它返回一个消除效果的函数。

## 独立层中的按压 {#layered-press}

**尚未发布的修复：** 为按压效果保留独立的层名，使其能与入场或其他运动同时运行。平移和旋转贡献返回 `0`，缩放和透明度贡献返回 `1`。释放或取消触摸后会恢复当前基础状态，包括非零平移和非单位缩放。移除效果也会清除已经稳定的按压贡献。

```ts
set(card, { x: 24, scale: 1.5 })
const remove = press(card, { x: 8, scale: 0.88 }, { layer: 'press' })
animate(card, { x: 80 }, 'snappy')
// 结束时：remove()
```

该层名应仅用于此按压效果，其他层保持独立。未指定 `layer` 时，press 仍按原有方式动画基础属性，并返回捕获的静止值。

<Clip name="motion-rfc-ios" caption="iOS 26.2 模拟器，英文 Layers 演示，启用可选 RFC 审计：真实持续触摸、入场期间移除 shake、释放后保留基础状态、两个无限层及组合窗口切换。原速原生播放，不代表真机性能测量。" />
<Clip name="motion-rfc-android" caption="Android 16 / API 36 模拟器，英文 Layers 演示，启用可选 RFC 审计：通过真实 ADB 点击和持续触摸验证按压、独立层与窗口切换。原速播放，属于模拟器正确性证据。" />
