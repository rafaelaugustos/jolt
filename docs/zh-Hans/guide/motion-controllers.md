# 作用域与状态 {#motion-scopes-and-states}

使用 `motionScope()` 为页面、组件或回收项目提供其动画和订阅的一个所有者。使用 `motionStates()` 在命名的、可中断的视觉状态之间移动多个视图。两者都使用现有的原生动画驱动程序；两者都没有添加 JavaScript 帧循环。范围所有权不会改变执行：[`animateSize()`](./size) 等资源保留其记录的每帧 JS 布局成本。

<Clip name="motion-controllers-ios" caption="iOS 模拟器中的上传、错误、重试和成功状态、范围控制和卸载/重新安装。" />

## 拥有工作 {#owning-work}

```ts
import { motionScope, followKeyboard, zoomable } from '@rafaelaugusto/jolt'

const motion = motionScope()
motion.animate(icon, 'spin', { repeat: Infinity })
motion.press(button)
motion.use(() => followKeyboard(composer))
motion.use(() => zoomable(photo, { viewport }))

// At the actual destruction/unmount boundary:
motion.dispose()
```

范围有 `animate()`、`decay()`、`sequence()`、`press()`、`drag()` 和 `states()` 帮助程序。 `add(handle)`采用任何清理函数或暴露`stop()`或`dispose()`的对象；当两者都存在时，`dispose()` 优先。资源属于一个范围。该范围内的重复 `add()` 调用不会重复清理。具有 `finished` 承诺的动画句柄在解决时将从范围中释放。

处置是幂等的。它取消延迟和尚未加载的动画、预定的序列步骤、原生播放和注册的订阅。取消的动画句柄解析为 `false`。处置会停止拥有的句柄而不是调用 `stop(view)`，因此其他地方拥有的较新或不相关的动画可以生存。即使其中一个抛出异常，所有清理也会运行；它们的错误一起报告为 `AggregateError`。

仅拥有注册作品。以定时器为例，寄存器`motion.add(() => clearTimeout(timer))`。 Custom factories must clean up their own partial setup if they throw before returning a resource.

## 暂停、再利用和处置 {#suspension-reuse-and-disposal}

| 操作        | 行为                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `suspend()` | 使用 `pause()/play()` 暂停句柄，保留已暂停的句柄。分离 `use()` 订阅。取消不可播放的资源，包括序列。 |
| `resume()`  | 仅恢复由作用域暂停的播放并重新创建 `use()` 订阅。取消的序列不会重新启动。                           |
| `reset()`   | 处理所有当前工作，同时保留可重用范围。在为回收的单元分配新的项目标识之前调用，然后注册其新工作。    |
| `dispose()` | 永久终止所有权。开始或注册更多工作投掷。                                                            |

