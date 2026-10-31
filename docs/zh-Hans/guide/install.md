# 安装 {#install}

```sh
npm install @rafaelaugusto/jolt@next
```

**候选版本 0.1.0-rc.4** 通过 `next` 标签发布。0.1.0 的功能范围已冻结，目前正在验证兼容性并准备正式版。要求 `@nativescript/core` 8.9 或更高版本。Jolt 不依赖特定框架：它接收视图或包含视图的元素，因此可用于 NativeScript-Vue、Angular、Svelte 或纯 NativeScript。NativeScript-Vue 应用还可以从 `@rafaelaugusto/jolt/vue` 导入[指令和过渡组件](./vue)。

Jolt 包含 iOS 和 Android 原生辅助代码。安装或升级 Jolt 后，请重新编译原生应用；仅更新 JavaScript 无法安装原生代码。

当前候选版本为 **0.1.0-rc.4**。如需固定版本，请使用 `npm install @rafaelaugusto/jolt@0.1.0-rc.4`。使用[外部原生属性适配器](./native-properties)时，还需安装对应版本的 `@rafaelaugusto/jolt-native@0.1.0-rc.4`，然后重新编译原生应用。

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
