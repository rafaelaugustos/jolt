# 版本历史

## 0.1.0-rc.13: SwiftUI 与 Web 框架生命周期 {#rc-13}

RC.13 包含 PR #436 的 39 项任务：[iOS 17+/macOS 14+ 独立 SwiftUI](./swiftui)、[React/Angular/Svelte/Solid Web 适配器](./web-frameworks)、[跨平台检查与回放](./portable-tools)及[面板、实测行高排序和类型化 Bézier 曲线](./swiftui-geometry)。Web 与 SwiftUI 仍为实验性 API。安装匹配的 npm 版本并重新编译 NativeScript 应用；Swift Package Manager 使用标签 `v0.1.0-rc.13`。四种语言的指南均包含已审阅的原生/浏览器录像。实体传感器、检查器开销及一般性能比较仍需独立验证。

[0.1.0-rc.13](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.13)

## 0.1.0-rc.12.1: 跨平台组合与偏好 {#release-candidate}

RC.12.1 新增 [Web 保留资源与 Vue shape 所有权、行为协调、渐变文字、2D rig、共用辅助函数及有效减少动态效果偏好观察](./portable-composition)。浏览器向量适配器共用采集机制并采用与原生兼容的单位；磁场输入明确报告不可用。请安装版本一致的软件包并重新构建原生应用。Web API 仍为实验性功能。

实体设备浏览器的传感器交付和精度验证仍在 #385 中跟踪。验收使用模拟器和明确标注的浏览器注入读数。发布不证明新的性能优势，也不证明应用 JavaScript 阻塞时仍可播放。

<Clip :autoplay="false" name="composition-behaviors-ios" caption="iOS 26.2 模拟器，英文界面：经审查的原生和浏览器行为中断、优先级及恢复静止状态录像。真实 XCTest/Playwright 交互；不代表实体设备。" />

<Clip :autoplay="false" name="composition-behaviors-web" caption="macOS 上的 Chromium，英文界面：经审查的原生和浏览器行为中断、优先级及恢复静止状态录像。真实 XCTest/Playwright 交互；不代表实体设备。" />

## 0.1.0-rc.12: 可移植交互、绘图与深度 {#rc-12}

RC.12 新增[指针存在状态、协调属性组、渲染活动与有界绘图](./portable-foundations)，以及[放置目标、可选音频提示、检查/重放与 Web 路径、3D 旋转和阴影](./interaction-depth)。请安装版本一致的软件包并重新构建原生应用。Web 入口仍为实验性功能。

实体指针配件、iPhone 静音开关及较新 Android 设备上的检查器与性能验证仍待完成。旧手机仅提供兼容性证据。延迟/PSS（#405、#406）仍作为技术债务跟踪；发布不证明性能优势，也不解决应用 JavaScript 阻塞。

<Clip :autoplay="false" name="portable-groups-ios" caption="iOS 26.2 模拟器，英语界面：协调原生属性与 SceneKit uniforms、暂停/恢复、替换和重新挂载。复用已审查录像；不是实机性能测量。" />

<Clip :autoplay="false" name="interaction-drop-android" caption="实体 ASUS ZenFone 3，Android 8，英语界面：真实拖动展示拒绝与接受，然后重新挂载 scope。复用已审查的兼容性录像。" />

<Clip :autoplay="false" name="interaction-tools-web" caption="Chromium，英语界面：编辑应用拥有的动画，并两次重放数值轨迹，验证终点且剩余资源为零。真实浏览器交互；不捕获操作系统输入。" />

## 0.1.0-rc.11.1: 原生资源生命周期与组合 {#rc-11-1}

RC.11.1 新增[保留资源与 Vue 绘图生命周期、行为优先级、二维关节部件、渐变文字和命名时间线事件](./native-composition)。这些原生 API 在文档所述场景中支持中断、减少动态效果和生命周期控制。

[安装 RC.11.1](./install)，保持可选原生包版本一致，并重新构建原生应用。延迟与进程内存研究仍作为技术债务跟踪（#405、#406）；本版本不宣称新的性能提升，也不支持在应用 JavaScript 阻塞期间持续播放。

<Clip name="native-text-android" caption="实体 ASUS ZenFone 3，Android 8，英文界面：真实原生点击演示渐变字形、移动高光、文字替换、暂停/恢复和减少动态效果。原速；不是性能测量。" />

## 0.1.0-rc.11: Web 改进与原生播放 {#rc-11}

