# Web 键盘、面板、导航、物理与图标

**自 0.1.0-rc.10 起可用。** #366–#371 为 Web runtime 和 scope 增加六项能力。SSR 可导入 `/web`，在客户端元素挂载后创建 `createWebRuntime(document)`，再调用 `motion.scope()`。

## 键盘几何 {#keyboard}

`scope.onKeyboard(callback)` 与 `scope.followKeyboard(composer, { offset: 12 })` 返回可调用的清理函数，同时提供 `pause/play`、`dispose` 和 `snapshot()`。状态包含可见性、矩形、以 CSS 像素计的布局视口底部覆盖高度、后端与精度。VirtualKeyboard 使用浏览器报告的矩形；备用 VisualViewport 只在可编辑元素聚焦、没有缩放且视口减少超过 80 px 时估算。浏览器工具栏、实体键盘和浮动键盘会限制估算精度。浮动键盘可以可见但底部覆盖为零；没有几何数据时精度为 `unavailable`。

浏览器不提供原生键盘动画曲线，因此 duration 始终为零。Jolt 不修改全局 `overlaysContent`，也不重复扣除已缩小的视口。跟随使用独立位移层；目标应与坐标轴对齐，祖先不带变换。`offset` 为非负间距。

<Clip name="web-keyboard-platforms-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实聚焦和输入报告桌面几何。这里不会打开软件键盘，不作为移动键盘跟随演示。" />
<Clip name="keyboard-ios" caption="iOS 模拟器，英文原生演示：已复核的现有参考视频，真实交互和动画，原始速度；不是实体设备录制。" />

## 底部面板 {#sheet}

`scope.bottomSheet(panel, { host, handle, snap: [160, '75%'], scrollView: content })` 要求 panel 是已定位、带裁剪 host 的直接子元素，handle 是 panel 内独立元素。停靠点支持正 CSS 像素、可用高度百分比，或配合独立测量元素的 `'content'`。嵌套滚动协调器处理拖动与滚动交接，保留表单输入。应用负责模态语义与背景滚动锁定。

控制器提供 `open`、`snapTo`、`expand`、`collapse`、`dismiss`、`remeasure`、`snapPoint` 和 `visibleHeight`。`safeArea` 使用显式 CSS 像素；`keyboard: 'none'` 禁用键盘跟随。backdrop 必须是 panel 的兄弟元素。`onChange` 报告目标，`onDismiss` 在关闭稳定后执行一次。`dismissible: false` 禁止用户关闭。handle 提供 slider 语义和方向键/Home/End/Escape 操作；应用提供本地化 `label`，必要时设置 `returnFocus`。

<Clip name="web-sheet-platforms-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击、键盘和手势展示 Web 行为，原始速度；不代表实体设备性能。" />
<Clip name="bottom-sheet-ios" caption="iOS 模拟器，英文原生演示：已复核的现有参考视频，真实交互和动画，原始速度；不是实体设备录制。" />

## 交互式模态框 {#modal}

`scope.interactiveModal(dialog, { handle })` 接受已挂载、初始关闭的 `HTMLDialogElement`。`open()` 使用浏览器顶层、背景不可交互和焦点管理。`canBegin` 可否决拖动。短距离拖动或 `cancel()` 返回打开位置；`close(returnValue)`、Escape 和关闭按钮关闭对话框。`state/onState` 报告 opening/open/dragging/closing/closed/disposed。

外部 `dialog.close()` 和 `method="dialog"` 表单仍可使用。暂停冻结运动。dispose 移除增强行为，但保持已打开的对话框，由应用在卸载时关闭或删除。这不是 iOS 转场 delegate 或 Android predictive back。

<Clip name="web-modal-platforms-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击、键盘和手势展示 Web 行为，原始速度；不代表实体设备性能。" />
<Clip name="interactive-modal-ios" caption="iOS 模拟器，英文原生演示：已复核的现有参考视频，真实交互和动画，原始速度；不是实体设备录制。" />

## 应用控制的导航 {#navigation}

`scope.sharedNavigation(routeHost)` 提供 `attach(card, 'cover')` 和 `navigate({ tag: 'cover', async navigate({ animated }) { ... } })`。跨路由保留容器。回调仅调用一次，参数为 `animated: false`；在回调完成前附加目标。路由器仍负责历史、数据、提交与过期异步请求。

并发请求返回 `unavailable/busy`，不调用路由回调。`finished` 返回状态、原因、`navigated` 和可选错误；`navigated` 仅表示已调用回调，不保证异步路由成功。取消只结束视觉效果，不撤销路由。拒绝返回 `failed`；不支持的内容或减少动态效果设置保留导航而跳过转场。

