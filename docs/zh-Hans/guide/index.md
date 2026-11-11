# 认识 Jolt {#what-jolt-is}

Jolt 为 [NativeScript](https://nativescript.org) 应用和 Web 带来动效：预设、弹簧、关键帧、交错动画和手势，分别提供面向原生视图和 HTML 元素的 API。

## NativeScript

通过包的主入口，为 iOS 和 Android 原生视图添加动画：

```ts
import { animate } from '@rafaelaugusto/jolt'

animate(card, 'fadeInUp')
animate(button, { scale: 1.1 }, 'bouncy')
animate(rows, 'fadeInUp', { stagger: 40 })
```

## Web

使用 `@rafaelaugusto/jolt/web` 为 HTML 元素添加动画。它共享 Jolt 的运动编译器，并使用 Web Animations API（WAAPI），无需安装 NativeScript 或界面框架。

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const card = document.querySelector<HTMLElement>('.card')

if (card) {
  motion.animate(card, 'fadeInUp')
}
```

在浏览器挂载后创建运行时，并在应用或组件卸载时调用 `motion.dispose()`。[可选的 `/web/vue` 适配器](./web-vue)通过 Vue 生命周期管理资源。包的主入口和 `/vue` 面向 NativeScript，不会自动切换到 DOM。

Web API 仍处于**实验阶段**。从 [Web 运行时](./web-runtime)开始，再了解[连续运动](./web-dynamic)、[手势与滚动](./web-gestures)以及[渐变、加载与文本](./web-effects)。各指南分别说明支持的目标和限制。

## SwiftUI（测试版）{#swiftui-beta}

**0.1.0-rc.14（测试版）**支持 iOS 17+ 和 macOS 14+，无需 NativeScript 或 JavaScript。从软件包仓库 [`jolt-swift`](https://github.com/rafaelaugustos/jolt-swift) 的标签 `v0.1.0-rc.14` 安装 `JoltSwiftUI` 产品。平台限制请参阅[安装](./swiftui)、[生命周期](./swiftui-motion)和[交互与几何](./swiftui-geometry)。

## 为什么不是`view.animate()` {#why-not-view-animate}

NativeScript 的 `view.animate()` 涵盖了基础知识并就此止步：每个属性都有一条曲线，没有设置的 `spring` 曲线，没有关键帧，以及取消动画时拒绝的承诺。任何更丰富的东西最终都会成为平台代码。

动画启动时，Jolt 在 JavaScript 中计算一次运动曲线，再将关键帧交给平台：iOS 使用 Core Animation，Android 使用 `ObjectAnimator`。常规视图轨道无需每帧执行 JavaScript。实际尺寸布局、主动订阅和手势输入有各自的[执行边界](./how-it-works)。弹簧遵循物理规律；新动画中断旧动画时，会从视图当前的位置和速度继续。

## 它涵盖什么 {#what-it-covers}

以下指南面向 NativeScript 视图。对于 HTML 元素，请阅读上面的 Web 指南。

- [25 个预设](./presets)进入、退出并提醒注意：`fadeInUp`、`popIn`、`shake`、`heartbeat`...
- [弹簧](./transitions#springs) 通过感觉 (`bouncy`)、`bounce` 和 `duration` 或通过刚度、阻尼和质量来描述。
- [关键帧和补间](./transitions#tweens) 具有每段缓动和精确的关键帧时间。
- [错开](./stagger) 跨越多个视图，从第一个、最后一个或中心。
- [序列](./sequences) 一旦前一步看起来完成就开始每一步。
- [按压效果](./press)跟随手指，并在滚动接管交互时释放。
- [Vue 指令和转换组件](./vue) 来自可选的 `@rafaelaugusto/jolt/vue` 条目。
- [文字入口](./text) 在 iOS 和 Android 上用字母或单词表示，保留一个可访问的标签。
- [中断](./interrupting) 拾取屏幕上的值和速度，无跳跃。
- [原生播放](./how-it-works)：iOS 上的 Core Animation 和 Android 上的 `ObjectAnimator` 用于默认视图轨道；每个 API 都会记录执行成本。

- [Real dimensions](./size)：在文本重排和同级移动时设置宽度、高度和自动动画。
- [SceneKit相机视野](./scene-camera)：用​​iOS上的动画值来坐标透视缩放。

## 从哪里开始 {#where-to-start}

1. [安装 Jolt](./install)，并选择适合目标平台的入口。
2. **NativeScript：**阅读[动画](./animating)，然后选择[过渡](./transitions)或[预设](./presets)。
3. **Web：**从 [Web 运行时](./web-runtime)或 [Vue DOM 适配器](./web-vue)开始。

Jolt 目前是候选发布版本；已发布版本请参阅[安装](./install)。两个运行时都可直接使用，也提供可选的框架集成。

## 如何阅读菜单 {#reading-the-menu}

侧栏用三种标签标记功能：

- **新增：**在本文档版本中引入。
- **已更新：**现有功能有实质性变化。
- **测试版：**实验性 API 或适配器，接口约定可能变化。

文档版本变化后，新增和已更新标签自动失效。测试版标签保留到 API 稳定。标签说明会区分已发布功能与源码候选；指南会说明尚待合并或发布的部分。仅有标签并不意味着功能已经发布。

<Clip name="docs-navigation-rc14-desktop" caption="macOS 上的 Chromium，桌面视口：侧栏中的当前版本标签、键盘导航与明暗主题。展示的是文档导航，并非原生应用。" />

<Clip name="docs-navigation-rc14-mobile" caption="macOS 上的 Chromium，模拟移动视口：打开菜单并访问带标签的条目。浏览器模拟，并非实体手机录制。" />
