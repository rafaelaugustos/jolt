# 指针、属性组与绘图表面

这项工作面向 RC.12，尚未包含在 RC.11.1 中。NativeScript 与实验性 Web runtime 共享验证和生命周期规则，各平台使用不同的执行后端。更新配套 Jolt 包后，请重新编译原生应用。

## 指针位置与存在状态

原生端新增 `pointerFollow`；Web 在现有实现上增加 `presence`。普通触摸不会模拟悬停。重要操作仍应通过按钮、触摸和键盘完成。

```ts
import { bind, motionScope } from '@rafaelaugusto/jolt'
const scope = motionScope()
const pointer = scope.pointerFollow(region, { spring: false })
scope.use(() => bind(dot, { x: pointer.x.to([-1, 1], [-120, 120]) }))
scope.use(() =>
  pointer.presence.subscribe((value) => {
    // 区域内为 1，区域外为 0。
  }),
)
scope.dispose()
```

Web 使用 `runtime.scope().pointerFollow(element, options)` 和 `scope.bind()`。两端提供 `x`、`y`、`presence`、`active`、`available`、`disposed`、`suspended`、`update({ disabled })`、`refresh()`、`suspend()`、`resume()`、`dispose()`。`presence` 是即时数值。原生 `spring: false` 输出可供外部属性编译绑定使用的原始 motion values。默认弹簧会平滑跟随，但现有外部属性绑定采样器不接受这些弹簧节点；请使用原始值或明确归属的 JS 订阅。

| 契约     | NativeScript                                     | Web                                   |
| -------- | ------------------------------------------------ | ------------------------------------- |
| 像素坐标 | 经过目标变换转换后的本地 DIP                     | 目标在视口中的轴对齐矩形内的 CSS 像素 |
| 默认值   | 中心为原点，归一化到 −1…1                        | 相同映射                              |
| 支持条件 | iPadOS 悬停；Android 鼠标或悬停笔；iPhone 不支持 | Pointer Events 与浏览器悬停能力       |
| 成本     | 每个送达的原生悬停事件触发一次 JS 回调           | 浏览器合并指针更新                    |

选项包括 `axis`、`coordinates`、`range`、`rest`、`spring`、`disabled`。`range` 映射归一化输入或限制像素值，`rest` 必须位于声明的范围内。零尺寸目标不会产生有效位置。暂停、后台、卸载、禁用和减少动态效果会恢复静止值并清零 presence。尺寸变化会被观察；应用主动改变坐标后可调用 `refresh()`。`available` 表示 API 支持，不检测配件是否连接。装饰性跟随元素应禁用交互。三维投影和覆盖层输入策略由应用负责。Android 观察窗口输入并转交原 callback；这些接口不承诺在应用 JavaScript 阻塞时继续运行。

<Clip name="portable-pointer-ipados" :width="720" caption="iPad Pro 11 英寸 (M4) 模拟器，iPadOS 26.2，英文界面：向系统注入连续悬停事件，驱动原生跟随元素与 SceneKit uniforms，保留点击，并验证尺寸调整和重新挂载。原始时序；未测试实体鼠标或 iPad。" />
<Clip name="portable-pointer-android" caption="ASUS ZenFone 3 实体设备，Android 8，英文界面：注入原生鼠标事件以移动跟随元素，离开时恢复静止，真实点击保持有效。原始时序；未测试实体鼠标配件。" />
<Clip name="portable-pointer-chromium" :width="900" caption="macOS Chromium，英文界面：真实鼠标进入、移动、离开，保留按钮点击，调整尺寸、暂停/恢复及重新挂载。原始时序；普通触摸不会变成悬停。" />

## 用一个操作协调相关属性

```ts
import { propertyGroup } from '@rafaelaugusto/jolt/native'
const group = scope.resource(() => propertyGroup({ a, b, c }))
const motion = group.animate({ a: 0.8, b: 0.4, c: 1 }, { duration: 1800 })
motion.pause()
motion.progress = 0.5
motion.play()
```

