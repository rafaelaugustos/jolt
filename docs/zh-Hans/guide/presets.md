# 预设 {#presets}

```ts
animate(card, 'popIn')
animate(card, 'shake', { delay: 200 })
animate(spinner, 'spin', { repeat: Infinity })
```

<Clip name="presets" caption="fadeInUp、popIn 并从操场上摇晃。" />

|      |                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 输入 | `fadeIn`, `fadeInUp`, `fadeInDown`, `fadeInLeft`, `fadeInRight`, `zoomIn`, `popIn`, `flipInX`, `flipInY` |
| 退出 | `fadeOut`, `fadeOutUp`, `fadeOutDown`, `fadeOutLeft`, `fadeOutRight`, `zoomOut`, `popOut`                |
| 注意 | `pulse`, `bounce`, `shake`, `wiggle`, `heartbeat`, `jelly`, `flash`, `tada`, `spin`                      |

方向遵循 animate.css：`fadeInUp` 从下向上，`fadeOutUp` 向上离开。每个内置预设都是普通关键帧和过渡，在 [`src/presets.ts`](https://github.com/rafaelaugustos/jolt/blob/main/src/presets.ts) 中列出并导出为 `presets`。

注意预设使用[相对关键帧](./animating#relative-keyframes)。 `x: 40` 处的一张卡在 40 左右摇动并返回该位置。 `pulse`、`heartbeat`、`jelly`、`tada` 保存各轴当前刻度； `flash` 返回原始不透明度。 `spin` 为当前旋转添加一整圈。

传递`{ relative: false }`以使用原始绝对关键帧。进入和退出预设保持绝对。

## 更改预设的时序或曲线 {#changing-a-preset-s-timing-or-curve}

仅具有定时的选项（`delay`、`repeat`、`stagger`）保留预设的曲线。带曲线的选项（`duration`、`ease`、弹簧）替代它们：

```ts
animate(card, 'fadeInUp', { delay: 100 }) // the preset's spring, 100ms later
animate(card, 'fadeInUp', { duration: 600 }) // a 600ms tween instead
animate(card, 'fadeInUp', 'bouncy') // a bouncy spring instead
```

## 自定义预设 {#custom-presets}

以 `definePreset` 的名称注册关键帧和过渡：

```ts
import { animate, definePreset, sequence } from '@rafaelaugusto/jolt'

declare module '@rafaelaugusto/jolt' {
  interface Presets {
    cardIn: true
  }
}

definePreset('cardIn', {
  keyframes: { opacity: [0, 1], y: [40, 0] },
  transition: { type: 'spring', bounce: 0.2, opacity: { duration: 150 } },
})

animate(card, 'cardIn')
animate(cards, 'cardIn', { stagger: 40 })
sequence([
  [logo, 'popIn'],
  [card, 'cardIn'],
])
```

在任何动画使用该名称之前，将注册放入应用程序启动期间导入的模块中。 `Presets` 声明将 `PresetName` 扩展为 TypeScript；它在运行时不会注册任何内容。使用未注册的名称会引发错误。

该定义具有导出的 `Preset` 类型。其 `transition` 采用与 `animate()` 相同的选项，包括每个属性转换和 `stagger`。传递给 `animate()` 的选项使用上述规则覆盖这些默认值。

再次注册自定义名称将替换其定义以供将来的动画使用；运行动画会保留其现有轨迹。内置名称无法通过 `definePreset` 进行替换。导出的 `presets` 对象继续仅包含内置对象。
