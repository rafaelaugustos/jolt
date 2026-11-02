# Web 颜色、布局与场景

这是 **RC.6 之后的开发候选版本**，对应 #308–#313，尚未包含在已发布的 RC.6 包中。它扩展实验性的 `/web` 入口，不依赖框架或 NativeScript。[完整功能对等](https://github.com/rafaelaugustos/jolt/issues/236)仍是总体目标；本批次并不意味着所有原生 API 已在 Web 实现。

## 颜色、边框与连续绑定 {#paint}

有限播放支持 `backgroundColor`、`color`、`borderColor` 及四边颜色；`borderWidth` 及四边宽度；`borderRadius`、四个独立圆角和各自的 `X`/`Y` 半径。显式长属性优先于简写。长度数字使用 CSS 像素，颜色数字使用打包 ARGB。CSS 字符串在准备调用时根据目标解析；圆角支持椭圆简写和百分比。

颜色使用共享的预乘透明度 OKLab 编译器，输出 sRGB。宽度和半径非负，遵循 CSS 几何及边框样式规则。Jolt 不会让 `border-style: none` 自动可见，也不会替换背景图片或键盘焦点轮廓。绘制通道独立替换；加法/乘法 layer 仍遵守 transform/opacity 契约。

数值的 `.to()` 也接受颜色字符串，返回只读 `WebColorValue`。在颜色映射之前使用 `springValue()`；颜色没有标量速度。`bind()` 将颜色节点及数值装饰节点接入已有的按需调度器。释放源会释放依赖节点；释放绑定保留当前绘制结果。旧 handle 无法覆盖新拥有者。

颜色映射与目标无关：传入已解析的颜色，不要使用目标 CSS 变量或 `currentColor`。有限 `animate()` 会根据其目标解析这些表达式。

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
motion.animate(
  card,
  {
    backgroundColor: '#d8f381',
    color: '#15291e',
    borderTopColor: '#dc672a',
    borderRightWidth: 8,
    borderRadius: '42px 12px 56px 20px / 16px 32px 24px 48px',
  },
  'snappy',
)

const input = motion.motionValue(0)
const follower = motion.springValue(input)
const paint = motion.bind(card, {
  backgroundColor: follower.to([0, 1], ['#7655e8', '#ed8b46']),
  borderRadius: follower.to([0, 1], [12, 64]),
})
input.set(1)
```

<Clip name="web-paint-chromium" :width="900" caption="macOS arm64 上的 Chromium 156：真实点击、持续按压及键盘范围输入演示有限颜色/边框/圆角播放和连续颜色/半径绑定。原始速度，不代表移动真机性能。" />

## 真实尺寸与视觉布局 {#layout}

`animateSize()` 分别或同时改变真实 `width`、`height`，支持数值和 `auto` 目标。文本重新换行，相邻元素参与正常布局。Box sizing、min/max、Grid 和 Flexbox 仍决定分配结果。Flexbox 插值首选 CSS 尺寸，避免重复应用 grow/shrink。活动期间持续测量内在目标，新内容可能延长完成时间。完成时恢复语义 `auto` 或请求的数值 CSS 声明。

变更回调在捕获后同步执行；框架微任务在测量前运行。请提前获取数据。异步变更、重复和 seek 不适用于持续变化的内在目标。替换继承共同轴的当前数值/速度，恢复省略轴，旧操作以 `false` 完成。暂停移除尺寸帧任务。`stop()` 保持当前尺寸；`stop({ restore: true })`、移除和释放恢复仍由操作拥有的声明，不撤销内容变更或新的外部行内写入。

`animateLayout()` 按元素身份捕获容器的直接 HTMLElement 子项，应用变更后在下一帧测量。它通过私有贡献插值逆向位置和尺寸，保留应用/press、静态二维变换及原点。新子项可淡入，移除的子项立即离开。`size: false` 关闭尺寸反转，`enter: false` 关闭入场。替换会重新捕获当前视觉姿态。`stop()` 清除反转变换并保留新布局。handle 提供 `finished` 和 `stop()`。投影或奇异几何没有受支持的二维逆变换。

```ts
const size = motion.animateSize(
  card,
  { width: 420, height: 'auto' },
  () => {
    card.textContent = nextText
  },
  { duration: 400 },
)
size.pause()
size.play()
await size.finished

