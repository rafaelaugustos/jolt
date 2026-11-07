# 安装 {#install}

```sh
npm install @rafaelaugusto/jolt@next
```

RC.6 包含[Web 连续动画](./web-dynamic)：数值、跟随弹簧及拖动/吸附，以及[数值映射、几何刷新和垂直滚动](./web-support)。Web API 仍为实验性功能。

**候选版本 0.1.0-rc.12** 通过 `next` 标签发布。原生 0.1.0 的功能范围已冻结，目前正在验证兼容性并准备正式版。NativeScript 消费者要求 `@nativescript/core` 8.9 或更高版本。Jolt 不依赖特定框架：它接收视图或包含视图的元素，因此可用于 NativeScript-Vue、Angular、Svelte 或纯 NativeScript。NativeScript-Vue 应用还可以从 `@rafaelaugusto/jolt/vue` 导入[指令和过渡组件](./vue)。

Jolt 包含 iOS 和 Android 原生辅助代码。安装或升级 Jolt 后，请重新编译原生应用；仅更新 JavaScript 无法安装原生代码。

当前候选版本为 **0.1.0-rc.12**。如需固定版本，请使用 `npm install @rafaelaugusto/jolt@0.1.0-rc.12`。使用[外部原生属性适配器](./native-properties)时，还需安装对应版本的 `@rafaelaugusto/jolt-native@0.1.0-rc.12`，然后重新编译原生应用。

## 实验性 Web 入口 {#experimental-web-candidate}

从 **0.1.0-rc.5** 起，包中包含实验性 `/web` 和 `/web/vue` 入口。可直接安装已发布的候选版本；仅在使用 Vue DOM 适配器时添加 Vue。根入口和 `/vue` 仍用于原生环境。

```sh
npm install @rafaelaugusto/jolt@0.1.0-rc.12
# 仅供可选 Vue DOM 适配器使用：
npm install vue@^3.5.0
```

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

// SSR 中可以安全导入。在浏览器挂载后创建上下文。
const motion = createWebRuntime(document)
const animation = motion.animate(card, { x: 120, opacity: 1 }, 'snappy')
await animation.finished
motion.dispose() // 应用结束或组件卸载时释放
```

| 导入                          | 平台与依赖                                                          |
| ----------------------------- | ------------------------------------------------------------------- |
| `@rafaelaugusto/jolt`         | NativeScript；需要 `@nativescript/core >=8.9.0`。                   |
| `@rafaelaugusto/jolt/native`  | 原生属性 adapter；需要 NativeScript。                               |
| `@rafaelaugusto/jolt/vue`     | NativeScript-Vue；另需 `nativescript-vue >=3.0.0`。                 |
| `@rafaelaugusto/jolt/web`     | 命令式 DOM 运行时；无需安装 NativeScript、Vue 或 React。            |
| `@rafaelaugusto/jolt/web/vue` | 可选 Vue DOM 适配器；需要 `vue ^3.5.0`。参见 [Vue Web](./web-vue)。 |

NativeScript 和 NativeScript-Vue 在包级别为可选 peer，以避免 Web 消费者安装它们。使用相应原生入口时仍必须安装。缺少 peer 的解析错误会明确指出 `@nativescript/core` 或 `nativescript-vue`；请在原生应用中安装所指依赖。Web 应用必须导入 `/web`，SSR 也一样。根入口和 `/vue` 不会自动切换平台。

Web API 仍是实验性的：提供 document 所有的 runtime，包含有限播放、连续运动、滚动及类型，不公开 driver 注册、内部诊断或可移植组件引用。`/core`、内部实现路径和 `/web/react` 均未导出。浏览器 API 需要 DOM 类型，但其可达声明不需要原生 globals。坐标使用 CSS 像素，旋转使用度，缩放使用倍率。能力、清理和 CSS 所有权限制见[Web 有限播放](./web-runtime)。

[安装包消费者检查](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/package-consumers.md)覆盖 Vite 开发/生产、SSR、NodeNext/Bundler 类型和现有原生入口。可选 Vue Web 入口已有独立 tarball 消费者，验证类型、直接/Vite SSR，以及开发和生产构建中的真实进出场与按压。

## iOS 上的 ProMotion {#promotion-on-ios}

在 iOS 15 及更高版本上，Jolt 为其原生动画请求高达 120 Hz，并受视图屏幕的限制。要允许 iPhone 上的速率高于 60 Hz，请将其添加到 `App_Resources/iOS/Info.plist` 的根 `<dict>` 中并重建应用程序：

```xml
<key>CADisableMinimumFrameDurationOnPhone</key>
<true/>
```

这只是首选刷新率，并不保证固定帧率。iOS 可能因功耗、温度或辅助功能而选择较低的刷新率。较早的 iOS 版本保持原有行为，60 Hz 屏幕则使用 60 Hz 的首选值。参见 [Apple 的 ProMotion 指南](https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays)。

曲线采样点与屏幕显示帧是两个概念：Core Animation 会按屏幕选定的刷新率，在 Jolt 的采样点之间插值。仅为了以 120 Hz 渲染，并不需要增加采样点。

## 第一部动画 {#first-animation}

```vue
<script setup lang="ts">
import { ref } from 'nativescript-vue'
import { animate } from '@rafaelaugusto/jolt'

const card = ref()
const open = () => animate(card.value, 'popIn')
</script>

<template>
  <GridLayout ref="card" @tap="open" />
</template>
```

## 演示应用程序 {#the-demo-app}

存储库在 [`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) 中提供了一个 NativeScript-Vue 应用程序，其中包含每个预设、球上的三个弹簧，您可以在启动时中断、交错、按下效果、循环和序列。

安装 [NativeScript CLI](https://docs.nativescript.org/setup/) 后：

```sh
npm install
npm run dev        # builds Jolt in watch mode

cd demo
npm install
ns run ios         # or: ns run android
```
