# Web 互动体验

[打开互动体验](/zh-Hans/#playground)

60 个实验、七个分类，每次运行一个演示。按名称或 API 搜索，选择实验、亲手交互并复制核心代码。所选实验保存在 URL 中，切换语言时仍会保留。

## 探索

- [动效与物理 · 16](/zh-Hans/?play=spring#playground): 弹簧、交错、关键帧、预设、重力、惯性、时间线、序列、进度控制、状态、数值与圆形物理。
- [触控与手势 · 8](/zh-Hans/?play=gestures#playground): 按压、拖动吸附、惯性、同时手势、指针跟随、图片缩放和重排。
- [滚动与布局 · 9](/zh-Hans/?play=scroll#playground): 纵向和横向/RTL 滚动、视口入场、键控条目、布局、自动尺寸、共享布局、折叠页头和嵌套滚动。
- [视觉效果 · 14](/zh-Hans/?play=gradient#playground): 线性/径向/锥形渐变、粒子、彩纸、模糊、玻璃、形状、SVG 绘制、液态图片、图像效果、显示/隐藏、闪光和加载指示器。
- [文字与符号 · 3](/zh-Hans/?play=text#playground): 按词/字动画、滚动数字及分层符号效果。
- [面板与导航 · 5](/zh-Hans/?play=sheet#playground): 底部面板、交互弹窗、共享导航、交互返回及相册返回，包括缩略图已被移除的情况。
- [设备与浏览器 · 5](/zh-Hans/?play=sensor-rotation#playground): 旋转和重力传感器、触觉反馈、键盘观察与跟随、播放和生命周期检查。

## 实际运行的内容

所有预览使用现有的实验性 Jolt Web 运行时。只挂载所选实验。离开视口后暂停其 scope，返回时重新创建。切换演示或离开页面会释放监听器、效果与 DOM 所有权。调整窗口尺寸会重建几何边界。网站及系统的减少动态效果设置仍受尊重。

代码片段展示核心集成，假设 DOM 引用已经挂载。API 指南说明结构要求、生命周期和限制。共享导航只改变本地演示场景，应用仍负责路由。Vue 适配器见 [Web 集成](./web-vue)。拖放目标、命名事件、运动路径、3D 旋转和阴影通道见[交互与深度](./interaction-depth)；属性组和批量绘图见[可移植基础](./portable-foundations)。

传感器只在明确操作后请求权限，且收到真实读数后才显示活动。不兼容或被拒绝的设备会显示相应状态。触觉请求只报告浏览器是否接受，不能确认实际振动。桌面键盘通常报告遮挡为零，请在兼容手机上尝试。玻璃和图像效果显示真实后端。减少动态效果可能阻止播放。

## 真实浏览器录屏

<Clip :autoplay="false" name="web-playground-motion-chromium" :width="960" caption="macOS arm64 上的 Chromium，英文界面，原速、无音频。通过真实指针和键盘与互动体验交互。浏览器录屏，不是原生性能测量。" />

<Clip :autoplay="false" name="web-playground-effects-chromium" :width="960" caption="macOS arm64 上的 Chromium，英文界面，原速、无音频。通过真实指针和键盘与互动体验交互。浏览器录屏，不是原生性能测量。" />

<Clip :autoplay="false" name="web-playground-platform-chromium" :width="960" caption="macOS arm64 上的 Chromium，英文界面，原速、无音频。通过真实指针和键盘与互动体验交互。浏览器录屏，不是原生性能测量。" />

## 已审核的原生参考

这些已有的原生录屏与 Web 预览分开标注。链接中的 API 指南还包含其他原生参考及平台限制。

<Clip :autoplay="false" name="showcase-springs-ios" caption="iOS 26 模拟器：真实 XCTest 点击打断并重定向原生弹簧，原速播放，不代表物理设备性能。" />

<Clip :autoplay="false" name="gesture-composition-ios" caption="iOS 模拟器：已有的原生同时手势组合与点击演示，原速播放，并非物理设备。" />

<Clip :autoplay="false" name="web-native-gradients-ios" caption="iPhone 17 模拟器，iOS 26：英文原生 Vue 演示，通过真实 XCTest 操作渐变，原速播放，并非物理设备。" />

<Clip :autoplay="false" name="interactive-modal-ios" caption="iOS 模拟器，英文原生演示：弹窗交互展示、回弹与关闭，原速播放，并非物理设备。" />

## 检查与覆盖

运行 `npm run docs:check-playground`、`npm run docs:check-media` 和 `npm run docs:build`。启动网站后运行 `JOLT_SITE_URL=http://127.0.0.1:5184 npm run docs:test-playground`。检查涵盖 Chromium 与 WebKit 中的全部实验，以及手势、键盘、屏幕尺寸、语言、减少动态效果及清理。若公开 Web 方法缺少演示或明确的宿主责任，覆盖检查会失败。这衡量的是覆盖情况，而非所有浏览器的兼容性。
