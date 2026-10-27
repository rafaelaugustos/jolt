# 认识 Jolt {#what-jolt-is}

Jolt 对 [NativeScript](https://nativescript.org) 视图进行动画处理：预设、弹簧、关键帧和交错，每个调用一次。

```ts
import { animate } from '@rafaelaugusto/jolt'

animate(card, 'fadeInUp')
animate(button, { scale: 1.1 }, 'bouncy')
animate(rows, 'fadeInUp', { stagger: 40 })
```

## 为什么不是`view.animate()` {#why-not-view-animate}

NativeScript 的 `view.animate()` 涵盖了基础知识并就此止步：每个属性都有一条曲线，没有设置的 `spring` 曲线，没有关键帧，以及取消动画时拒绝的承诺。任何更丰富的东西最终都会成为平台代码。

动画启动时，Jolt 在 JavaScript 中计算一次运动曲线，再将关键帧交给平台：iOS 使用 Core Animation，Android 使用 `ObjectAnimator`。常规视图轨道无需每帧执行 JavaScript。实际尺寸布局、主动订阅和手势输入有各自的[执行边界](./how-it-works)。弹簧遵循物理规律；新动画中断旧动画时，会从视图当前的位置和速度继续。

## 它涵盖什么 {#what-it-covers}

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

1. [安装它](./install).
2. 阅读 [动画](./animating)：目标是什么、哪些属性会移动以及关键帧是如何写入的。
3. 选择 [过渡](./transitions) 或 [预设](./presets)。

目前是候选发布版本（RC），通过 `next` 标签发布。不依赖特定框架：接收视图或包含视图的元素即可。
