# 原生场景与资源生命周期

这些 API 已包含在 `0.1.0-rc.11.1` 中。请安装对应版本并重新构建原生应用；Android 渐变文字需要新增的编译辅助类。

这些 API 用于组合 iOS 和 Android 原生动效：保留绘图、行为优先级、关节部件、渐变文字和时间轴命名效果。本次提供的是原生入口，并未新增对应的 Web 契约。业务规则、素材和 SDK 对象仍由应用管理。基础用法见[作用域与视觉状态](./motion-controllers)。

## 保留资源，暂停其动画 {#resources}

`scope.resource(factory)` 创建并保留资源；`scope.retain(resource)` 接管已有资源。即使动画结束，资源仍归该作用域所有，直到 `release(resource)`、`reset()` 或 `dispose()`。两者接受清理函数或具有 `dispose()` / `stop()` 的对象。一个资源不能同时属于两个作用域。重复保留同一个对象不会重复清理；再次调用工厂会创建另一个资源。

| 资源                    | 挂起行为                                 | 最终销毁                          |
| ----------------------- | ---------------------------------------- | --------------------------------- |
| 保留的 Shape 或渐变文字 | 保留绘图，暂停正在播放的动画             | 移除原生绘制资源和监听器          |
| 保留的可播放控制器      | 调用 `pause()`，仅恢复由作用域暂停的动画 | 调用 `dispose()` 或 `stop()`      |
| 保留的原生属性          | 保留适配器，不暂停未接管的动画或绑定     | 销毁适配器，不销毁应用的 SDK 对象 |
| `scope.add(animation)`  | 暂停可播放任务，完成后自动释放句柄引用   | 停止剩余任务                      |
| `scope.use(factory)`    | 移除订阅，恢复时重新创建                 | 移除订阅                          |

如果资源同时提供 `suspend()/resume()`，保留策略优先使用它们，否则使用 `pause()/play()`。没有这两对方法的静态资源会继续保留。手动暂停状态不会因应用进入后台再返回而消失。现有 `add()` 和 `use()` 契约保持不变；对已采用另一种生命周期策略接管的对象调用 retain 会报错。

`useShape()` 将回调 ref 的生命周期绑定到 Vue 的实际卸载。重复 ref 不会产生重复资源；替换视图会释放旧绘图。KeepAlive 停用时暂停播放。该辅助函数默认使用 `unload: 'pause'`；命令式 `shape()` 仍默认使用 `unload: 'stop'`，除非显式修改。绘图可以在暂停期间保持可见。

对于原生属性，应保留适配器、接管动画，并单独注册绑定。第二个示例要求已声明并初始化的 SceneKit shader uniform；该适配器仅适用于 iOS。源 motion value 和 SDK 对象仍由应用所有。在销毁原生目标前先销毁作用域。

```vue
<script setup lang="ts">
import { useShape } from '@rafaelaugusto/jolt/vue'

const drawing = useShape({
  d: 'M10 50 L50 10 L90 50',
  viewBox: [0, 0, 100, 100],
  stroke: '#8B5CF6',
  strokeWidth: 3,
})
function replay() {
  drawing.current?.animate({ strokeEnd: [0, 1] }, { duration: 900 })
}
</script>

<template>
  <GridLayout :ref="drawing.ref" width="160" height="160" @tap="replay" />
</template>
```

```ts
import { motionScope } from '@rafaelaugusto/jolt'
import { sceneKitUniform } from '@rafaelaugusto/jolt/native'

const scope = motionScope()
const focus = scope.resource(() =>
  sceneKitUniform(material, 'focus', {
    type: 'float',
    range: [0, 1],
    units: ['fraction'],
    motion: 'appearance',
  }),
)
scope.add(focus.animate(1, { duration: 800 }))
// For a binding instead: scope.use(() => focus.bind(applicationOwnedValue, p => p))
// Dispose the scope before destroying the application's native target.
```

<Clip name="native-resources-ios" caption="iOS 26.2 模拟器：暂停、恢复、Vue KeepAlive 缓存及实际卸载和重建。计数器区分资源生命周期与动画播放。" />
<Clip name="native-resources-android" caption="ASUS ZenFone 3 真机，Android 8：绘图在暂停时保持不变，经过缓存后保留，并在实际卸载时销毁。真实 ADB 点击，不是性能测量。" />

## 优先级与中断 {#behaviors}

`motionBehaviors()` 协调一条独占交互通道。更高优先级会中断当前行为；相同优先级默认被拒绝，除非新行为声明 `equal: 'replace'`。`blocks` 可按名称阻止请求，不受优先级影响；`when` 在所有权变化前检查应用条件。不同协调器相互独立。

每次执行都有私有作用域。中断时先销毁旧作用域，再启动替代行为，使原生过渡从当前呈现状态开始。`wait()` 在等待完成后检查执行身份，并在手动暂停或后台期间阻止继续执行。每个异步步骤都应使用它；外部 await 后使用 `checkpoint()`，可能迟到的回调使用 `guard(callback)`。这些辅助函数无法撤销任意应用状态修改，也不能自动终止外部服务请求。

