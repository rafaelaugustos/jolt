# Vue Web 动画

**RC.7 同时提供：**[作用域、指针/视口与 Vue 持续配置](./web-lifecycle)，以及[浮层几何、共享元素、完整示例与诊断](./web-interactions)。Mavis 集成另行推进。

**自 RC.7 起：**[颜色、边框、连续绘制、真实尺寸、FLIP 与可定位场景](./web-visual)扩展此运行时。Web API 仍为实验性功能；完整对等由 [#236](https://github.com/rafaelaugustos/jolt/issues/236) 跟踪。

实验性 `@rafaelaugusto/jolt/web/vue` 入口已包含在 **0.1.0-rc.5** 中，将声明的 DOM ref 连接到 [Web 运行时](./web-runtime)。请单独安装 Vue 3.5。原生 `/vue` 仍表示 NativeScript 集成；命令式 `/web` 不会安装 Vue。参见[安装](./install#experimental-web-candidate)。

<Clip name="web-vue-chromium" :width="720" caption="macOS arm64 上的 Chromium 156：真实鼠标和键盘输入反转离场、按住卡片、在按住时改变应用缩放、替换表面并完成隐藏与显示。原速浏览器录制；不代表实体设备性能。" />

## 声明 DOM 表面 {#declared-surface}

```vue
<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'

const visible = ref(true)
const surface = shallowRef<HTMLElement | null>(null)
const motion = useWebMotion(surface, {
  initial: { opacity: 0, y: 24 },
  enter: { keyframes: { opacity: 1, y: 0 }, transition: { duration: 220 } },
  leave: { keyframes: { opacity: 0, y: -12 }, transition: { duration: 160 } },
})
</script>

<template>
  <button @click="visible = !visible">Toggle</button>
  <Transition v-bind="motion.transition" appear>
    <div v-if="visible" ref="surface">Content</div>
  </Transition>
</template>
```

在 `setup` 中同步调用 composable。它按需为目标所属的 document 创建运行时。导入和 SSR 渲染不需要浏览器全局对象。`animate`、`set`、`press` 和 `stop` 操作当前已挂载的 DOM ref；挂载前或作用域销毁后调用会抛出错误。`configure` 遵循 Web 策略。组件实例、通过 `$el` 查找目标以及通用复合组件 ref 不在此实验性合同之内。

返回的 `transition` 对象提供 `css: false`、进场、离场和取消钩子。将其绑定到 Vue `Transition`，同时保留 `@before-leave`、`@after-leave` 等应用钩子。配方采用命令式运行时相同的 keyframes 和 transition，且必须具有有限时长。适配器不会增加物理解算器或逐帧循环。

## 生命周期与合成 {#lifecycle}

- `initial` 在每个进场元素插入后、播放前执行一次。相同 `v-show` 表面重新进入时，从当前状态继续。
- 离场期间 `v-if` ref 可以变成 null，但元素会保留到当前播放结束或被中断。中断不会使元素永久滞留。
- Vue 取消操作先使该次过渡失效，再停止动画。旧 Promise 不会结束新的离场，也不会删除已重新进入的元素。`v-if` 可以创建新表面；`v-show` 可以复用原表面。
- 替换 ref 时释放旧目标，当前离场仍在进行时除外。销毁作用域会取消任务、移除按压监听器和效果，并忽略过期完成回调。
- 应用动画和按压共用上下文：1.1 × 0.96 = 1.056。按住时将基础缩放改为 1.2，得到 1.152；松开后恢复 1.2。替换 DOM 元素后必须重新创建按压绑定。
- 实时减少动态效果设置遵循运行时策略：transform 到达终点，opacity 保留有限时间线。CSS 表面限制保持一致；不要竞争写入已被接管的动画样式。

组件或应用负责焦点、`inert`、`aria-hidden`、激活策略和触发器焦点恢复。请使用 Vue 钩子实现这些行为；Jolt 不会移动焦点或提供无障碍语义。这为 Mavis Reveal 提供基础，其迁移和应用的可移植 ref API 仍是独立任务。

## 验证与限制 {#verification}

`npm run web:integration:test` 在 Chromium、Firefox 和 WebKit 中验证中断、控制、目标替换、减少动态效果、按压合成和重复清理。`npm run package:check` 将真实 tarball 安装到命令式和 Vue 消费者，验证严格类型声明、直接及 Vite SSR、真实浏览器播放，并保留原生生产构建验证。

[集成报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-integration.md) 记录版本、负载和回归预算。准备 100 张弹簧动画卡片会产生可测量的主线程工作；本测试不保证移动设备帧率或输入延迟。Chromium 专用阻塞测试使用实际呈现帧与浏览器 trace，而不是 rAF 次数。

原生 `/vue` 行为保持不变。下面已有录制仅作为原生参考，并不表示 Web 代码在原生环境运行：

<Clip name="vue" caption="已有英文 NativeScript Vue 演示，运行于 iOS 模拟器：JoltTransition 移除并恢复一行。原生播放参考；不是实体设备或共享 Mavis 页面。" />

同一批改动修复 Android 已稳定 layer 的实际显示，并验证 iOS 一致性：

<Clip name="layer-cleanup-android" caption="Android 16 / API 36 模拟器上的英文 Layers 检查，由真实 ADB 点击启动：释放过程中移除反馈后恢复非单位基础缩放，并保留移动基础、其他 layer 和减少动态效果行为。检查原生显示值。原速录制；仅作为模拟器正确性证据。" />
<Clip name="layer-cleanup-ios" caption="iOS 26.2 模拟器上的英文 Layers 检查，由真实 XCTest 点击启动：相同移除、合成和减少动态效果场景读取 Core Animation 呈现值。原速录制；不是实体 iPhone。" />