RC.11 改进[移动键盘](./web-platforms)、[元素相对滚动区间](./web-support)和表面冲突诊断。原生功能包括可选框架适配器、[设备输入](./device-sensors)、[弹簧/滚动驱动的着色器、液态遮罩和 iOS 本地无声视频纹理](./image-effects)。[Android 播放](./android-performance)在动画结束后保留更少数据，审计导出在 worker 中处理报告。[真机研究](./performance-study)记录 CPU、内存及呈现方面的取舍，不改变应用默认设置。

Web API 仍为实验性功能。网站已在雕塑、滚动响应和交互区中使用 Web runtime；原生着色器和视频变化不会自动应用到 DOM。[安装 RC.11](./install)，保持可选原生包版本一致并重新构建原生应用。[该版本更新日志](https://github.com/rafaelaugustos/jolt/blob/v0.1.0-rc.11/CHANGELOG.md)。

<Clip name="shader-inputs-liquid-mask-ios" caption="iPhone 17 Pro 模拟器，iOS 26.2，英文界面。真实 XCTest 点击与滚动演示原生输入、融合/分离、透明度、尺寸变化和清理。原速；不是实体设备录像。" />
<Clip name="web-element-range-chromium" caption="桌面 Chromium，英文界面。真实滚轮和点击演示区块进出、在区块上方插入内容、尺寸调整、几何诊断及恢复。原速浏览器录屏，不作为原生或真机性能证据。" />

## 0.1.0-rc.10：Web 效果、传感器与完整图库返回 {#rc-10}

RC.10 新增[渐变、加载与文字](./web-effects)、[粒子、模糊、形状与图像效果](./web-surfaces)、[键盘、面板、导航、物理与图标](./web-platforms)，以及[重力、触感、传感器、玻璃与按稳定标识返回缩略图](./web-parity)。原生应用新增 [Core ScrollView 页头](./scroll-header#retained-scrollview)和[已挂载行排序](./reorder#retained-rows)。

Web API 仍为实验性功能。[安装 RC.10](./install)，将可选原生适配器保持为相同版本，并重新构建原生应用。[发布说明](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.10)。Mavis 的采用工作单独进行。

## 0.1.0-rc.8: Web 编排与生命周期 {#rc-8}

RC.8 新增[数值播放、decay、进度、序列、时间线、运动状态和 SVG 描边](/zh-Hans/guide/web-orchestration)，以及 [Vue/Nuxt 挂载、按身份管理的列表入场和横向滚动](/zh-Hans/guide/web-collections)。[原生运动状态](/zh-Hans/guide/motion-controllers#paused-replacement)现在可在暂停时移除旧视图后正确恢复替代视图。

Web API 仍为实验性功能，坐标/捕获范围见文档；Mavis 集成另行推进。[安装 RC.8](/zh-Hans/guide/install)，将可选原生包保持为相同版本并重新构建原生应用。请查看[发布说明](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.8)与[剩余验收](/zh-Hans/guide/not-there-yet)。

## 0.1.0-rc.7: Web 布局与完整交互 {#rc-7}

RC.7 新增[颜色、边框、内在尺寸、FLIP 与可定位场景](/zh-Hans/guide/web-visual)、[作用域、指针/视口与 Vue 持续配置](/zh-Hans/guide/web-lifecycle)，以及[浮层几何、共享元素、交互示例与诊断](/zh-Hans/guide/web-interactions)。[展示页](/zh-Hans/guide/showcase) 展示原生实例并接收社区提交。

Web API 仍为实验性功能，坐标/捕获范围见文档；Mavis 集成另行推进。[安装 RC.7](/zh-Hans/guide/install)，将可选原生包保持为相同版本并重新构建原生应用。请查看[发布说明](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.7)与[剩余验收](/zh-Hans/guide/not-there-yet)。

## 0.1.0-rc.6: Web 交互与原生动画 {#rc-6}

RC.6 新增[Web 数值、连续弹簧与拖动/吸附](/zh-Hans/guide/web-dynamic)，以及[映射、几何刷新与滚动](/zh-Hans/guide/web-support)。原生扩展包括[颜色/圆角弹簧](/zh-Hans/guide/live-springs)、[可 seek 场景](/zh-Hans/guide/sequences)、[Flexbox 尺寸](/zh-Hans/guide/size)及[物体间弹簧](/zh-Hans/guide/physics-attachments)。

Web API 仍为实验性功能，Mavis 集成单独推进。[安装 RC.6](/zh-Hans/guide/install) 后请重新构建原生应用，并查看[发布说明](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.6)与[剩余验收](/zh-Hans/guide/not-there-yet)。

## 0.1.0-rc.4：原生合成、恢复与工作表 {#rc-4}

RC.4 让[没有公共周期的无限图层](/zh-Hans/guide/layers)在原生合成器上播放，不再重建四秒窗口，因此 64 个视图的合成在已测手机上从每个边界数百毫秒降为零。它让 [Android 的形状、渐变和模糊](/zh-Hans/guide/shapes)从暂停时刻继续播放，按宿主的安全区域内边距放置[底部工作表](/zh-Hans/guide/bottom-sheet)，并只提供停靠点可执行的句柄操作。

[演示应用](/zh-Hans/guide/demo)现有 **74 个示例，支持四种语言**。[安装 RC.4](/zh-Hans/guide/install) 后请重新构建原生应用。请查看[发布说明](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.4)以及[正式版发布前仍需完成的真机验收](/zh-Hans/guide/not-there-yet)。

## 0.1.0-rc.3：模态、形状与目标 {#_0-1-0-rc-3-modals-shapes-and-targets}

RC.3 新增 [iOS 交互式模态](/zh-Hans/guide/interactive-navigation)，通过[一次原生调用构建 Android 数值关键帧](/zh-Hans/guide/motion-values)，允许[在视图加载前创建形状](/zh-Hans/guide/shapes)，并接受[组件引用作为目标](/zh-Hans/guide/vue)。本版本还让[图库](/zh-Hans/guide/gallery)和[滚动标题](/zh-Hans/guide/scroll-header)适配系统大字体，并完成了[传感器](/zh-Hans/guide/device-sensors)与[绑定/层](/zh-Hans/guide/motion-values)的真机审计。

[演示应用](/zh-Hans/guide/demo)现有 **74 个示例，支持四种语言**。[安装 RC.3](/zh-Hans/guide/install) 后请重新构建原生应用。请查看[发布说明](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.3)以及[正式版发布前仍需完成的真机验收](/zh-Hans/guide/not-there-yet)。

## 0.1.0-rc.2：生命周期与组合修复 {#_0-1-0-rc-2-lifecycle-and-composition-fixes}

RC.2 修复了[尺寸变化与重新加载时的滚动锚点](/zh-Hans/guide/scroll-header)、[应用从后台恢复后的 iOS 返回手势](/zh-Hans/guide/interactive-navigation)、[独立层中 press 的释放行为](/zh-Hans/guide/press#layered-press)以及[原生组合的时序](/zh-Hans/guide/layers)。本版本还包含[原生指针弹簧拖动](/zh-Hans/guide/physics-attachments)和 [Android 图库生命周期验证](/zh-Hans/guide/gallery#android-rotation-and-resume)。

[演示应用](/zh-Hans/guide/demo)现有 **74 个示例，支持四种语言**。[安装 RC.2](/zh-Hans/guide/install) 后请重新构建原生应用。请查看[发布说明](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.2)以及[正式版发布前仍需完成的真机验收](/zh-Hans/guide/not-there-yet)。

## 0.1.0-rc.1：首个候选版本 {#_0-1-0-rc-1-the-first-release-candidate}

0.1.0 的功能范围已冻结。本候选版本包含[共享元素导航](/zh-Hans/guide/shared-navigation)与[联动相册](/zh-Hans/guide/gallery)、原生 [iOS 返回手势](/zh-Hans/guide/interactive-navigation)与 [Android 预测性返回](/zh-Hans/guide/predictive-back)、[滚动组合](/zh-Hans/guide/scroll-header)、[设备传感器](/zh-Hans/guide/device-sensors)、[重力](/zh-Hans/guide/gravity)以及[带约束的圆形物理模拟](/zh-Hans/guide/physics-attachments)。

[矢量绘制与变形](/zh-Hans/guide/shapes)、[模糊动画](/zh-Hans/guide/blur)和 [iOS 26 Liquid Glass](/zh-Hans/guide/glass)也已加入[演示应用](/zh-Hans/guide/demo)，现有 **73 个示例，支持英语、葡萄牙语、西班牙语和简体中文**。升级后请重新编译原生应用。可查看 [RC.1 安装指南](/zh-Hans/guide/install)、[发布说明](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.1)或[正式版发布前的剩余验收工作](/zh-Hans/guide/not-there-yet)。RC 阶段聚焦问题修复、兼容性与真机验证。

<div class="clips">
<Clip name="gallery-ios" caption="iOS 模拟器，英语界面：真实双指缩放和平移、缩放中断、取消关闭，以及重新排序后返回当前缩略图。原始速度。" />
<Clip name="physics-attachments-android" caption="Android 模拟器，英语界面：真实拖动和释放，展示原生牵引、弹簧、碰撞和吸附点。原始速度；不代表真机性能测量。" />
<Clip name="shapes-android" caption="Android 模拟器，英语界面：真实点按绘制矢量描边、变形兼容路径，并中断或暂停播放。原始速度。" />
<Clip name="glass-ios" caption="iOS 26.2 模拟器，英语界面：原生玻璃表面融合与分离，切换材质、中断、暂停和恢复，并应用减少动态效果。真实点按；原始速度。" />
</div>

## 回顾 beta.18 {#earlier-in-beta-18}

[共享布局](/zh-Hans/guide/shared-layout)让具有稳定标识的元素在同一页面的布局之间移动。[交互回放](/zh-Hans/guide/interaction-replay)将弹簧中断、拖动取消以及滚动与底部面板之间的交接记录为回归测试轨迹。[自适应采样](/zh-Hans/guide/transitions)在曲线需要的位置安排原生关键帧；[动画检查器](/zh-Hans/guide/motion-inspector)显示属性归属和原生观测值，支持调整弹簧并复制 TypeScript。该版本将演示应用扩展为 59 个英语和葡萄牙语示例。查看[安装指南](/zh-Hans/guide/install)或[发布说明](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-beta.18)。

<div class="clips">
<Clip name="shared-layout-ios" caption="共享标签指示器、展开的专辑封面与快速反向切换。iOS 模拟器上的真实系统输入，原始速度。" />
<Clip name="scroll-handoff-replay-android" caption="记录滚动与面板之间的交接，回放并发现故意设置的错误检查点。Android 模拟器上的真实 ADB 交互；保持接触的回放不等于系统手势识别器测试。" />
<Clip name="curve-sampling-ios" caption="iOS 模拟器通过原生播放对比自适应采样与固定采样率。快速弹簧特意以四分之一速度播放；数值表示曲线误差，不是 FPS。" />
<Clip name="motion-inspector-android" caption="查看属性归属，调整并暂停弹簧，然后复制 TypeScript。Android 模拟器上的实际输入；原生 View 观测不衡量 GPU 显示时刻或真机 FPS。" />
</div>

## 底部面板、列表与 SceneKit {#bottom-sheet-lists-and-scenekit}

[底部面板](/zh-Hans/guide/bottom-sheet)协调拖动、滚动和键盘；[列表排序](/zh-Hans/guide/reorder)通过原生边缘滚动，在复用单元格中移动条目。在 iOS 上，[环境与着色器](/zh-Hans/guide/scene-shaders)通过原生播放接收光照强度及带类型的 uniform 参数。演示应用还支持浅色、深色和跟随系统的外观。

<div class="clips">
<Clip name="bottom-sheet-ios" caption="拖动、滚动交接、内容增长与键盘跟随。iOS 26 模拟器上的真实 XCTest 输入。" />
<Clip name="reorder-android" caption="对 200 个条目重新排序，展示原生边缘滚动与单元格复用。Android 模拟器上的真实系统触控，原始速度。" />
<Clip name="scene-shaders-ios" caption="通过 SceneKit 原生播放驱动环境光照和标量、向量着色器输入。iOS 模拟器上的真实点按；不代表真机性能测量。" />
<Clip name="showcase-appearance-ios" caption="Jolt 演示应用的浅色、深色主题与圆形过渡。真实 iOS 模拟器录屏。" />
</div>

## 实时弹簧与原生手势 {#live-springs-and-native-gestures}

<div class="clips">
<Clip name="live-springs-ios" caption="原生跟随器的反向运动与独立动画层。iOS 模拟器上的实际交互；此示例的触摸事件仍会进入 JavaScript。" />
<Clip name="live-springs-android" caption="Android 模拟器上的同一弹簧链，展示反向运动与减少动态效果。不代表真机性能测量。" />
<Clip name="gesture-composition-ios" caption="同时进行平移、双指缩放和旋转，随后单击与双击。iOS 模拟器上的实际系统输入。" />
<Clip name="gesture-handoff-android" caption="一次拖动展开面板并滚动内容；反向拖动时交回面板，手指无需离开屏幕。Android 模拟器，垂直 Core ScrollView。" />
</div>

## 尺寸与相机 {#dimensions-and-camera}

<div class="clips">
<Clip name="size-ios" caption="实际宽高与自动尺寸动画，包含文字重排、中断和可用触控区域。iPhone 17 模拟器、iOS 26；中断片段在应用中选择了 0.25 倍速。" />
<Clip name="scene-camera-ios" caption="SceneKit 透视缩放与颜色、光照联动，包含暂停与反向播放。iPhone 17 模拟器、iOS 26，实时录屏。" />
</div>

## 更多动画 {#more-motion}

<div class="clips">
<Clip name="assistant-flow" caption="iOS 上的助手演示。每个动作都由 Jolt 调用驱动。" />
<Clip name="presets" caption="交互演示中的预设、弹簧与交错动画。" />
</div>