`navigationTimeout` 默认 3000 ms，最大 10000。视觉准备窗口为该值加 `layoutTimeout`（默认 500），总计最多 10000 ms；隐藏文档时间不计入。沿用 shared layout 静态 HTML 复制限制，不支持表单、视频、canvas、自定义元素或 SVG 快照。这不是原生截图或交互返回手势。

<Clip name="web-navigation-platforms-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击、键盘和手势展示 Web 行为，原始速度；不代表实体设备性能。" />
<Clip name="shared-navigation-ios" caption="iOS 模拟器，英文原生演示：已复核的现有参考视频，真实交互和动画，原始速度；不是实体设备录制。" />

## 圆形物理 {#physics}

`scope.physicsWorld(arena, [{ id: 'ball', view: ball, radius: 24, x: 80, y: 80 }])` 支持 1–16 个不同的直接子元素。半径 12–256 CSS px，质量 0.1–100，速度最大 1200 px/s，总面积不超过 host 的 40%。wrapper 宽高应等于直径；host 和祖先不能变换。初始圆必须放得下且不能重叠。重力各分量为 ±2000，恢复系数 0–1，阻尼 0–20。

TypeScript 内核与真实 C/iOS、Java/Android 内核比较 52 个场景。固定积分频率为 240 Hz，每渲染帧最多补偿 24 步；超出时间记录在 `snapshot().droppedMs`。Web 物理在主线程执行，不承诺原生性能。支持直接拖动、指针弹簧、固定 attachment 或 1–8 个 snap 点；attachment 与 snap 互斥。最多 32 条物体间弹簧，每个物体最多连接四条，弹簧端点不能使用 snap。

`impulse`、`attach`、`spring`、`snapTo`、`reset`、`pause/play` 和 `snapshot` 控制物理世界。可选线条仅为装饰。弹簧拖动释放时保留已积分的物体动量；取消释放指针所有权。尺寸变化按比例调整位置并清零速度，边界无效时暂停至恢复。减少动态效果默认暂停，可显式设置 `'continue'`。静止世界不请求帧。dispose 释放线条、输入、绑定与所控制的定位样式。

<Clip name="web-physics-platforms-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击、键盘和手势展示 Web 行为，原始速度；不代表实体设备性能。" />
<Clip name="circle-physics-ios" caption="iOS 模拟器，英文原生演示：已复核的现有参考视频，真实交互和动画，原始速度；不是实体设备录制。" />
<Clip name="physics-attachments-ios" caption="iOS 模拟器，英文原生演示：已复核的现有参考视频，真实交互和动画，原始速度；不是实体设备录制。" />

## 应用自己的图标 {#symbols}

`scope.symbolEffect(iconWrapper, 'bounce', { speed: 1 })` 动画化独立 HTML wrapper。bounce、pulse 和 variableColor 可以重复，scale 保持放大直到停止。`variableColor` 对 1–32 个 `[data-jolt-symbol-layer]` 层应用透明度波形，不加载 SF Symbols。

`{ replace: detachedIconElement }` 使用同文档、未连接的装饰性 HTML/SVG 替换内容；停止或 dispose 后保留新图标。应用负责更新无障碍名称与状态。循环及 scale 的逻辑时长为无限，不支持 seek；有限效果支持进度、暂停与布尔完成结果。减少动态效果跳过装饰并返回 `false`，替换仍提交并返回 `true`。

<Clip name="web-symbols-platforms-chromium" :width="900" caption="macOS 上的 Chromium，英文界面：真实点击、键盘和手势展示 Web 行为，原始速度；不代表实体设备性能。" />
<Clip name="symbols-reference-ios" caption="iOS 模拟器，英文原生演示：已复核的现有参考视频，真实交互和动画，原始速度；不是实体设备录制。" />

## 生命周期与验证 {#validation}

所有 factory 均支持 runtime、scope 与 Vue setup scope。暂停/恢复控制资源，dispose 或目标断开释放资源；目标重新挂载后需创建新控制器。共享合成器可能保留中性的内联 transform/opacity 序列化，不会删除应用的其他层。运行 `npm run web:platforms:typecheck`、`npm run web:platforms:test` 和 `python3 benchmarks/verify-circle-math.py`。浏览器测试覆盖 Chromium、Firefox、WebKit 的真实输入、模态焦点、异步导航及可见输出。注入的键盘矩形仅用于测试，录制不会伪造移动键盘。使用 `node benchmarks/web-platforms/record.mjs` 重现 Web 视频。Mavis 采用工作通过独立 issue 跟踪。
