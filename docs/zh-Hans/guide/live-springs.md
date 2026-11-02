# 实时弹簧 {#springs-that-follow-a-moving-target}

自 **0.1.0-beta.16** 起在核心包中可用。升级后重建原生应用程序。不需要可选的原生属性插件。

`springValue()` 在其目标改变时保留原生弹簧的位置和速度。重定向更新现有节点；它不会重建关键帧动画。一个关注者可以驱动另一个关注者，而无需在他们之间订阅 JavaScript。

```ts
import { bind, motionScope, motionValue, set, springValue } from '@rafaelaugusto/jolt'

const scope = motionScope()
const pointer = motionValue(0)
const first = scope.add(springValue(pointer, { stiffness: 260, damping: 24 }))
const second = scope.add(springValue(first, { stiffness: 260, damping: 24 }))
scope.use(() => bind(cursor, { x: first }))
scope.use(() => bind(trailingCursor, { x: second }))

set(pointer, 180)
set(pointer, -40) // preserves each follower's position and velocity
// On page/component disposal:
scope.dispose()
```

<Clip name="live-springs-ios" caption="iOS 模拟器上的三个本地跟随器：目标反转、真实的触摸拖动、附加抖动和减少的运动。实时播放；该记录不展示真机的 120 Hz 性能。" />

<Clip name="live-springs-android" caption="Android 模拟器上的相同跟随者链，由真实的点击和滑动驱动。最后一个跟随者也会收到一个抖动层；减少的运动将链条直接移动到目标。" />

## 来源和绑定 {#sources-and-bindings}

源可以是动画值、数字映射或另一个弹簧值。 `animate(pointer, ...)` 在播放边界发送采样的源轨道，因此跟随者也可以遵循原生时间线。数字 `to()` 映射，包括降序范围、重复停止和外推，针对跟随者链和绑定原生执行。

