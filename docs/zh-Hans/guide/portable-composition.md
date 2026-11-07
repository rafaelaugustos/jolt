# 跨平台组合

这些是下一版本的候选 API，对应 #424–#427、#386 和 #385。新增 Web 能力**尚未包含在已发布的 RC.12 中**。原生实现已存在；现在为共用定义、策略和生命周期增加浏览器适配器。包含这些能力的版本发布前，请使用对应 PR 的 tarball。

## 保留资源的生命周期 {#lifecycle}

`retain(resource)` 与 `resource(factory)` 将资源保留至 release、reset 或销毁，包括已经结束的播放对象。`release(resource)` 只销毁该 scope 拥有的资源。挂起会暂停支持暂停的资源，并保留之前的手动暂停状态；静态保留资源不会因此销毁。`add()` 保持原有临时生命周期；对同一 scope 已保留的资源重复调用是幂等的。不能将临时资源改为保留资源，应在接管时确定生命周期。接管失败时，factory 会清理新建资源。

Vue 的 `useShape` 使用现有 SVG 适配器。挂载后可读取 `.current`；回调 ref 也支持只有一个 HTMLElement 根节点的组件。KeepAlive 暂停并保留绘图；真正卸载或替换 ref 时销毁。可选 `{ runtime }` 是借用对象。`useWebMotion(ref).resource(setup)` 提供同样的保留生命周期；普通 `.use(setup)` 仍在激活时重建。`unload: 'pause'` 保留同一文档内暂时脱离 DOM 的 shape；普通 `motion.shape` 默认在移除时销毁。显式 release 或销毁 runtime 始终会销毁资源。

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const drawing = scope.resource(() =>
  motion.shape(host, {
    d: 'M10 50 L50 10 L90 50 Z',
    viewBox: [0, 0, 100, 100],
    stroke: '#7858db',
    unload: 'pause',
  }),
)
scope.suspend()
scope.resume()
scope.release(drawing)
scope.dispose()
```

```vue
<script setup lang="ts">
import { useShape } from '@rafaelaugusto/jolt/web/vue'
const drawing = useShape({
  d: 'M10 50 L50 10 L90 50 Z',
  viewBox: [0, 0, 100, 100],
  stroke: '#7858db',
})
</script>
<template><div :ref="drawing.ref" style="width: 120px; height: 120px" /></template>
```

<Clip name="composition-lifecycle-web" caption="保留资源的生命周期: macOS 上的 Chromium：真实控件交互和浏览器播放。" />

<Clip name="composition-resources-ios" caption="保留资源的生命周期: iOS 26.2 模拟器：真实原生演示及 XCTest 交互。" />

## 行为协调 {#behaviors}

原生和 Web 共用互斥执行策略：优先级、`when`、`blocks`、同优先级拒绝/替换以及显式静止动作。较高优先级会打断当前动作，除非当前动作明确阻止它；不同协调器彼此独立。每次执行拥有子 scope。异步工作应使用 `wait`、`checkpoint`、`guard`，防止取消后继续产生延迟修改。任意 Promise 无法被强制取消。后台和手动暂停会挂起播放；完成或 cancel 会恢复静止动作，`stop()` 取消但不恢复，销毁后不能再发起请求。业务状态仍由应用负责。

```ts
const actions = scope.motionBehaviors(
  {
    rest: { priority: -1, run: ({ scope }) => scope.animate(card, { x: 0 }).finished },
    touch: {
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: -70 }, { duration: 2000 }).finished)
      },
    },
    dress: { priority: 2, run: ({ scope }) => scope.animate(card, { x: 70 }).finished },
    eat: {
      priority: 3,
      blocks: ['touch', 'dress'],
      run: ({ scope }) => scope.animate(card, { scale: [1, 1.2, 1] }).finished,
    },
  },
  { rest: 'rest' },
)
actions.request('touch')
actions.request('dress')
```

<Clip name="composition-behaviors-web" caption="行为协调: macOS 上的 Chromium：真实控件交互和浏览器播放。" />

<Clip name="composition-behaviors-ios" caption="行为协调: iOS 26.2 模拟器：真实原生演示及 XCTest 交互。" />

## 渐变文字 {#gradient-text}

两端支持 2–8 个颜色、0..1 内有序 stops、从左向右方向起算的顺时针角度，以及 (0,1] 内的高光宽度。原生接受 ColorValue，Web 接受 CSS 颜色字符串。`play()` 返回可打断、暂停和取消的播放对象；`stop()` 去掉移动高光，保留静态渐变。减少动态效果时也保留静态填充。

浏览器使用 CSS 背景裁剪绘制原始、可选择的文字；仅支持不包含子元素的纯文本 HTMLElement。无障碍名称不变，清理只恢复自身样式，不覆盖应用之后的修改。强制颜色模式或不支持裁剪时，使用普通可读文字并取消装饰性高光。请勿在同一目标上同时使用背景渐变和文字渐变。原生绘制真实字形；浏览器的裁剪、重绘开销和像素结果存在差异。

```ts
const title = scope.gradientText(heading, {
  colors: ['#7858db', '#197a88'],
  angle: 10,
  sheen: { color: '#ffffffbf', width: 0.3, direction: 'right' },
})
const playback = title.play({ duration: 1800, ease: 'linear' })
title.suspend()
title.resume()
title.stop()
```

<Clip name="composition-text-web" caption="渐变文字: macOS 上的 Chromium：真实控件交互和浏览器播放。" />

<Clip name="composition-text-ios" caption="渐变文字: iOS 26.2 模拟器：真实原生演示及 XCTest 交互。" />

## 关节式 2D 角色 {#rig}

共用定义支持 1–64 个部件及 `x`、`y`、`scaleX`、`scaleY`、`rotate`。旋转单位为度，平移为原生 DIP 或浏览器 CSS 像素。枢轴使用边框盒尺寸的比例。挂点可使用相对比例或本地逻辑单位（Web 仍保留原生名称 `dip`）。混合相对于静止姿态；权重总和大于一时归一化。无限制旋转取最短路径；旋转限制会约束弹簧所有采样，包括过冲。

Web 部件必须是已连接的 2D 盒子，遵循声明的直接 DOM 父子关系，且定位父元素必须是 `offsetParent`。不支持 CSS zoom、透视、3D 或独立 transform 属性。配件必须是挂点部件的无其他所有者的直接子元素。原生或 DOM 父级变换会带动配件。`point()` 返回根部件父级边框盒坐标；改变布局偏移后应调用 `refresh()`。尺寸变化会更新挂点。`attach` 可替换部件；Web 姿态共用一个播放组，因此释放一个部件会取消该组。清理只恢复仍由 rig 拥有的通道。有意义的图形应保留语义标签；rig 不提供命中测试或无障碍语义。

```ts
const character = scope.rig2d(
  {
    parts: {
      body: { rest: { rotate: 0 } },
      hand: {
        parent: 'body',
        pivot: { x: 0.5, y: 0.1 },
        rest: { rotate: 0 },
        rotation: [-70, 70],
      },
    },
    poses: {
      rest: {},
      wave: { hand: { rotate: -55 } },
      reach: { hand: { rotate: 110 } },
    },
    sockets: { grip: { part: 'hand', x: 0.5, y: 0.85, units: 'relative' } },
  },
  { body, hand },
)
character.accessory('grip', flower)
character.to('wave', 'bouncy')
character.blend([
  { pose: 'wave', weight: 0.5 },
  { pose: 'reach', weight: 0.5 },
])
```

<Clip name="composition-rig-web" caption="关节式 2D 角色: macOS 上的 Chromium：真实控件交互和浏览器播放。" />

<Clip name="composition-rig-ios" caption="关节式 2D 角色: iOS 26.2 模拟器：真实原生演示及 XCTest 交互。" />

## 辅助函数与动态效果偏好 {#preferences}

Web 入口重新导出已有 `cubicBezier`、`origamiSpring`、`springs`、`presets`，使用同一个求解器。`motion.reducedMotion()` 读取当前文档/runtime 的有效偏好，包含 `user`、`always`、`never` 配置。`onReducedMotion()` 订阅变化，不轮询、不立即触发初始回调，并返回取消订阅函数。销毁 runtime 会终止观察。

Vue 的 `useReducedMotion(runtime?)` 返回只读 ref。不传 runtime 时，SSR 初值为 false，挂载后开始订阅；传入借用 runtime 时读取它的偏好。KeepAlive 停用时取消订阅，激活时重新同步。只销毁自己创建的 runtime。不存在跨请求的偏好单例。如果应用配置可能覆盖系统偏好，应使用 runtime 观察器。

```ts
import { cubicBezier, origamiSpring, springs, presets } from '@rafaelaugusto/jolt/web'
const current = motion.reducedMotion()
const unsubscribe = motion.onReducedMotion((reduced) => updatePreference(reduced))
scope.retain(unsubscribe)
scope.animate(
  card,
  { x: [0, 70, 0] },
  { duration: 1200, ease: cubicBezier(0.25, 0.1, 0.25, 1) },
)
// Vue: import { useReducedMotion } from '@rafaelaugusto/jolt/web/vue'
// const reduced = useReducedMotion(motion)
```

<Clip name="composition-preferences-web" caption="辅助函数与动态效果偏好: macOS 上的 Chromium：真实控件交互和浏览器播放。" />

<Clip name="composition-text-ios" caption="辅助函数与动态效果偏好: iOS 26.2 模拟器：真实原生演示及 XCTest 交互。" />

## 向量传感器 {#sensors}

接受全部六个标准名称。`rotation` 提供相对弧度及四元数；`acceleration` 是含重力的固有加速度（m/s²，屏幕朝上时 Z 约为 +9.8）；`linearAcceleration` 不含重力（m/s²）；`gravity` 指向下方，等于线性加速度减去固有加速度；`gyroscope` 使用右手规则的 rad/s，由 beta/gamma/alpha 映射。`magneticField` 保留 µT 单位，但返回 `unavailable`、backend `none`、reason `unsupported-kind`。DeviceMotion 不提供磁场向量，也不会从方向数据推算。

需要安全上下文、浏览器/设备支持及允许的权限策略。仅由用户操作直接调用 `requestPermission()` 时请求权限。可用性要求该类型的完整有限采样；缺失或部分值不会转换为零。API 缺失、拒绝权限和无数据超时可从 `snapshot()` 获取。每个文档的同一硬件事件共用一个监听器，仅在有需求、可见且未暂停时采集。界面坐标随屏幕旋转重新映射；设备坐标保持标准方向。`interval` 限制交付频率（5–1000 ms 或 `auto`），不是硬件采样率。时间戳是浏览器单调时间，不是原生硬件时间。

本轮验证了**注入事件**驱动的真实浏览器渲染，以及原生模拟器预览。物理设备上浏览器真实传感器交付和精度仍在 #385 中待验证。参考 [Device Orientation and Motion 规范](https://www.w3.org/TR/orientation-event/) 和 [Magnetometer 可用性限制](https://www.w3.org/TR/magnetometer/)。

```ts
const sensor = scope.sensor('gyroscope', { coordinates: 'interface', interval: 50 })
// Invoke directly from a click/tap handler:
await sensor.requestPermission()
scope.bind(card, { rotate: scope.map(sensor.z, [-Math.PI, Math.PI], [-45, 45]) })
console.log(sensor.snapshot())
```

<Clip name="composition-sensors-web" caption="macOS 上的 Chromium：明确注入的 DeviceMotion 事件、暂停/继续和磁场不可用状态；不代表物理传感器测量。" />

<Clip name="composition-sensors-ios" caption="iOS 26.2 模拟器：原生向量预览和生命周期控件；预览数据不能证明物理传感器可用。" />

录像是功能性证据，不能证明 CPU/PSS 降低、硬件精度或独立于 JavaScript 的渲染。[原生契约](./native-composition) 仍受支持；[验证与复现报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/portable-composition.md) 记录验收结果与待验证限制。
