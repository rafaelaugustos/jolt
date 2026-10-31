# API {#api}

- [**createMotionInspector**](./motion-inspector) — 可选的开发检查、本地批次、所有权、绑定图和可重复的弹簧调整。

## 动画 {#animating}

- [**recordInteraction / replayInteraction**](./interaction-replay) — 可选的开发跟踪、受控时钟重放和原生回归探针。自 beta.18 起可用。
- [**sharedLayout(container, options)**](./shared-layout) — 可选的同页共享身份、原生快照、交叉淡入淡出和中断。自 beta.18 起可用。
- [**sharedNavigationEntry(frame, options)**](./shared-gestures) — 在稳定的 iOS 和 Android 14+ 页面上交互式原生图像/卡返回。自 rc.1 起可用。
- [**resolveListTarget(context, options)**](./return-targets) — 通过稳定键限制当前单元分辨率，以便在回收、滚动或重新排序后共享返回。自 rc.1 起可用。
- [**entry.returnToSource(options?)**](./gallery) — 通过当前单元分辨率返回保持的照片姿势，将平移速度和视口剪切带入本地飞行。
- [**sharedNavigation(frame, options)**](./shared-navigation) — 跨编程路线、范围标签和有界后备的可选原生图像/卡运动。自 rc.1 起可用。
- [**interactiveNavigation(frame, options)**](./interactive-navigation) — 原生 iOS 边缘滑动页面转换，具有取消、速度感知弹簧完成和核心/路由器历史记录。自 rc.1 起可用。
- [**predictiveBack(view, values, options)**](./predictive-back) — 原生 Android 14+ 系统后台进度、spring 取消和一次受保护的提交。自 rc.1 起可用。
- `animate(target, keyframes | preset, transition?)` — [路径](./paths), [颜色](./colors), [角、边框和阴影](./decorations)
- [`interactionSurface(target)`](./interaction-surface) — 选择动画子树的原生触摸几何体。
- [`animateLayout(container, change?, options?)`](./layout) — 为容器的直接子级的下一个布局设置动画。
- [`animateSize(view, dimensions, change?, options?)`](./size) — 通过文本回流、暂停/恢复和范围所有权对实际宽度/高度/自动进行动画处理；每帧执行 JS 布局。
- [`motionScope()`](./motion-controllers) — 自己的动画句柄、订阅和组件生命周期。
- [`motionStates(targets, definitions, options?)`](./motion-controllers#named-visual-states) — 协调的、可中断的命名视觉状态； [`attach()` 和 `ref()`](./motion-controllers#views-that-come-back) 将它们保留在重新创建的视图上，并且转换可以 [设定不同的目标](./motion-controllers#a-transition-per-target)。
- [`motionValue(initial)`, `bind(target, bindings)`](./motion-values) — 一个值驱动多个属性和视图； `animate()`、`set()` 和 `stop()` 也取值。 [`scrollValue(scrollView, { axis? })`](./motion-values#scroll-offsets) 是一个滚动偏移值。
- [`springValue(source, options?)`](./live-springs) - 保留具有位置/速度连续性、本地链、数字映射和变换/不透明层的本地追随者。使用其所属范围处置订阅。
- [`gestures(surface, options?)`](./gestures) 和 `GestureSurface` — 来自可选 `@rafaelaugusto/jolt/gestures` 入口点的原生平移/捏合/旋转、点击关系和核心 ScrollView 切换。
- [`bottomSheet(panel, options)`](./bottom-sheet) — 可选页内工作表，具有原生滚动切换、动态捕捉、键盘跟随和可访问操作。
- [`reorder(list, options)`](./reorder) — 可选的扁平核心 ListView 重新排序，具有稳定的按键、可变高度、原生边缘滚动和键盘/辅助功能移动。
- [`value.subscribe(listener, { immediate? })`](./motion-values#observing-outside-views) — 观察 JavaScript 中的数字、派生颜色和滚动值；返回取消订阅。
- [`animate(value, target, { layer })`, `stop(value, { layer })`](./motion-values#layers-on-a-value) — 映射之前的加性标量层。
- [`animate(target, { y }, { type: 'gravity' })`](./gravity) — 弹道下落并弹到一个固定着陆点。
- [`decay(target, velocity, options?)`](./decay)
- [`gradient(target, options)`](./gradients) — 具有混合静态/动画值分量的原生线性、径向和圆锥梯度 (`GradientBindings`)；返回 `Gradient` 和 `bind()`、`animate()`、`set()`、`stop()`、`suspend()`、`resume()`、`suspended` 和 `remove()`。 [`motionScope().gradient()` and `v-gradient`](./gradients#scopes-and-vue) 拥有它的范围或模板。
- `stop(target, properties?)`
- [`set(target, values)`](./interrupting#setting-values-without-animating) — 立即应用值并停止动画。
- [`playbackProgress(animation)`](./playback) — 现有动画时钟上的只读、可观察进度。
- [`timeline(steps)`](./sequences) — 一起暂停和恢复活动步骤和挂起步骤。
- [`@rafaelaugusto/jolt/native`](./native-properties) — 可选的属性注册表、原生地图和 SceneKit 相机、[灯和材料](./scene-lighting) 和 [相机视场](./scene-camera)。
- [`sequence(steps)`](./sequences) — 重叠步骤和固定位置。
- `press(target, pressed?, transition?)`
- [`drag(target, options?)`](./drag) — 使用 `value`，手势驱动 [动画值](./motion-values#dragging) 而不是视图。
- [`physicsWorld(container, bodies, options)`](./circle-physics) — 原生圆碰撞、拖动/释放和生命周期所有权。
- [`shape()`](./shapes) — 原生 SVG 笔画绘制和匹配路径变形。
- [`blur()`](./blur) — 对拥有的原生模糊量进行动画处理。
- [`GlassContainer` / `GlassView`](./glass) — 使用现有变换播放的原生 iOS 26 Liquid Glass 融合。
- [`world.attach()` / `world.snapTo()`](./physics-attachments) — 原生锚定弹簧和释放卡扣点。
- [`sensor(kind, options)`](./device-sensors) — 用于动画值、绑定和弹簧的可选原生旋转/重力源。
- [`scrollHeader(list, options)`](./scroll-header) — 原生核心 ListView 组成：测量英雄、视差、标题切换、固定部分和稳定项目锚点。
- [`scrollLinked(scrollView, target, keyframes, { range, axis? })`](./scroll-linked) — 返回清理函数。
- [`animateItems(list, keyframes | preset, options?)`](./lists) — 出现的行，带有 `once`；返回一个清理函数。
- [`followKeyboard(target, options?)`](./keyboard) — 在 iOS 和 Android 7+ 上使用键盘移动视图；返回一个清理函数。
- [`onKeyboard(callback)`](./keyboard#keyboard-state) — 键盘覆盖的窗口大小及其计时；返回一个清理函数。
- [`symbolEffect(image, effect, options?)`](./symbol-effects) — iOS SF Symbols.
- [`shimmer(target, options?)`](./shimmer) — iOS 加载占位符；返回一个清理函数。
- [`liquid(image, options?)`](./liquid) — iOS 纹理变形；返回 `LiquidEffect` 以及 `pause()`、`resume()` 和 `stop()`。
- [`imageEffect(image, name, options?)`](./image-effects) — 原生波纹、触摸失真和确定性溶解；播放控制和显式兼容性回退。
- [`zoomable(image, options?)`](./photo-zoom) - 原生照片捏合、双击缩放、有界平移和可选的消除意图。
- [`loader(target, options?)`](./loaders) — iOS 点、条和环指示器；返回一个清理函数。
- [`reveal(target, options?)`, `conceal(target, options?)`](./reveal) — iOS 圆形可见性过渡；返回 `Animation`。
- [`animateText(label, options?)`](./text) — iOS 和 Android 上的逐字或逐词入口；返回 `Animation`。
- [`animateText(label, options?)`](./text) — iOS 逐字母或逐字入口；返回 `Animation`。
- [`rollTo(label, value, options?)`](./rolling) — iOS 和 Android 上的滚动数字；返回 `Animation`。
- [`confetti(target, options?)`, `particles(target, options?)`](./particles) — 原生 iOS/Android 粒子效果；返回清理函数。每帧没有 JS 模拟或绘制回调； Android绘图共享UI线程。

`target` 是一个视图或任何持有视图的东西（模板引用、`ElementRef`）。 `animate()`、`decay()`、`stop()`、`set()` 和序列步骤也接受目标数组。

`animate()` 选项还接受 [`haptic`](./haptics)：`light`、`medium`、`heavy`、`{ style, times }` 或 `false`。反馈支持 iOS 和 Android，尊重设备设置。

## 动画 {#animations}

什么`animate()`、`decay()`、`sequence()`和一个序列的步骤返回：`await`呢，读取`finished`，或者调用`stop()`。当播放到最后时，它会解析为 `true`；当它被停止或接管时，它会解析为 `false`，并且取消永远不会拒绝。序列设置/回调错误可以在取消其其他工作后拒绝 `finished`。

`animate()` 和 `decay()` 返回 [`PlaybackAnimation`](./playback)：基本生命周期加上 `pause()`、`play()`、可写 `progress` 和只读 `paused`/`duration`。序列和效果句柄保留基本 `Animation` 合同。

## 转变 {#transitions}

- **弹簧**：`'smooth' | 'snappy' | 'bouncy'`、`{ bounce, duration, velocity }` 或 `{ stiffness, damping, mass, velocity }`。
- **补间**: `{ duration, ease, times, easeTrack }`.
- **时序**: `delay`, `repeat`, `repeatType: 'loop' | 'reverse'`, `repeatDelay`, `stagger: number | { each, from }`.
- **层**：[`layer: 'name'`](./layers) 在属性的其他动画之上播放； `stop(target, properties, { layer })` 停止一层。
- **每个属性**：映射到其自身转换的任何属性名称。
- **相对关键帧**：`{ relative: true }` 添加平移/旋转偏移并将比例/不透明度乘以其起始值。

## 助手 {#helpers}

`definePreset(name, preset)`、`presets`、`springs`、[`origamiSpring({ friction, tension })`](./react-native#springs)、`cubicBezier`、`toView(target)`。`toView()` 返回任何可接受目标背后的 NativeScript 视图，供接受与 `animate()` 相同目标的辅助函数使用。有关注册和键入的名称，请参阅 [自定义预设](./presets#custom-presets)。

## Vue {#vue}

`@rafaelaugusto/jolt/vue` 是 NativeScript-Vue 3 的单独入口点：`vAnimate` (`v-animate`)、`vPress` (`v-press`)、`JoltTransition`、`transitionHooks(props)`、 `useMotionScope()`、`useReducedMotion()`、`useKeyboard()`、`useMotionValue()`、`useBinding()`、`useScrollValue()` 和 `install(app)`，也是 `app.use()` 的默认导出。型号：`AnimateValue`、`PressValue`、`TransitionProps`。请参阅 [Vue 指南](./vue)。

## 类型 {#types}

`Step`、`SequenceOptions`、`SequencePosition`、`JoltConfig`、`KeyframeProperty`、`ScrollLinkedOptions`、`KeyboardOptions`、`ItemsOptions`、`ColorValue`、 `ColorKeyframes`、`Keyframes`、`Transition`、`Spring`、`Tween`、`Preset`、`Presets`、`PresetName`、`SpringName`、`Easing`、 `Animation`、`Target`、`DecayVelocity`、`DecayOptions`、`SymbolEffect`、`SymbolEffectName`、`SymbolEffectOptions`、`ShimmerOptions`、`LiquidOptions`、`LiquidEffect`、 `LoaderOptions`、`LoaderStyle`、`TextOptions`、`RollOptions`、`RevealOptions`、`ConcealOptions`、`Haptic`、`HapticOptions`、`HapticStyle`、`ConfettiOptions`、 `ParticleOptions` 和其余的从包中导出。
[`configure({ timeScale })`](./configure) 设置随后开始的动画的全局播放速度。
[`configure({ timeScale, reducedMotion })`](./configure) 为随后启动的动画设置全局播放速度和简化运动首选项（`'user'`、`'always'` 或 `'never'`）。 [`reducedMotion()` and `onReducedMotion(callback)`](./configure#reading-the-preference) 阅读并观察该偏好。

## 类型 {#types-1}

- [SceneKit 环境和着色器输入](./scene-shaders) — 原生照明和类型标量/矢量uniform 参数。