将结果绑定到 `x`、`y`、`scale`、`scaleX`、`scaleY`、`rotate`、`rotateX`、`rotateY` 或 `opacity`。稳定版尚不支持绘制和复合适配器；[RC.6 扩展](#live-paint) 增加背景颜色和统一半径。 spring 值是只读的：更新其源，而不是将 follower 传递给 `animate()` 或 `set()`。

命名变换和不透明层仍然与绑定基础组合：

```ts
bind(card, { x: first })
animate(card, { x: [0, -12, 12, 0] }, { layer: 'feedback', duration: 500 })
```

原生混合器添加平移/旋转层并乘以缩放/不透明度层。暂停或停止图层会使跟随者继续运行。用常规动画替换实时绑定会将其分离并提交其当前的基本位置；从者继续驱动其其他绑定。

## 配置和使用寿命 {#configuration-and-lifetime}

选项接受 `stiffness`、`damping`、`mass` 或现有的 `duration`/`bounce` 弹簧参数化。 `initial`选择起始位置；否则，跟随者将从其源的当前值开始。 `duration: 0` 紧随其后。创建关注者时会捕获全局时间尺度。

`restDelta` 默认为 **0.001 源单位**，`restSpeed` 默认为 **每秒 0.01 源单位**。两者都必须是积极的。静止的弹簧准确地保持其目标，并在没有其他原生追随者或层需要帧时停止请求帧。它会在下一个目标更改时唤醒。休息不是处置：订阅仍由其范围拥有，直到 `dispose()`。

`get()` 和 `getVelocity()` 读取原生状态。 `moving` 独立于任何层报告弹簧运动。 `subscribe()` 明确选择加入 JavaScript 观察；普通绑定和追随者链不需要每帧 JS 回调。卸载绑定视图会删除其原生绑定，再次加载它会使用关注者的当前状态。

`pause()` 保存位置和速度； `play()` 朝着当前目标恢复。运动范围在悬挂期间暂停保留的弹簧并恢复它们而不创建新节点。手动暂停的 spring 在应用程序后台/恢复期间保持暂停状态。在 Vue 中，使用 `useMotionScope().add(springValue(source, options))` 和 `useBinding()` 通过缓存组件激活和实际卸载来拥有从属者。

减少运动将链直接更新到其当前目标。应用程序暂停保持弹簧状态； resume 再次跟随当前源。实时调度程序使用最多 1/240 秒的有界子步，并在延迟帧后最多积分 64 毫秒，从而避免了较大的追赶跳跃。固定目标 `animate()` 呼叫保留其现有的 Core Animation / Android 播放路径。

演示的触摸事件当前更新来自 JavaScript 的源。对于原生手势输入和滚动切换，请使用可选的 [手势API](./gestures)； `springValue()` 并不使手势识别器本身成为原生。 C 和 Java spring 内核具有匹配的轨迹测试，包括 60/120 Hz 时间步划分和延迟帧。这些测试不会取代真机上的性能测量。

## RC.6：实时颜色与圆角 {#live-paint}

**0.1.0-rc.6**增加 `backgroundColor` 和统一 `borderRadius` 绑定。升级后需要重新编译应用。

```ts
const target = motionValue(0)
const follower = springValue(target, { stiffness: 140, damping: 14 })
const release = bind(card, {
  backgroundColor: follower.to([0, 1], ['#8CB5FF', '#EFA26F']),
  borderRadius: follower.to([0, 1], [8, 70]),
})
set(target, 1)
```

保留的原生图使用预乘 alpha 的 OKLab 插值，输出裁剪到 sRGB，颜色进度限制在两端之间。最终颜色映射之前可以串联数值映射。半径不能为负；渲染器把可见圆角限制在视图尺寸内。更新标量目标会保留节点和绑定，无需逐帧 JavaScript 观察者或重新生成轨迹。

RC.6 基础版本有以下限制；[下方扩展](#extended-live-paint)扩大了支持范围。使用不含图片或渐变的纯色背景。半径要求统一的圆形圆角和兼容的统一边框，不支持 clip path、corner shape 或 CSS box shadow；阴影应使用独立表面。文字颜色、边框颜色/宽度及其他装饰仍不在此实时接口内。不兼容的目标会在替换现有绑定之前被拒绝。

直接写入样式会接管对应绘制通道并解除其绑定。更改背景图片、裁剪或边框结构会解除受影响的绘制绑定，其他通道继续。正常释放保留当前绘制值；旧 cleanup 不会覆盖新样式或动画。暂停、作用域挂起、后台、卸载/重新加载和减少动态效果遵循现有生命周期。组件结束时释放绑定并销毁 follower。

<Clip name="live-paint-ios" caption="iOS 模拟器，英文界面：真实点击改变颜色和半径，中断弹簧并暂停/继续。原生播放，不代表实体设备性能。" />
<Clip name="live-paint-android" caption="Android 模拟器，英文界面：通过 ADB 真实点击改变并暂停颜色/圆角弹簧，保持录制原速。" />

[原生验证与复现](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-capabilities.md).

## 扩展的保留式绘制（尚未发布） {#extended-live-paint}

下一版本扩展上述 RC.6 基础能力。必须重新编译原生应用，以包含更新后的原生类。

| 通道                                                                                               | 原生持续弹簧                                     | Web 绑定             |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------- |
| `backgroundColor`, `borderColor`                                                                   | 纯色背景；各边初始颜色一致                       | 支持                 |
| `color`                                                                                            | iOS 的普通 Label/Button；Android 的普通 TextBase | CSS 文本颜色         |
| `borderWidth`, `borderRadius`                                                                      | 统一 DIP 数值                                    | CSS 长度             |
| `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`                       | 独立非负 DIP 宽度                                | 独立 CSS 长度        |
| `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius` | 独立圆形 DIP 半径                                | 圆形/椭圆形 CSS 半径 |

```ts
const progress = motionValue(0)
const follower = springValue(progress, { stiffness: 180, damping: 24 })
const release = bind(card, {
  backgroundColor: follower.to([0, 1], ['#8CB5FF', '#EFA26F']),
  borderColor: follower.to([0, 1], ['#17332B', '#993C56']),
  color: follower.to([0, 1], ['#17332B', '#6B203F']),
  borderTopLeftRadius: follower.to([0, 1], [8, 64]),
  borderBottomRightRadius: follower.to([0, 1], [8, 64]),
  borderTopWidth: follower.to([0, 1], [3, 12]),
  scale: follower.to([0, 1], [1, 1.1]),
})
set(progress, 1)
// Component teardown: release(); follower.dispose()
```

本扩展的独立原生通道接受 `springValue()` 映射；不会为原生有限时长 `animate()` 增加独立边/角通道。边宽改变绘制，但不逐帧改变内容内边距。绘制仍在原生 UI 线程执行，无需应用逐帧 JavaScript 循环，也不保证独立于繁忙的 UI 线程。

使用纯色背景和圆形圆角。图片/渐变、clip path、squircle 圆角和格式化文本会被拒绝；实时几何需要独立的 CSS 阴影表面。iOS 与 Android 的目标类型差异仍明确保留。无效批次会在替换有效所有者前被拒绝。

一次 `bind()` 调用选择统一属性或独立边/角。后续统一属性接管整个属性组；后续独立通道解除已有统一绑定，让其他边保持当前值。独立边绑定可以并存。直接样式写入只接管自己的通道。其他边框变化在 Core 替换 drawable/layer 后重新应用保留式绘制，保持背景、半径与缩放。旧清理函数不会覆盖新绑定。暂停、挂起、卸载/重新加载和减少动态效果保持既有生命周期。

<Clip name="live-paint-extended-ios" caption="iPhone 17 Pro 模拟器，iOS 26.2，英文界面：真实 XCTest 点击改变背景、文本和边框颜色，独立圆角/边宽与缩放，并中断、暂停/继续弹簧。原速录制，不代表实体设备性能。" />
<Clip name="live-paint-extended-android" caption="Android 16 模拟器，英文界面：真实 ADB 点击执行相同的独立绘制变化、中断和暂停/继续。原生原速播放，不是实体设备录制。" />

[验证与复现](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/live-paint-346.md)。
