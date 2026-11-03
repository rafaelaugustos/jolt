# 原生框架适配器

已为下一版本实现；RC.10 尚不包含这些入口。只导入 NativeScript 应用使用的适配器。各适配器共享 Jolt 的播放和资源管理。

每个绑定管理自己的动画和监听器。原生 unload 暂停工作；load 恢复并应用最后一个待处理值。框架销毁时释放资源。新值从当前状态中断；等价的内联值不会重启动画。按压反馈使用独立图层，可与入场或位置动画共存。

## React NativeScript

此集成使用 React NativeScript 和 NativeScript 视图。hook 在 commit 后解析 ref，跟踪 ref 替换并在卸载时清理。返回的函数可以明确重播相同值。原生示例固定 React NativeScript 4.0.1 / React 16.14，hook 测试还覆盖 React 18。本次检查的 5.0.0 包缺少声明的运行时文件。

```tsx
import { useRef } from 'react'
import { useAnimate, usePress } from '@rafaelaugusto/jolt/react'

function Card({ x }) {
  const ref = useRef(null)
  const play = useAnimate(ref, { x })
  usePress(ref, { scale: 0.94 })
  return <label ref={ref} text="Card" onTap={() => play('popIn')} />
}
```

<Clip name="framework-react-ios" caption="在 iOS 26.2 的 iPhone 17 模拟器上，用 XCTest 真实触摸操作验证原生播放：中断、按压、卸载/重建和目标替换。界面为英语。模拟器证据不能证明实体设备性能。" />

## Svelte Native

Svelte Native action 接收 nativeView 包装器。请配置 Svelte namespace: "foreign"，保留 NativeScript 属性大小写。完整示例固定 Svelte Native 1.0.29 / Svelte 4.2.20。

```svelte
<script>
  import { animate, press } from '@rafaelaugusto/jolt/svelte'
  let x = 0
</script>
<label use:animate={{ x }} use:press={{ scale: 0.94 }} text="Card" />
<button text="Move" on:tap={() => x = x ? 0 : 80} />
```

<Clip name="framework-svelte-ios" caption="在 iOS 26.2 的 iPhone 17 模拟器上，用 XCTest 真实触摸操作验证原生播放：中断、按压、卸载/重建和目标替换。界面为英语。模拟器证据不能证明实体设备性能。" />

## Solid / DOMiNATIVE

Solid 指令接收 DOMiNATIVE 视图。使用 Solid 客户端运行时和 @dominative/solid 提供的 universal JSX 转换；服务器导出不执行响应式副作用。示例固定 Solid 1.9.18 和实验性 @dominative/solid 0.0.4-alpha.1，并使用真实 JSX 指令。这不是 DOM 适配器。

```jsx
import { createSignal } from 'solid-js'
import { animate, press } from '@rafaelaugusto/jolt/solid'

function Card() {
  const [x, setX] = createSignal(0)
  return (
    <label
      use:animate={{ x: x() }}
      use:press={{ scale: 0.94 }}
      text="Card"
      on:tap={() => setX(x() ? 0 : 80)}
    />
  )
}
```

<Clip name="framework-solid-ios" caption="在 iOS 26.2 的 iPhone 17 模拟器上，用 XCTest 真实触摸操作验证原生播放：中断、按压、卸载/重建和目标替换。界面为英语。模拟器证据不能证明实体设备性能。" />

固定版本的 DOMiNATIVE renderer 缺少 JSX `use` helper。完整示例提供下面的转发模块，通过 `babel-preset-solid` 的 `moduleName` 引用，并在 NativeScript renderer hook 之后配置（`chainWebpack` order 100）。保留 `@dominative/solid` 的原有导出；此兼容层只调用指令，避免父级副作用跟踪指令内部读取。

```js
export * from '@dominative/solid'
import { untrack } from 'solid-js'
export const use = (directive, element, accessor) =>
  untrack(() => directive(element, accessor))
```

## Angular

在组件中导入三个 standalone 指令。验证组合为 Angular 22.2.4 / NativeScript Angular 22.0.2。库使用 Angular 部分编译。joltIf 保留单个原生根视图直到退场结束；条件再次为 true 时取消移除并从当前状态入场。多个兄弟根节点应包在布局中。需要退场动画时使用 joltIf；普通 ngIf 会提前移除视图。

```ts
import {
  JoltAnimateDirective,
  JoltPressDirective,
  JoltIfDirective,
} from '@rafaelaugusto/jolt/angular'
// @Component({ imports: [NativeScriptCommonModule,
//   JoltAnimateDirective, JoltPressDirective, JoltIfDirective], ... })
```

```html
<GridLayout *joltIf="visible(); enter: 'fadeIn'; leave: ['fadeOut', { duration: 400 }]">
  <label
    [joltAnimate]="{ x: position() }"
    [joltPress]="{ scale: 0.94 }"
    text="Card"
  ></label>
</GridLayout>
```

<Clip name="framework-angular-ios" caption="在 iOS 26.2 的 iPhone 17 模拟器上，用 XCTest 真实触摸操作验证原生播放：中断、按压、卸载/重建和目标替换。界面为英语。模拟器证据不能证明实体设备性能。" />

## 复现与限制

[Native fixtures and acceptance](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/frameworks) · [Protocol](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/frameworks.md).
