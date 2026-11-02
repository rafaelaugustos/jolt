# Web 挂载、动态列表与横向滚动

**自 0.1.0-rc.8 起可用。** 本次新增功能对应 #334、#336 和 #337。实验性 `/web` 运行时可独立使用或与 Vue 集成，组件无需维护第二套动画引擎。

## Vue 与 Nuxt：等待真实挂载 {#nuxt}

Vue 的 `mounted` 不保证元素已进入 document。Nuxt out-in 和 Suspense 可能先在分离的容器中挂载页面。`createViewportEnterDirective()` 观察实际连接，再创建视口入场动画；不使用固定延迟或逐帧轮询。每个应用或 SSR 请求创建一个指令，并将其用于普通 HTML 元素。

```ts
import { createViewportEnterDirective } from '@rafaelaugusto/jolt/web/vue'

export default defineNuxtPlugin((nuxt) => {
  nuxt.vueApp.directive(
    'enter',
    createViewportEnterDirective({
      viewport: {
        keyframes: { opacity: [0, 1], y: [24, 0] },
        transition: { duration: 350 },
      },
    }),
  )
})
```

```vue
<template><section v-enter>Content</section></template>
```

工厂在 SSR 中安全，不输出隐藏内容的样式。`runtime` 可借用宿主上下文；`config` 配置自有上下文，`viewport` 提供默认选项。指令绑定覆盖默认值；更改配方时替换选项对象。卸载会取消等待，断开连接仅清理该入场效果。KeepAlive 重新创建未完成或重复入场，保留已完成的一次性历史；更换绑定重置历史。支持已知 ShadowRoot 及其宿主；移动到未知的封闭 shadow 树不在此适配器合同内。

`useWebMotion().use()` 和进入过渡同样等待实际插入。引用替换、停用、取消和 scope 销毁都会取消等待。命令式 `animate()`、`set()` 和 `runtime.viewportEnter()` 仍要求已挂载目标。异步数据应在同步 scope 回调之前准备。

如果页面过渡只改变透明度，而异步内容会改变页面高度，请像 Nuxt 示例一样为页面设置固定的 `transform-origin: 0 0`。默认的百分比原点会随尺寸变化而移动。如果变换需要随尺寸调整的中心点，请使用 runtime 的 `observeGeometry()`；等待元素插入文档并不代表接管外部几何变化。

<Clip name="web-nuxt-attachment-chromium" caption="macOS 上的 Chromium：真实生产 Nuxt 消费者演示 out-in、浏览器历史、KeepAlive 与异步页面。原速录制；不是物理设备测试。" />

<Clip name="vue-lifecycle-reference-ios" caption="已有 iOS 模拟器 Vue 参考：真实原生进入、离开与指令效果。此参考不复现 Nuxt 的 DOM 问题。" />

打包后的 Nuxt 4.6.3/Vue 3.5.44 消费者在三个浏览器验证 SSR、历史返回、延迟插入、KeepAlive 和减少动态效果。out-in 中打断异步路由时，即使仅使用 CSS 过渡，Nuxt 也可能停留在空占位符；此适配器不修复该路由限制。Vue 取消和资源清理有独立测试。参见[验证报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-attachment/README.md)。

## 回收 DOM 时保留数据身份 {#items}

`animateItems()` 管理动态行入场，不实现虚拟化或 FLIP 重排。唯一 key 可以是字符串、有限数值或对象身份。DOM 目标也必须唯一并挂载于运行时 document。更新先验证整个集合，再替换所有权。Vue 中在 `nextTick()` 后或 post-flush watcher 中调用 `update()`。

```ts
const rows = runtime.animateItems([{ key: item.id, target: rowElement }], 'fadeInUp', {
  root: scroller,
  once: true,
  duration: 400,
})

// After the renderer has committed the next DOM rows:
rows.update(nextItems.map((item) => ({ key: item.id, target: elements.get(item.id)! })))
rows.forget(item.id)
rows.suspend()
rows.resume()
rows.dispose()
```

默认 `once: false` 允许再次入场。`once: true` 的历史属于数据 key：同一 DOM 的新 key 重新入场；已见 key 的新 DOM 立即达到终点。对象使用弱引用历史；基本类型 key 保留到 `forget(key)`、`forget()` 或销毁。数据从缓存移除时清理旧 key。同一 key/元素重排保留播放，移除只停止该行入场。每行独立进入，因此拒绝 `stagger`；固定组错峰使用 `viewportEnter()`，FLIP 使用 `animateLayout()`。

`pending`、`completed`、`suspended`、`disposed` 描述控制器。空集合可随后添加行。一个 observer 组服务整个集合，一次性入场完成后断开观察。无 IntersectionObserver、减少动态效果或禁用时，内容仍可读。scope 接管控制器，暂停与销毁保留新的应用通道和独立 press。

<Clip name="web-attachment-items-chromium" caption="macOS Chromium：真实点击回收行、添加项目、重排已知身份和清除历史；按压反馈保持独立。" />

<Clip name="lists-android" caption="已有原生 ListView 参考：Android 模拟器中滚动行触发入场。Web 接受显式 key 和 DOM 行，不实现虚拟化。" />

## LTR 与 RTL 横向滚动 {#horizontal}

```ts
const offset = runtime.scrollValue(rail, { axis: 'x' })
const progress = offset.to([0, 600], [0, 1])
const link = runtime.scrollLinked(
  rail,
  indicator,
  { scaleX: [0.02, 1] },
  {
    axis: 'x',
    range: [0, 600],
    execution: 'auto',
  },
)
// After application geometry changes:
offset.refresh()
link.refresh()
// On teardown:
link.dispose()
progress.dispose()
offset.dispose()
```

默认轴仍为 `y`。`axis: x` 从逻辑起点返回归一化 CSS 像素：LTR 从左，RTL 从右，向另一端递增。负 RTL scrollLeft 与弹性越界会归一化并钳制。document 和元素具有相同合同。方向、class/style、内容、大小和字体变化会使几何失效；其他变化后调用 `refresh()`。

合适的播放使用所选轴的 `ScrollTimeline`。`execution: scheduler` 强制共享调度器回退；测试对比 LTR/RTL 终点和反向滚动。合成、部分替换、减少动态效果及源移除沿用所有权规则。静止时不调度帧。所选轴上的反向 flex 和竖排 writing-mode 在获取所有权前明确拒绝。不承诺 CSS 像素、原生 DIP 和原生 RTL 约定完全相同。

<Clip name="web-attachment-horizontal-chromium" caption="macOS Chromium：真实横向滚轮输入在 LTR 和 RTL 下前进、返回，进度条跟随相同逻辑偏移。" />

<Clip name="horizontal-scroll-ios" caption="iOS 26.2 模拟器：原生横向 ScrollView 的真实手势驱动进度条。原生 x 轴参考；不验证浏览器 RTL 或物理设备性能。" />
