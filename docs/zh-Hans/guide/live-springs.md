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

将结果绑定到 `x`、`y`、`scale`、`scaleX`、`scaleY`、`rotate`、`rotateX`、`rotateY` 或 `opacity`。此实时路径尚不支持颜色、装饰和复合原生适配器。 spring 值是只读的：更新其源，而不是将 follower 传递给 `animate()` 或 `set()`。

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
