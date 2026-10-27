# 粒子与彩纸 {#particles-and-confetti}

## 五彩纸屑 {#confetti}

<Clip name="particles" caption="原始的 iOS 五彩纸屑演示，从一个点发出。" />

```ts
import { confetti } from '@rafaelaugusto/jolt'

const stopConfetti = confetti(button, {
  count: 80,
  colors: ['#facc15', '#ef4444', '#3b82f6'],
})
```

五彩纸屑从目标中心向上爆发，然后在重力作用下落下。它在目标的窗口中渲染，因此按钮的圆角和父级剪切不会将其切断。它不添加交互式视图，并且目标的外观、蒙版和命中测试保持不变。

当突发开始时，在窗口坐标中捕获原点。之后移动或滚动按钮不会移动已经飞行的粒子。新的突发捕获新的位置，包括滚动和变换。 `count` 是一个近似的发射计数，而不是可见粒子的确切数量的承诺：剪裁、原生调度和生命周期会影响可见性。默认为 `80`，具有五种颜色的调色板。不同平台之间的随机轨迹可能有所不同。

发射持续 200 毫秒，粒子存活时间为 2200 毫秒。过期后该层将自动删除。立即致电 `stopConfetti()` 将其删除。

## 连续发射器 {#continuous-emitters}

`particles()` 在目标内容上方附加一个发射器：iOS 上的一个图层，Android 上 `ViewOverlay` 中的一个可绘制对象。它遵循目标的变换和滚动位置，并调整新粒子的源大小，而无需重新启动现有粒子。 Android 将可绘制对象剪辑到目标边界并统一 `borderRadius`； iOS 遵循主机层的剪辑。当粒子应覆盖场景而不是单个控件时，请使用布局作为目标。

五彩纸屑使用窗口的顶层/覆盖层，因此它可以跨越按钮及其父布局。它仍然受该窗口限制，位于单独的系统窗口下方。后端都没有添加触摸目标或辅助功能元素；效果下方的控件仍然可用。

```ts
import { particles } from '@rafaelaugusto/jolt'

const stopSnow = particles(scene, {
  source: 'top',
  angle: 90,
  rate: 30,
  velocity: 45,
  velocityRange: 15,
  spread: 30,
  size: 5,
  lifetime: 5000,
})

// Remove the emitter and its particles:
stopSnow()
```

火花从中心向各个方向发射：

```ts
particles(scene, {
  colors: ['#facc15', '#fb923c'],
  velocity: 120,
  velocityRange: 50,
  spread: 360,
  rate: 70,
  size: 3,
  lifetime: 1000,
})
```

气泡从底部升起：

```ts
particles(scene, {
  shape: 'ring',
  source: 'bottom',
  colors: ['#67e8f9', '#a5f3fc'],
  velocity: 40,
  spread: 20,
  rate: 14,
  size: 18,
  lifetime: 5000,
})
```

添加 `duration` 以在有限毫秒数后停止发射。现有粒子在原生资源被删除之前就完成了它们的生命周期：

```ts
particles(scene, {
  shape: 'rectangle',
  colors: ['#facc15', '#fb923c'],
  rate: 90,
  duration: 700,
  lifetime: 1400,
  velocity: 100,
  gravity: 130,
  spinRange: 240,
})
```

截止值在两个平台上都是原生的。 iOS 使用 Core Animation 和最终的 JS 清理计时器。 Android 使用单调原生时钟和原生清理；阻塞其 UI 线程会延迟绘制和回调传递，但不会延长发射/生命周期。返回时，它会跳过已经过期的出生并删除已完成的效果。通过后台取消的效果永远不会积累积压。

<Clip name="particles-android" caption="Android 16 / API 36 模拟器：真实的敲击雪、圆环和窗户五彩纸屑；火花、有限矩形、调整大小和减少运动。实时原生 UI 线程绘制，当该线程繁忙时可能会停止。" />

| 选项                         | 默认          | 含义                                                               |
| ---------------------------- | ------------- | ------------------------------------------------------------------ |
| `colors`                     | `['#ffffff']` | NativeScript 颜色字符串，按发射率平均共享。                        |
| `shape`                      | `'circle'`    | `'circle'`、`'rectangle'` 或 `'ring'`。                            |
| `source`                     | `'center'`    | 中心点，或穿过 `'top'` 或 `'bottom'` 的线。                        |
| `rate`                       | `20`          | 所有颜色的每秒粒子总数。                                           |
| `lifetime`                   | `3000`        | 每个粒子存在的毫秒数。                                             |
| `size`                       | `6`           | DIPs 中的最长边。                                                  |
| `velocity` / `velocityRange` | `60` / `0`    | 初始速度和原生随机变化，以每秒 DIPs 为单位。                       |
| `angle` / `spread`           | `-90` / `30`  | 方向和发射锥度（以度为单位）。右边是`0`，下面是`90`，上面是`-90`。 |
| `gravity`                    | `0`           | 向下加速度，单位为 DIPs 每平方秒；负值加速向上。                   |
| `spin` / `spinRange`         | `0` / `0`     | 旋转和本地随机变化，以每秒度数为单位。                             |
| `fadeOut`                    | `true`        | 粒子在其生命周期内褪色。                                           |
| `duration`                   | 省略          | 发射毫秒数；省略表示连续。                                         |

