# Web 连续动画 {#web-dynamic}

自 **0.1.0-rc.6** 起，`@rafaelaugusto/jolt/web` 提供 `motionValue()`、`bind()`、`springValue()` 和 `drag()`。Web API 仍为实验性功能；原生入口与 Vue 适配器合同保持不变。

<Clip name="web-dynamic-chromium" caption="Chromium 156 桌面浏览器，原速：真实指针和键盘输入控制跟随弹簧、按压期间的应用缩放、拖动与重新捕获吸附、卸载/重建及暂停/减少动态效果。浏览器录像，不是原生或真机性能证据。" />

## 输入值与绑定 {#values}

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'

const motion = createWebRuntime(document)
const input = motion.motionValue(0)
const follower = motion.springValue(input, { stiffness: 170, damping: 22 })
const binding = motion.bind(card, { x: follower })
input.set(180)
input.set(60)

binding.dispose()
follower.dispose()
input.dispose()
motion.release(card)
motion.dispose()
```

数值属于创建它的上下文。`get()` 读取当前值，`getVelocity()` 返回单位/秒。`set()` 同步修改输入，视觉写入合并到帧中。可绑定 x/y、旋转、缩放和透明度；scale 展开为 scaleX/scaleY。其他上下文、已销毁或非数值输入会在替换现有所有权前报错。

`subscribe(listener)` 在计划的帧写入后通知变化，返回取消订阅函数，不自动通知初始值。回调有自己的 JavaScript 成本，不会使无关的 WAAPI 动画变成帧循环。数值映射及有界跟随链见[RC.6 Web 支持](./web-support)。颜色和完整的原生/Web API 对等性仍不在范围内。

绑定只拥有指定的基础通道。后续 `animate()`、`set()`、`stop()` 只替换对应通道，其他绑定和 press 图层继续。旧绑定销毁后不能恢复旧值。解除绑定保留当前值；`release()` 恢复仍由库拥有的内联样式并取消目标工作，移出 DOM 也会自动执行。数值可以比目标存活更久，请单独销毁数值或销毁 runtime。销毁输入也会销毁其弹簧跟随者。

## 调度器与弹簧 {#scheduler}

每个上下文使用一个调度器，按读取、更新、写入阶段批处理，并使用时间戳而不是固定 60 Hz 步长。输入、观察者和动画稳定后不再请求帧。文档隐藏期间不推进连续弹簧的时间，恢复时不追算整个间隔；有限 WAAPI 动画仍遵循浏览器时间线。

表面存在活动绑定时，该表面的有限通道也由调度器合成；其他表面继续使用 WAAPI。解除绑定后，剩余有限轨道恢复 WAAPI 播放而不重启时钟。连续合成需要 JavaScript，不保证合成器执行。

弹簧通过可移植解析求解器跟随输入 `motionValue`。选项为 `stiffness`、`damping`、`mass` 或 `duration`/`bounce`，以及 `initial`、`restDelta`（默认 0.001 单位）、`restSpeed`（0.01 单位/秒）。`pause()` 保持位置和速度，输入仍可改变；`play()` 向最新目标继续；`stop()` 以零速度保持；`jump()` 立即到达当前输入；`dispose()` 终止使用。

减少动态效果设置会立即稳定所有通用弹簧，包括没有绑定的弹簧；直接输入仍直接生效。每条新轨迹捕获当前 `timeScale`，配置更改不重新缩放已有轨迹。零阻尼可能持续运行，直到停止或销毁。

## 拖动与有限吸附 {#drag}

```ts
const drag = motion.drag(card, {
  axis: 'x',
  bounds: { left: -120, right: 120 },
  snap: { x: [-100, 0, 100] },
  spring: { stiffness: 180, damping: 20 },
})
```

初始范围是一个主指针和 x/y 平移，单位为 CSS 像素。目标的静态 CSS 基础变换必须为单位矩阵，祖先不能存在变换、透视或 CSS zoom。Jolt 自己的旋转、缩放和 press 在平移之后合成，因此可以使用。滚动和 resize 会取消拖动；任意变换祖先、双指缩放和嵌套滚动交接暂不支持。

拖动在 pointerdown 时接管平移并捕获指针。x 轴临时设置 `touch-action: pan-y`，y 轴设置 `pan-x`，双轴设置 `none`，销毁时恢复先前的内联值。内部交互控件保留自己的输入。点击和键盘激活保持有效；实际拖动会抑制它产生的点击。Disabled/inert/busy、取消、丢失捕获/焦点、隐藏和卸载会取消输入，不执行成功释放的吸附。

Bounds 限制直接输入和吸附目标，释放弹簧可能越过边界。吸附按每轴 150 ms 速度投影选择最近点；未提供点时返回绑定时的位置。释放速度来自近期指针样本，80 ms 不移动后变为零，上限为 5,000 CSS 像素/秒。释放将位置和速度交给有限 WAAPI 播放；新拖动可以捕获回程。应用的新所有者会取消旧拖动，旧清理不会恢复其平移。

`drag.animation` 暴露最近吸附及 `finished`。`update({ disabled: true })` 取消输入；`cancel()` 保持位置而不吸附；`dispose()` 只停止自己的吸附。销毁目标/runtime 释放绑定和监听器。组件仍负责拖动的键盘替代方式和无障碍语义。

## 原生参考与验证 {#verification}

下列已检查录像保留现有原生实现，展示原生数值、跟随弹簧和拖动，不展示新 Web 调度器或 Mavis 共享屏幕。原生与 Web API 保留各自支持的子集。

<Clip name="live-springs-ios" caption="现有 iOS 模拟器演示：真实目标反转、触摸跟随、独立 shake 图层及减少动态效果。原速，原生参考，不是真机录像。" />
<Clip name="live-springs-android" caption="现有 Android 模拟器演示：原生跟随者响应真实点击、滑动及减少动态效果。原速，原生参考。" />
<Clip name="drag-values-ios" caption="现有 iOS 模拟器演示：可拖动面板驱动绑定值并吸附，应用动画可以被打断。原速。" />
<Clip name="drag-values-android" caption="现有 Android 模拟器演示：真实快速滑动和重新抓住运动面板，使用原生值绑定。原速。" />

运行 `npm run web:dynamic:typecheck` 和 `npm run web:dynamic:test`。Chromium、Firefox、WebKit 覆盖合成、取消和清理。真实触摸滚动注入仅使用 Chromium，其他引擎保留指针取消测试。隐藏时间测试显式控制可见性信号，不是真机后台测量。参见[复现报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-dynamic.md)。原生 CI 和实际 Web/Vue/SSR/原生包消费者仍为必需验证。本次不更改 Mavis，也不添加框架适配器。
