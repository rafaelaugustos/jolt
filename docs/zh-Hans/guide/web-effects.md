# Web 渐变、加载与文本效果

**自 0.1.0-rc.10 起可用。** Issue #352–#357 为实验性 `/web` 运行时及其子作用域添加 `gradient`、`shimmer`、`loader`、`reveal`/`conceal`、`animateText` 和 `rollTo`。`/web/vue` 通过 `useWebMotion().use()` 管理这些资源。Mavis 的采用工作单独进行。

## 渐变 {#gradients}

线性、径向和锥形渐变支持 2–8 个 CSS 颜色，颜色数量保持不变。色标为 0 到 1 的有序比例；中心使用盒子比例；径向半径为较短边的非负比例。角度单位为度。颜色、色标和几何通道独立替换。颜色使用共享的预乘 OKLab 插值；超出边界的色标会恢复顺序而不交换颜色身份。`bind()` 借用同一运行时的数值或颜色值，并返回尊重后续替换的清理函数。减少动态效果时，几何绑定保持当前姿态，颜色绑定继续工作。

渐变绘制在现有背景图像之上，只恢复仍由自己控制的样式。有限渐变和连续值使用运行时调度器，因为普通 CSS 渐变字符串无法像数值 WAAPI 通道那样插值。不会创建独立帧循环。

```ts
import { createWebRuntime } from '@rafaelaugusto/jolt/web'
const motion = createWebRuntime(document)
const scope = motion.scope()
const paint = scope.gradient(card, {
  type: 'radial',
  colors: ['#4135c2', '#f5cf8e'],
  center: { x: 0.3, y: 0.4 },
  radius: 0.7,
})
await paint.animate({ center: { x: 0.7 }, colors: ['#087e8b', '#ffe1b2'] }, 'snappy')
const centerX = scope.motionValue(0.3)
const unbind = paint.bind({ center: { x: centerX } })
// unbind(); paint.stop(); paint.suspend(); paint.resume(); paint.dispose()
```

<Clip name="web-gradient-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/继续、替换、减少动态效果和清理，保持原始速度。浏览器录制，不代表物理设备性能。" />

## 加载效果 {#loading}

`shimmer()` 添加裁剪后的装饰性光带。`loader()` 支持 `dots`、`bars` 和 `ring`，大小使用 CSS 像素。两者返回可调用的清理句柄，带有 `pause`、`play`、`suspend`、`resume` 和 `dispose`。临时图层不可交互，并从无障碍树中隐藏。应用内容、变换和背景保持不变。加载标签与 `aria-busy` 由应用提供。减少动态效果时隐藏光带并显示静态加载图形；文档隐藏时暂停播放。

```ts
const shimmer = scope.shimmer(placeholder, { duration: 1500 })
const loader = scope.loader(indicator, { style: 'ring', color: '#f3be7c', size: 48 })
shimmer.pause()
shimmer.play()
loader.pause()
loader.play()
// shimmer(); loader.dispose()
```

<Clip name="web-loading-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/继续、替换、减少动态效果和清理，保持原始速度。浏览器录制，不代表物理设备性能。" />

## 圆形显示与隐藏 {#reveal}

原点使用局部 CSS 像素。反向播放从当前可见圆形开始。Conceal 最终设置 `visibility: hidden`，保留布局和原始 DOM；reveal 恢复可见性。隐藏拥有焦点的交互内容前，应先移动焦点。已有 clip path 通过临时遮罩求交保留。尺寸变化会取消旧圆形并恢复其样式。

```ts
const hiding = scope.conceal(panel, { to: { x: 24, y: 24 }, duration: 600 })
const showing = scope.reveal(panel, { from: { x: 24, y: 24 }, duration: 600 })
showing.pause()
showing.progress = 0.5
showing.play()
await showing
```

<Clip name="web-reveal-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/继续、替换、减少动态效果和清理，保持原始速度。浏览器录制，不代表物理设备性能。" />

## 文本与滚动数值 {#text}