值必须是有限的。限制为 1–32 种颜色、1–128 DIP 大小、1–60000 毫秒寿命、每秒 0–10000 个粒子，估计活体数量 (`rate × lifetime / 1000`) 最多为 10000。速度及其变化为 0–10000，重力为 −10000–10000，角度为 −360–360，散布为0-360，自旋为-3600-3600，其变化范围为0-3600。有限持续时间必须为正数，并在 32 位定时器内为生命周期加上 50 ms 留出空间。五彩纸屑接受 0 到 10000 之间的整数计数。零计数或比率会删除先前的匹配效果，而不会启动另一个匹配效果。

## 清理和兼容性 {#cleanup-and-compatibility}

这两个函数都接受一个视图或一个持有一个的引用，并返回一个幂等清理函数。一次五彩纸屑爆炸和一个粒子发射器可能会共存于视图中。启动另一个同类的项目会取代前一个项目；旧的清理函数无法删除其替代函数。 `stop(view)`控制`animate()`轨道；将返回的函数用于粒子。

加载之前进行的调用等待窗口和非零布局；它们的发射时钟仅在连接时启动。卸载、更改原生视图/窗口、分离原生 Android 目标或将活动目标大小调整为零可消除该影响。应用程序后台显式取消这两种效果。它们不会在重新加载或前台时自动重播。保留清理函数并在组件被处置时调用它。

使用现有的运动范围来进行清理：

```ts
const scope = motionScope() // useMotionScope() in Vue
const remove = scope.use(() => particles(scene, { source: 'top', angle: 90 }))
// remove() or scope.dispose() removes the emitter immediately.
```

`scope.use()` 是一个订阅工厂：暂停会消除其影响，并且显式作用域恢复会调用该工厂来创建一个新的工厂。它不会恢复旧的粒子。在 Vue 中，在挂载 ref 后创建它，并让 `useMotionScope()` 在卸载时处理它。

## 平台和时机 {#platforms-and-timing}

| 能力                                                   | iOS                  | Android                      |
| ------------------------------------------------------ | -------------------- | ---------------------------- |
| 圆形、矩形、环形；中心/顶部/底部来源                   | 原生`CAEmitterLayer` | 原生Java模拟和`Canvas`可绘制 |
| 连续、有限和五彩纸屑发射                               | 支持                 | 支持                         |
| 颜色/alpha、大小、速度/范围、重力、旋转/范围、淡入淡出 | 支持                 | 支持                         |
| 窗口五彩纸屑和触摸传递                                 | 支持                 | 支持                         |
| 每帧JS模拟或绘制回调                                   | 无                   | 无                           |
| 后台/卸载清理，实时减少运动变化                        | 取消；没有自动重播   | 取消；没有自动重播           |

Android 后端与 Jolt 捆绑在一起，使用平台 API，并且不添加可选插件、第三方依赖项或权限。升级后重新构建Android应用程序；仅 JS 更新无法安装 Java 类或其桥元数据。现有的 NativeScript 要求保持不变。

减少运动跳过效果；当效果运行时通过 `configure()` 启用它会删除它。 Android 还可以本地观看平台动画师比例：**即使使用 `reducedMotion: 'never'`，比例 0 也会取消/跳过效果**。正比例如 **0.5 和 2 将粒子持续时间和物理单位保留在墙时间中**，如 `timeScale`，不会重新计时此效果。设置更改不能留下无限的有限发射器。恢复运动需要重新呼叫。

Android 为每个发射器预分配最多 10,000 个粒子槽，重用数组和绘制/路径资源。连续发射器分配`ceil(rate × lifetime / 1000)`插槽；有限发射器仅需要较小的发射/寿命窗口。一个槽使用 36 字节的原始状态（极限约为 352 KiB），加上小型固定原生对象和诊断缓冲区。动画循环不会为每个粒子/帧创建 JS 回调或 Java 对象。清理释放数组、可绘制对象、帧/截止日期回调和设置观察者。

这是原生 **UI 线程** 绘图。在物理华硕 API 26 上，普通降雪（每秒 30 次降雪，测量的四秒内峰值 121 次）的 p95 回调间隔为 16.73 毫秒； 10,000 个粒子应力情况下达到 167.05 ms。 API 36 仿真器测得的时间分别为 16.67 ms 和 33.33 ms。这些是观察到的 Choreographer 间隔，而不是 GPU/演示保证或设备排名。保持互动场景的人口适度； 10,000 上限存储。确切的环境、CPU 绘制成本、容差和原始结果位于 [验证报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/particles.md) 中。

<Clip name="particles-android-device" caption="物理 ASUS_Z017DC、Android 8 / API 26：通过主动效果、连续和有限发射、调整大小和减少运动进行真实点击。原生UI线程实时播放；压力测量与这个普通演示是分开的。" />

<Clip name="particles-ios" caption="iPhone 17 模拟器，iOS 26：不变的粒子 API，所有形状/源模式，触摸传递，调整大小和实时减少运动，使用 XCTest 轻按进行练习。上面保留了现有的 iOS 镜头。" />
