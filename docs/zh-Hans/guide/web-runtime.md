# Web 有限动画运行时

自 **0.1.0-rc.5** 起，实验性 `@rafaelaugusto/jolt/web` 入口使用 Jolt 的可移植编译器和 WAAPI 直接操作 HTML 元素，不依赖 Vue、React 或 NativeScript。参见[安装](./install#experimental-web-candidate)。Mavis press/reveal 迁移和共享应用动画示例仍是 [#236](https://github.com/rafaelaugustos/jolt/issues/236) 中的独立验收工作。

指针和键盘输入现由 [Web 按压反馈](./web-press)提供；以下录制仍作为有限运行时参考。

<Clip name="web-runtime-chromium" :width="720" caption="macOS arm64 上的 Chromium 156，真实浏览器播放与点击，保持原速：位移与透明度、局部中断、应用缩放与按压贡献、反向重复、暂停、seek、恢复和减少动态效果。按钮用于验证贡献组合；完整的指针/键盘按压识别属于 #283。" />

## 支持的动画 {#supported-motion}

`x`、`y` 使用 CSS 像素，`rotate` 使用度，`scaleX`/`scaleY` 使用倍率，`opacity` 限制在 0–1。`scale` 展开为两个轴；显式轴设置优先。固定目标弹簧、tween、数值关键帧、兼容的内置/自定义 preset、逐属性过渡、delay 和 stagger 均使用现有编译器。原生数值配方可共享，而无需导入原生运行时。

每个运行时属于一个 document。配置、preset、所有权 token、效果和清理资源均属于该上下文。两个上下文不能同时控制同一元素。Web 入口可以在没有 DOM 时导入；创建运行时需要支持 WAAPI 的活动 document。没有全局 driver 注册。

```ts
// 本地候选包中的实验性入口。
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
motion.set(card, { scale: 1.1 })
const move = motion.animate(card, { x: 240, opacity: 1 }, 'snappy')
motion.animate(card, { scale: 0.96 }, { layer: 'press', duration: 120 })
// 视觉缩放为 1.056。只释放 press 会保留应用的缩放值。
motion.animate(card, { scale: 1 }, { layer: 'press', duration: 120 })
move.pause()
move.progress = 0.5
move.play()
const completed = await move.finished
motion.release(card)
motion.dispose()
```

## 控制、组合与清理 {#controls-and-cleanup}

每次调用拥有自己的逻辑通道和一个源时钟。位移/旋转贡献相加，缩放/透明度贡献相乘。每个表面由一个组合后的视觉效果播放。替换 `x` 会保留其他通道和私有贡献。旧 handle 即使之后 seek 或完成，也不能重新取得已替换的通道。准备失败或超出关键帧预算时，原有播放保持不变。

`progress` 覆盖整个有限时间线，包括延迟和重复。暂停时 seek 到 `1` 仍保持暂停，也能向后 seek；恢复播放后才完成。`stop()` 保留当前采样值并使 `finished` 返回 `false`。自然完成保留终值并返回 `true`；局部替换使旧调用在其剩余通道结束后返回 `false`。终止的 handle 不会重新启动。完成时会移除效果和源时钟；终值保留到 `release()` 恢复原始内联样式。释放时保留外部修改过的内联样式。

移出的 target 会自动释放，包括 shadow root 内部的元素。框架 adapter 仍应在生命周期结束时释放表面。`dispose()` 还会移除 observer、偏好监听器和待执行帧。document 时间线未解析时保留姿态，直到激活；`ready` 在激活或释放时完成。正常的有限播放没有库自身的逐帧循环，也不逐帧通过 JavaScript 写入样式。

## 时间与减少动态效果 {#timing-and-reduced-motion}

中断会将已解析的源起始时间投影到命令发生时的 document performance 时钟，并使用同一时间戳锚定组合和新播放。位置、速度来自源模型；暂停或待激活运动传递零速度。这避免了在长任务期间使用过时的渲染 tick。浏览器呈现和数值曲线精度分别验证，包括在 WebKit 中繁忙 JavaScript 任务之后以 2,000 px/s 中断的测试。

`reducedMotion: 'user'` 实时跟随浏览器偏好。启用时，活动 transform 通道到达终值，透明度继续播放。关闭后允许未来运动，不重播已结束通道。`'always'`、`'never'` 按上下文覆盖偏好。`timeScale` 只影响未来 track。有限循环/反向重复支持 0–1,000 次重复，无限播放不在此阶段范围。每条 track/组合表面的默认准备预算为 6,001 个关键帧，可配置为 2–60,001；超过预算将拒绝整个事务。

## 表面策略与限制 {#surface-policy-and-limits}

运行时控制已挂载、可变换的 HTML 盒子的 `transform` 和 `opacity`。顺序为 `静态 2D 基线 × translate × rotate × scale`，保留原始 `transform-origin`。不支持独立 CSS transform 属性、3D 基线、已有动画/过渡或带 `!important` 的内联运动样式。外部修改 CSS 前须释放并重建；不监控任意样式表/CSS 变量变化。如果外部代码控制外层元素样式，可使用专用内层运动表面。

本阶段仅支持有限播放：连续弹簧、drag/pinch、motion values、滚动、布局、原生专有属性和其他框架生命周期 adapter 属于后续工作。尚未建立稳定的可移植引用 API，也未完成 Mavis 集成。仅使用 WAAPI 并不能证明合成器加速或保证 FPS。

## 原生参考与验证 {#native-reference-and-validation}

原生播放行为保持不变。以下经过审查的英语原生录像展示组合行为，并非 Web fixture 或共享 Mavis 页面在原生端运行的演示。

<Clip name="layers-ios" caption="iOS 模拟器，现有原生 Layers 演示：运动与反馈层共存。保留的原生参考录像，不是真机录像，也不是新的 Web 运行时。" />

<Clip name="layers-android" caption="Android 模拟器，现有原生 Layers 演示：运动与反馈层共存。保留的原生参考录像，不是真机录像，也不是新的 Web 运行时。" />

使用 Node 22，安装依赖和 Playwright 的 Chromium/Firefox/WebKit 后，运行 `npm run web:runtime:typecheck`、`npm run web:runtime:test` 和 `npm run web:runtime`。在 `http://127.0.0.1:4282` 打开 fixture；运行测试前停止服务器。[证据报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-runtime.md)说明时钟测试、共享原生基准、回滚、清理及录像命令。

可选 [Vue DOM 适配器](./web-vue) 现已提供声明式 ref 和进出场生命周期。