`animateText()` 按 Unicode 字素或单词分组。`rollTo()` 接受有限数值或格式化字符串；自动方向比较数值目标。变化的数字滚动，未变化的字形保持。临时副本保留文本塑形且不可访问；原始 Text 节点继续作为框架拥有的语义内容。替换时先捕获当前显示的片段，再取消旧动画。

使用纯文本 block 或 inline-block 叶节点，最多一个 Text 节点和 256 个字素。不支持内部标记、可编辑控件、竖排文字以及旋转、倾斜或负缩放。支持正向轴对齐变换。尺寸、字体或应用文本变化会安全取消。滚动快照被扁平化，最多保留 2048 个可见片段；超出预算会在替换当前动画前拒绝新目标。等宽数字样式是临时的；若静止时也需要保留，请使用 CSS `font-variant-numeric: tabular-nums`。

```ts
await scope.animateText(label, { by: 'word', duration: 400, stagger: 60, y: 12 })
await scope.rollTo(amount, 12980.6, {
  format: (value) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
  direction: 'auto',
  duration: 600,
  bounce: 0.2,
  stagger: 20,
  tabular: true,
})
```

<Clip name="web-text-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/继续、替换、减少动态效果和清理，保持原始速度。浏览器录制，不代表物理设备性能。" />

<Clip name="web-roll-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击展示播放、暂停/继续、替换、减少动态效果和清理，保持原始速度。浏览器录制，不代表物理设备性能。" />

## 资源归属与 Vue {#lifecycle}

每个目标对每类效果只允许一个控制者。同一运行时内替换会清理旧控制者；其他运行时会被拒绝。动画支持 pause/play、进度和布尔完成结果。作用域挂起时暂停播放，释放时清理其资源。脱离文档和 ref 替换会清理效果；KeepAlive 停用会释放 setup 资源，重新激活后重建。清理保留应用后来写入的样式。渐变与遮罩使用共享调度器；文本、没有应用 clip path 的 reveal 以及加载图层使用 WAAPI。这些实现选择不代表保证在主线程之外运行。

```ts
import { useWebMotion } from '@rafaelaugusto/jolt/web/vue'
const motion = useWebMotion(elementRef)
motion.use((scope, element) => {
  scope.shimmer(element)
  scope.gradient(element, { type: 'linear', colors: ['#4135c2', '#087e8b'] })
})
```

## 原生参考与验证 {#verification}

以下新录制的视频展示正常 Vue 演示中的对应原生实现。它们是视觉行为参考；上方浏览器视频运行新的 Web 后端。现有原生效果 API 的行为保持不变。

<Clip name="web-native-gradients-ios" caption="iPhone 17 模拟器，iOS 26，英文正常 Vue 演示：真实 XCTest 交互以原始速度展示对应原生效果。这是模拟器录制。" />

<Clip name="web-native-shimmer-ios" caption="iPhone 17 模拟器，iOS 26，英文正常 Vue 演示：真实 XCTest 交互以原始速度展示对应原生效果。这是模拟器录制。" />

<Clip name="web-native-loaders-ios" caption="iPhone 17 模拟器，iOS 26，英文正常 Vue 演示：真实 XCTest 交互以原始速度展示对应原生效果。这是模拟器录制。" />

<Clip name="web-native-reveal-ios" caption="iPhone 17 模拟器，iOS 26，英文正常 Vue 演示：真实 XCTest 交互以原始速度展示对应原生效果。这是模拟器录制。" />

<Clip name="web-native-text-ios" caption="iPhone 17 模拟器，iOS 26，英文正常 Vue 演示：真实 XCTest 交互以原始速度展示对应原生效果。这是模拟器录制。" />

<Clip name="web-native-rolling-ios" caption="iPhone 17 模拟器，iOS 26，英文正常 Vue 演示：真实 XCTest 交互以原始速度展示对应原生效果。这是模拟器录制。" />

运行 `npm run web:effects:typecheck` 和 `npm run web:effects:test`。浏览器测试覆盖 Chromium、Firefox、WebKit、连续绑定、替换、Unicode、原始 Text 身份、减少动态效果、清理，以及 Vue ref/KeepAlive 生命周期。打包消费者还以严格 NodeNext/Bundler 类型和 SSR 安全导入验证六个公共 API。