结果为 `completed`、`interrupted`、`cancelled`、`failed` 或 `blocked`。`cancel()` 恢复声明的静止行为；`stop()` 取消但不恢复；`dispose()` 阻止后续执行。完成、取消或失败后重新启动静止行为；被中断的动作不会自动续播。`pause()/play()` 控制暂停。条件函数可能同步抛错；执行错误会出现在结果及可选的 `onError` 中。将控制器保留在作用域中，可绑定组件生命周期。

```ts
import { motionBehaviors } from '@rafaelaugusto/jolt'

const behavior = motionBehaviors(
  {
    rest: {
      priority: -1,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: 0, rotate: 0 }, 'smooth'))
      },
    },
    touch: {
      priority: 1,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { rotate: -15 }, { duration: 900 }))
      },
    },
    dress: {
      priority: 2,
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { x: 60 }, { duration: 900 }))
      },
    },
    eat: {
      priority: 3,
      blocks: ['touch', 'dress'],
      run: async ({ scope, wait }) => {
        await wait(scope.animate(card, { rotate: 15 }, { duration: 900 }))
      },
    },
  },
  { rest: 'rest' },
)

const run = behavior.request('touch')
behavior.request('dress')
const result = await run.finished // { status: 'interrupted' }
```

<Clip name="native-behaviors-ios" caption="iOS 模拟器：换装中断抚摸，进食阻止换装，完成后回到静止状态。同一协调器也驱动普通界面确认效果。" />
<Clip name="native-behaviors-android" caption="Android 真机：真实点击按优先级中断和阻止动作，随后恢复静止状态。行为名称由应用定义。" />

## 关节部件与挂接点 {#rig}

从可选 `/rig` 入口导入 `rig2d`。应用必须提供与声明一致的原生直接父子视图层级；Jolt 不会重新设置父节点。定义包含部件、姿势和 socket，不包含素材或框架 ref。最多接受 64 个部件；这是验证上限，不是任意设备上的性能保证。

变换包括以 DIP 为单位的 `x/y`、以度为单位的 `rotate`，以及倍数形式的 `scaleX/scaleY`。枢轴采用原生部件尺寸的比例。Socket 默认使用局部 DIP，设置 `units: 'relative'` 后使用尺寸比例；附件必须是对应部件的直接子节点。父节点的原生变换带动附件，无需逐帧 JavaScript 观察。`point(name)` 按需采样相对于根部件父节点的坐标，要求祖先完成布局；它不是实时绑定。仅支持二维变换，不包含透视、倾斜、网格变形或 IK。

非负权重混合各通道相对于静止值的偏移。未声明的通道使用静止值；权重和大于一时按通道归一化。无限制旋转使用最短角度偏移；有限制旋转会约束全部采样值，包括 spring 过冲。仅接管静止值或姿势中声明的通道。新混合从当前呈现状态开始。

`attach()` 在替换部件前验证所有权和层级。`accessory(name, null)` 解除附件挂接。销毁时仅恢复仍归 rig 所有的变换，不会取消较新的外部所有者。`pause()/play()/stop()/dispose()` 控制生命周期；手动暂停后须先恢复再请求姿势。同一 API 也适用于普通关节插画。

```ts
import { rig2d } from '@rafaelaugusto/jolt/rig'

const rig = rig2d(
  {
    parts: {
      body: { rest: { rotate: 0 } },
      hand: { parent: 'body', pivot: { x: 0.5, y: 0.1 }, rotation: [-70, 70] },
    },
    poses: {
      rest: {},
      wave: { hand: { rotate: -55 } },
      reach: { body: { rotate: 12 }, hand: { rotate: 110 } },
    },
    sockets: { grip: { part: 'hand', x: 0.5, y: 0.85, units: 'relative' } },
  },
  { body, hand },
)
rig.accessory('grip', flower)
rig.to('wave', 'smooth')
rig.blend([
  { pose: 'wave', weight: 0.3 },
  { pose: 'reach', weight: 0.7 },
])
```

<Clip name="native-rig-ios" caption="iOS 模拟器：三种姿势、中断混合、手部花朵附件与旋转限制。台灯使用同一关节部件 API。" />
<Clip name="native-rig-android" caption="Android 真机：快速切换姿势时，原生父节点变换带动花朵，伸手姿势受旋转上限约束。无需逐帧 JavaScript 更新 socket。" />

## 渐变字形与移动高光 {#text}

`gradientText(label, options)` 保留原生 Label 及其无障碍文本。装饰性绘制不会添加第二个文本节点，也不会拦截输入。支持 2–8 个颜色、0–1 内有序的 stops、顺时针渐变角度，以及高光颜色和宽度。宽度为 (0, 1] 内的比例。`sheen.direction` 默认为 `right`；使用 `left` 可让高光从右向左经过。Android 必须重新构建以安装原生辅助类，仅更新 JavaScript 不够。