成员是已有的类型化 adapters。组借用 1–64 个不同的目标/通道，每个命令必须提供全部成员。目标、分量、值和过渡会在打断有效播放前准备好；重复通道和混合后端会被拒绝。API 包括 `get`、`set`、`animate`、`stop`、`suspend`、`resume`、`dispose`。销毁组不会销毁借用的 adapters。

替换任一成员会取消整个正在运行的组，保留无关通道。重新定向读取当前呈现状态，并为弹簧投影当前速度。`finished` 只结算一次；取消时为 `false`。`set()` 写入失败会尝试恢复已写值并汇总回滚错误，不会重启动画。原生播放准备部分失败时会取消已创建的 players，但无法撤销外部 renderer 的副作用。共享逻辑时钟不代表跨 renderer 的 GPU 原子提交。

原生需要可选的 `@rafaelaugusto/jolt-native` 插件，使用一个逻辑时钟协调编译的成员 players，并在 setup 后同步时间位置。Web 使用 `scope.property(target, definition)`，定义含 `name`、`units`、`read`、`write`、`encode`、`decode`，可选 `alive`、`spatial`、`validate`、`interpolate`。`scope.propertyGroup()` 接受同一 runtime/document 的 adapters，在浏览器主线程的一个 scheduler task 中写入；普通 WAAPI 路径不变。DOM 目标必须保持连接。外部资源使用 `alive()`，释放资源前先销毁 adapter。减少动态效果会让空间属性组到达目标；scope 暂停会保留手动暂停状态。

每个属性最多包含 64 个数值分量。采样动画每个成员最多 262,144 个数值分量，每组最多 1,048,576 个；超限请求会在打断有效播放前失败。这些是分配上限，不是支持时长的保证。

<Clip name="portable-groups-ios" caption="iPhone 17 Pro 模拟器，iOS 26.2，英文界面：三个编译 UIKit 属性和三个真实 SceneKit 材质 uniforms，协调暂停/恢复、替换和重新挂载。渲染需求回到 idle。原始时序，不是物理设备性能测量。" />
<Clip name="portable-groups-android" caption="ASUS ZenFone 3 实体设备，Android 8，英文界面：三个编译的原生属性协调启动、暂停/恢复、替换和重新挂载。真实点击，原始时序；此 Android 示例不包含 SceneKit。" />
<Clip name="portable-groups-chromium" :width="900" caption="macOS Chromium，英文界面：三个 DOM 属性和真实 WebGL uniforms，暂停/恢复、替换、空闲渲染需求与重新挂载。真实点击，原始时序。" />

## 渲染需求与所有权

```ts
const activity = scope.renderActivity({
  change(active) {
    renderer.setContinuous(active)
  },
  redraw() {
    renderer.drawFinalFrame()
  },
})
activity.track(motion)
const child = activity.scope()
const release = child.hold()
release()
```

`track()` 跟随真实播放时钟的 delay、暂停、seek、替换和结算。它不拥有动画，移除观察不会停止动画。delay 会预留需求；`hold()` 为应用持续工作保留需求，直到释放。独立子 owner 汇总到同一 renderer；使用 `activity.scope()`，不要为同一 adapter 对象创建两个根。上限为 4,096 个观察/token，不增加轮询或永久帧循环。

静态保留的绘图本身不产生持续渲染需求。暂停和后台会抑制需求；可见时 `redraw()` 交付最终或 seek 后的状态。应用应将 Jolt 需求与自身渲染配置合并，不会安装全局 SceneKit 策略。上方视频展示此集成；Web 测试还验证真实 WebGL 帧计数器在空闲时停止增长。

## 有预算的保留式绘图