拖动控制器在作用域暂停时取消其接触/释放，并在恢复时接受新手势。参见 [拖动生命周期](./drag#ownership-and-lifecycle)。

`use(setup)` 返回幂等的移除函数。暂停期间注册的订阅会等待作用域恢复。显式调用 `suspend()` 后，辅助方法和 `add()` 拒绝新任务；如果只是应用处于后台，新任务会被接管并立即暂停。作用域暂停期间，请勿单独恢复其动画句柄。

原生 `unloaded` 事件不代表组件被永久销毁。正常移除视图仍会取消动画，重新加载时不会自动重启。例外是应用进入后台时根视图的临时卸载：作用域会在卸载前暂停播放，保留状态以便返回前台时继续。调用 `dispose()` 之前作用域仍可复用。对保留的页面使用 `suspend()/resume()`，在组件真正卸载时释放资源。`size` 表示受管资源数量，而非 GPU 分配。

## 应用后台与前台切换 {#app-background}

作用域自动响应 NativeScript 的应用暂停和恢复事件。返回前台时，受管播放从保留的位置继续，包括无限路径、交错动画、反向重复和多层组合。调用者已手动暂停的句柄保持暂停。手动作用域暂停和 Vue KeepAlive 暂停与应用后台状态分别处理：返回前台不会重新激活停用的组件。已停止、被 `reset()` 清除或已释放的动画不会重启。

后台暂停也遵循上表策略：`use()` 订阅会被移除并在恢复时重新创建；不支持播放控制的资源（包括 sequence）会被取消。当作用域不再拥有资源时，应用事件监听器会被移除。此行为适用于由 `motionScope()` 或 `useMotionScope()` 管理的任务；未纳入作用域的动画保留原有生命周期。

<Clip name="background-playback-ios" caption="iOS 26.2 模拟器：通过 Home 离开应用前后的原生 Vue 循环动画。轨道、交错、反向重复及双层组合继续播放；手动暂停的圆点保持静止。这是真实原生播放，并非物理设备录制。" />

<Clip name="background-playback-android" caption="Android 16 模拟器：同一原生 Vue 场景在 Home 返回后继续播放，未重新创建动画句柄。手动暂停的圆点保持静止。此录像不能证明物理设备性能。" />

[后台播放自动检查](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/background-playback.md)还覆盖 20 秒后台间隔、作用域暂停与恢复，以及停止后再次切换应用。

## Vue 生命周期 {#vue-lifecycle}

```ts
import { useMotionScope } from '@rafaelaugusto/jolt/vue'

// Inside setup(); create animations once template refs are available.
const motion = useMotionScope()
```

此帮助程序在 Vue 卸载时进行处理，在 KeepAlive 停用时暂停，并在激活时恢复。单独原生卸载不会处理它。核心范围无需 Vue 即可工作； Angular/React/Svelte/Solid 生命周期挂钩属于其适配器或应用程序代码。

## 命名视觉状态 {#named-visual-states}

```ts
const upload = motion.states(
  { icon, label, progress },
  {
    idle: {
      icon: { scale: 1, rotate: 0 },
      label: { opacity: 1 },
      progress: { scaleX: 0 },
    },
    sending: {
      icon: { scale: 0.8, rotate: 180 },
      label: { opacity: 0.4 },
      progress: { scaleX: 0.65 },
    },
    success: {
      icon: { scale: 1, rotate: 360 },
      label: { opacity: 1 },
      progress: { scaleX: 1 },
    },
  },
  { transition: 'snappy' },
)

const completed = await upload.to('sending')
if (completed) showSendingStatus()
```

或者直接构造`motionStates(targets, definitions, { scope, transition })`。目标和状态名称由 TypeScript 推断。创建控制器可验证定义而不移动视图；显式调用`to('idle')`进入初始状态。

状态包含绝对数字/颜色端点。它们不接受关键帧数组、路径、相对偏移或循环。过渡接受弹簧名称或有限补间/弹簧配置，包括延迟。 `to(name, transition)` 会覆盖该请求的控制器转换。单独使用`sequence()`进行定时编排。

### 每个目标的转换 {#a-transition-per-target}

转换可以按名称分隔目标，就像 `animate()` 选择名称属性一样。在此启动画面中，一个控制器将徽标弹出，在 250 毫秒后使用补间绘制笔划，并在最后淡出标题：

```ts
const splash = motionStates(
  { logo, stroke, title },
  {
    hidden: {
      logo: { opacity: 0, scale: 0.5 },
      stroke: { scaleX: 0 },
      title: { opacity: 0, y: 12 },
    },
    shown: {
      logo: { opacity: 1, scale: 1 },
      stroke: { scaleX: 1 },
      title: { opacity: 1, y: 0 },
    },
  },
)

splash.to('shown', {
  type: 'spring',
  bounce: 0.4,
  duration: 600,
  stroke: { duration: 650, ease: 'cubicOut', delay: 250 },
  title: { duration: 400, ease: 'easeOut', delay: 500 },
})
```

<Clip name="state-transitions-ios" caption="在 iOS 模拟器上，一个状态控制器弹出徽标，使用延迟补间绘制笔划，最后淡化标题。实时播放。" />

目标的过渡与主过渡合并，就像 [每个属性转换](./transitions#per-property) 一样：在补间中，它仅更改其设置的内容，在弹簧上，它替换曲线，并且保持主延迟，除非它设置自己的延迟。它也可以是弹簧的名字。仅命名目标的转换将为其他目标保留控制器的转换，并且控制器的 `transition` 选项也采用目标名称。转换期间附加的视图将其与其目标的转换连接起来。目标不能像转换选项一样命名（`delay`、`duration`、`ease`...）。返回的`Animation`、`current`、`settled`、`pause()`和`stop()`仍然覆盖了每个目标。

<Clip name="state-transitions-android" caption="Android 模拟器上有同样的飞溅。实时播放。" />

在新状态更改所有权之前，每个目标都会经过验证。替换轨道在旧手柄被取消之前开始，让原生引擎继承当前的呈现值和弹簧速度。旧转换拥有但在新状态中省略的属性在其可见值处停止；不相关的外部属性继续运行。如果属性应返回静态值，则在每个相关状态下定义该属性的端点。空状态会冻结之前的转换。每个目标名称必须标识一个不同的视图。

被取代、停止或处理的过渡解决 `false`，包括减少运动下的快速过渡。等待的回调仍然运行：在应用完成副作用之前检查布尔值。 `current` 是最新请求的状态； `settled` 是最后成功完成的状态，而不是视图的实时测量。 `stop()` 取消当前工作； `pause()/play()`控制它； `dispose()` 还可以防止将来的转换。作用域暂停会暂停拥有的状态控制器。重新定位已暂停的控制器会使替换控制器保持暂停状态。

Playground 的 **运动状态和范围** 示例提供了上传、取消、重试、成功/错误、暂停/恢复和卸载/重新安装控件。它的所有者是`useMotionScope()`；使用全局“减少运动”切换来进行即时过渡。原生生命周期探针记录在 [基准目录](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/motion-lifecycle.md) 中。

## 返回的视图 {#views-that-come-back}

`v-if` 内的视图，或者在紧凑版本和完整版本之间交换的布局，每次出现时都是一个新视图。就其本身而言，它从其模板值开始：淡入的徽标又变得不可见。相反，状态控制器可以比其视图更长寿。使用 `null` 启动目标并在视图出现和消失时附加视图：

```vue
<script setup lang="ts">
const stage = useMotionScope().states(
  { logo: null },
  {
    hidden: { logo: { opacity: 0, scale: 0.6 } },
    shown: { logo: { opacity: 1, scale: 1 } },
  },
)
onMounted(() => stage.to('shown'))
</script>

<template>
  <Label v-if="compact" :ref="stage.ref('logo')" class="small" text="J" />
  <Label v-else :ref="stage.ref('logo')" text="J" />
</template>
```

`attach(target, view)` 将目标指向新视图，或者使用 `null` 将目标指向无视图。状态稳定后到达的视图通过 [`set()`](./interrupting#setting-values-without-animating) 立即获取该状态的值，没有动画。在过渡期间到达的一个会以相同的时间从其所在位置加入。 `ref(target)` 为模板引用的每个目标返回一个稳定的回调：Vue 在挂载时使用元素调用它，在卸载时使用 `null` 调用它。在模板中创建的函数将在每次渲染时再次调用。

`to()` 会跳过空目标，并在视图到达时记住该目标。它的定义仍然是预先验证的。在转换期间卸载的视图会取消其部分，以便转换解析 `false`。

<Clip name="recreated-views-ios" caption="在 iOS 模拟器上，切换布局会重新创建两个徽标。附加到状态的那​​个会回来显示，或者在隐藏徽标后隐藏；只有入口的人回来时是隐形的。实时播放。" />