`play()` 返回支持 seek 的原生播放句柄；过渡的 repeats/reverse 控制重复经过。`stop()` 移除移动高光并保留静态渐变。`suspend()/resume()` 保留正在播放的进度。`dispose()` 移除绘制层，并在应用尚未替换颜色时恢复原始文本颜色。减少动态效果会抑制移动高光，同时保留可读的填充。

文本、字体、布局和对齐变化会使字形缓存失效。多行和 RTL 排版遵循原生 Label；emoji 会呈现渐变轮廓，而不会保留原本颜色。不支持富文本 span：初始 `formattedText` 会被拒绝，后续切换到它会释放效果绘制资源。外部原生样式修改后可用 `refresh()` 请求刷新。

遮罩预算为 4,194,304 像素：Android 使用 alpha 位图；iOS 限制栅格化比例并拒绝过大表面。`snapshot().maskBytes` 估算字形遮罩内存，不代表全部 GPU 内存或进程 PSS。布局检查会复用未变化的遮罩；移动高光不会逐帧重建字形。

```ts
import { gradientText, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const title = scope.resource(() =>
  gradientText(label, {
    colors: ['#7C3AED', '#DB2777', '#F59E0B'],
    angle: 0,
    sheen: { color: '#FFFFFFFF', width: 0.35 },
  }),
)
const light = title.play({ duration: 1800, ease: 'easeInOut' })
light.pause()
light.play()
```

<Clip name="native-text-ios" caption="iOS 模拟器：渐变字形、移动高光、拉丁文与阿拉伯文切换、暂停及减少动态效果。原始 Label 保留无障碍文本。" />
<Clip name="native-text-android" caption="Android 8 真机：高光被裁剪到字形并可原位暂停，减少动态效果保留静态渐变。这与占位符 shimmer 是不同效果。" />

## 时间轴上的命名效果 {#cues}

`withTimelineCues(playback, cues, options)` 包装现有 Jolt 时钟。每个 cue 包含唯一名称、逻辑毫秒位置，以及返回受管理句柄或清理函数的效果回调。同一位置的多个效果按声明顺序执行。音频可返回应用适配器的 stop/dispose 句柄；此 API 不提供音频引擎。

回调在标记边界通过 JavaScript 执行，并使用原生播放时钟，不做逐帧轮询。JavaScript 被阻塞时回调无法执行。默认 `late: 'skip'` 会丢弃超过 50 逻辑毫秒的迟到事件；可显式设置 `tolerance` 或 `late: 'catch-up'`。`lateBy` 表示相对于时钟的交付延迟，不是显示、音频或触觉启动延迟。`configure({ timeScale })` 使标记与视觉时钟一起缩放。减少动态效果会抑制 cues。

暂停会保留待执行标记并暂停可播放效果，包括视觉动画结束后仍继续的效果。Stop/dispose 会一起取消视觉动画、待执行标记和活动效果。完成状态会等待返回效果的有限 promise；适配器必须在停止时结束其 promise。Seek 不触发跨过的标记，会取消活动效果，向后定位后重新启用未来标记。

`repeat: { every, count, reverse }` 显式声明有限次数的经过，不会从视觉轨道的重复设置推断。上限为 1,024 个命名 cue、每个 cue 1,024 次经过，以及总计 4,096 次事件。效果错误交给可选 `onError`，不会终止视觉播放。

```ts
import { animate, motionScope, withTimelineCues } from '@rafaelaugusto/jolt'

const scope = motionScope()
const scene = scope.add(
  withTimelineCues(
    animate(ball, { x: [-100, 100] }, { duration: 2400, ease: 'linear' }),
    [
      {
        name: 'impact',
        at: 1200,
        effect: () =>
          animate(
            star,
            { scale: [0.2, 1.6], opacity: [1, 0] },
            { duration: 650, haptic: { style: 'light', times: [0.001] } },
          ),
      },
    ],
  ),
)
scene.pause()
scene.play()
scene.dispose()
```

<Clip name="native-cues-ios" caption="iOS 模拟器：在冲击前取消，重播粒子与高光 cue，再在标记前暂停恢复。模拟器无法证明真实触觉输出。" />
<Clip name="native-cues-android" caption="Android 真机：取消会阻止待执行冲击，暂停和恢复保持视觉时钟关联。视频无法传达或测量振动启动时间。" />

## 验证与限制 {#validation}

录制展示了 ASUS ZenFone 3 真机（Android 8）和 iPhone 17 Pro 模拟器（iOS 26.2）上的真实原生交互。这是功能证据，不是 CPU/PSS 对比。复现方式、重复生命周期检查和时钟测量见[验证报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/native-composition.md)。原生执行不会消除 NativeScript 主线程竞争；这些 API 没有引入通用 RenderThread 后端。