```ts
import { drawBatch } from '@rafaelaugusto/jolt/shapes'
const drawing = scope.resource(() =>
  drawBatch(host, {
    viewBox: [0, 0, 760, 300],
    styles: { signal: { fill: '#63e3c2', strokeWidth: 0 } },
    items: [{ id: 'dot', style: 'signal', kind: 'circle', cx: 30, cy: 80, radius: 4 }],
  }),
)
drawing.update([
  { id: 'dot', style: 'signal', kind: 'circle', cx: 40, cy: 80, radius: 8 },
])
```

Web 使用 `scope.drawBatch(element, sameOptions)`。支持圆、矩形和经过验证的 SVG paths。唯一 ID 为 1–128 个字母、数字、点、下划线或连字符。数组顺序就是绘制顺序。`set({ items, styles })` 替换提供的集合，用于插入、删除和重排；`update(items)` 按 ID 替换完整的已有项目。共享样式使用 `shape` 的填充/描边选项；未知字段会在修改有效绘图之前被拒绝。

不可变 `viewBox` 按比例缩放、居中并裁剪到 host 本地 bounds，几何和描边使用 viewBox 单位。尺寸变化会更新映射。iOS 在一个 layer 中保留 paths；Android 使用一个 drawable，为圆和矩形使用 Canvas primitives。Web 使用一个装饰性 SVG，每项一个 path，复用未变节点。原生 view 数更少并不代表 DOM 数或 CPU 更低。

| 预算              |                 原生和 Web |
| ----------------- | -------------------------: |
| 项目 / 样式       |                 1,024 / 64 |
| 总命令 / 数值分量 |             8,192 / 65,536 |
| 每条 path         | 256 个命令 / 20,000 个字符 |
| 序列化更新        |                      2 MiB |
| 每项采样动画      |       不支持；几何立即更新 |

`snapshot()` 返回数量和数值几何字节数，不是进程内存。整个 host 的动画单独管理，并遵循减少动态效果。`suspend()` 保留可见绘图，延迟写入直到 `resume()`；后台采用相同规则。原生 unload 释放几何，load 恢复；`dispose()` 永久移除表面。逐项命中测试与无障碍由应用负责，绘图表面不拦截输入。

<Clip name="portable-drawing-ios" caption="iPhone 模拟器，iOS 26.2，英文界面：一个保留 layer 中的 259 个点与分段指示器，定向修改、host 动画、暂停期间延迟编辑及重新挂载。真实原生交互，原始时序。" />
<Clip name="portable-drawing-android" caption="ASUS ZenFone 3 实体设备，Android 8，英文界面：单个原生 Canvas 表面中的 259 个点、定向更新、分段指示器、暂停/恢复和重新挂载。真实点击，原始时序。" />
<Clip name="portable-drawing-chromium" :width="900" caption="macOS Chromium，英文界面：共享的 259 点配方和 SVG 指示器，更新、暂停/恢复及重新挂载。原始时序；每项保留一个 SVG path。" />

## 原生回归修复

iOS shape renderer 在变换后的 layout 中读取本地 `UIView.bounds`，避免缩放/旋转改变内部绘图尺寸。Android 和 Web 已使用本地几何。iOS press observer 不再重复转发原生触摸，从而避免重复按钮操作，并在暂停时重置反馈。重复点击已被复现并修复；最初报告的“应用已暂停时触发操作”未被独立复现。

<Clip name="portable-shape-ios" caption="iPhone 模拟器，iOS 26.2：直接变换绘图与变换父容器内的绘图，在缩放、旋转及两者结合时保持一致的本地几何。英文界面，真实点击，原始时序。" />
<Clip name="portable-press-ios" caption="iPhone 模拟器，iOS 26.2：scope 内的 press 反馈每次真实点击只产生一次操作，包含 Home/后台、返回和重新挂载。英文界面，原始时序；展示防重复点击，不代表复现暂停期间的操作。" />

请查看[验证与原始数据](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/portable-foundations.md)。这些结果不能证明整个应用 CPU/PSS 更低，也不能证明优于 Reanimated。