const layout = motion.animateLayout(
  list,
  () => {
    list.append(list.firstElementChild!)
  },
  { size: 'scale', enter: true, duration: 400 },
)
await layout.finished
```

<Clip name="web-size-chromium" :width="900" caption="macOS 上的 Chromium 156：真实控件改变宽度和内在高度，暂停、继续、反转并添加文本。后续行参与真实布局，保持原始速度。" />

<Clip name="web-layout-chromium" :width="900" caption="macOS 上的 Chromium 156：真实点击重排、缩放、中断、插入和移除网格卡片。FLIP 缩放视觉内容，与文本真实重排不同。" />

## 可定位场景 {#scenes}

`seekableTimeline()` 在同一时钟上协调显式元素 track、可变数值 track、嵌套 `steps`、毫秒偏移及有限重复。每个逻辑通道/layer 使用一个描述符；多段运动合并到关键帧。回调、手势和副作用不属于可逆场景描述符。目标和值必须属于同一文档/runtime。

暂停、继续、停止和 `progress` 保留有限播放契约。暂停终点仍可倒退。替换单一通道或对数值执行 `set()` 不影响其他 track；旧 handle 无法取回通道，最终以 `false` 完成。观察数值需要共享调度器；符合条件的纯元素场景仍使用 WAAPI。

```ts
const progress = motion.motionValue(0)
const scene = motion.seekableTimeline(
  [
    {
      target: card,
      keyframes: { x: [0, 240], borderRadius: [8, 40] },
      transition: { duration: 1200, ease: 'linear' },
    },
    {
      at: 200,
      steps: [{ value: progress, keyframes: [0, 100], transition: { duration: 1000 } }],
    },
  ],
  { paused: true },
)
scene.progress = 1
scene.progress = 0.3
scene.play()
await scene.finished
```

<Clip name="web-scene-chromium" :width="900" caption="macOS 上的 Chromium 156：真实播放/暂停点击与键盘范围输入协调两个元素和计数器，到达暂停终点后倒退并继续。" />

## 生命周期、成本与集成 {#integration}

实时减少动态效果设置会结束空间/装饰 track 和内在尺寸操作，包括暂停中的尺寸；颜色/透明度保留时间安排。随拥有者释放目标和上下文。`useWebMotion()` 也在声明的 ref 上提供 `animateSize()`、`animateLayout()`，随 Vue scope 清理。

[Web 表面规则](./web-runtime#surface-policy-and-limits)仍适用：使用独立表面，避免竞争的 CSS 动画/过渡。有限绘制使用预先准备的 WAAPI 关键帧，但颜色可能重绘，边框可能触发布局。真实尺寸每个活动帧测量布局；这些路径不保证合成器加速。避免逐帧框架渲染。

运行 `npm run web:visual:typecheck`、`npm run web:visual:test`、`npm run web:visual`。演示端口为 4287，参数为 `?demo=paint`、`size`、`layout` 或 `scene`。[验证与录像命令](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-visual.md)包含真实 Chromium/Firefox/WebKit 及打包后的命令式/Vue/SSR/原生消费者。

Mavis 采用工作单独记录于[控件 #191](https://github.com/getcortexlabs/mavis-ui/issues/191)、[Accordion #192](https://github.com/getcortexlabs/mavis-ui/issues/192)、[共享 FLIP #193](https://github.com/getcortexlabs/mavis-ui/issues/193)和[场景 #194](https://github.com/getcortexlabs/mavis-ui/issues/194)，直接使用 Jolt 引擎。

## 保留的原生参考 {#native-reference}

这些已审查的英语录像展示已有原生对应行为，不是 Web 实现录像，也不证明新的真机性能。

<Clip name="decorations-reference-ios" caption="iOS 原生演示片段：边框及圆角变化。裁去启动画面，保留播放速度和原始媒体。" />

<Clip name="live-paint-ios" caption="iOS 模拟器：真实点击改变目标并暂停/继续颜色与半径弹簧。原生统一圆角与 Web 独立圆角有所不同。" />

<Clip name="size-ios" caption="iPhone 17 模拟器，iOS 26.0：真实宽高、内在内容、中断与暂停。演示部分明确选择 0.25×；录像速度未改变。" />

<Clip name="layout-ios" caption="iOS 模拟器：已有原生 FLIP 演示中的插入、移除、重排及尺寸变化。" />

<Clip name="seekable-scene-ios" caption="iOS 模拟器：真实滑块交互定位原生场景，包括从暂停终点倒退。" />
