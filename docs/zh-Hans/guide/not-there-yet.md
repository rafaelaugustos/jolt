# 发布状态与限制 {#not-there-yet}

RC.12 新增[指针存在状态、协调属性组、渲染活动与有界绘图](./portable-foundations)，以及[放置目标、可选音频提示、检查/重放与 Web 路径、3D 旋转和阴影](./interaction-depth)。请安装版本一致的软件包并重新构建原生应用。Web 入口仍为实验性功能。

实体指针配件、iPhone 静音开关及较新 Android 设备上的检查器与性能验证仍待完成。旧手机仅提供兼容性证据。延迟/PSS（#405、#406）仍作为技术债务跟踪；发布不证明性能优势，也不解决应用 JavaScript 阻塞。

**当前版本：0.1.0-rc.12。**包含[原生框架适配器](./frameworks)、[新增传感器来源](./device-sensors#vector-sources)、[移动键盘修复](./mobile-web)、[元素相对 Web 滚动区间](./web-support#element-range)、[原生着色器输入与 iOS 本地视频纹理](./image-effects)，以及 [Android 播放改进](./android-performance)。[安装版本一致的软件包](./install)并重新构建原生应用。Web API 仍为实验性功能。

**RC.10 新增：**[Web 渐变、加载与文字](./web-effects)、[粒子、模糊、形状与图像效果](./web-surfaces)、[键盘、面板、导航、物理与图标](./web-platforms)、[重力、触感、传感器、玻璃与按稳定标识返回缩略图](./web-parity)，以及原生 [Core ScrollView 页头](./scroll-header#retained-scrollview)和[已挂载行排序](./reorder#retained-rows)。请重新构建原生应用。Mavis 的采用工作单独进行。

**RC.9 新增：**[Web 手势、缩放、协调滚动/刷新与排序](./web-gestures)，以及[原生保留式绘制通道和混合绑定所有权](./live-springs#extended-live-paint)。升级后请重新构建原生应用。

**RC.8 新增：**[Web 编排与 SVG 描边](./web-orchestration)、[Vue/Nuxt 挂载、列表身份与横向滚动](./web-collections)，以及[暂停时原生视图替换的恢复修复](./motion-controllers#paused-replacement)。

**RC.7 同时提供：**[作用域、指针/视口与 Vue 持续配置](./web-lifecycle)，以及[浮层几何、共享元素、完整示例与诊断](./web-interactions)。Mavis 集成另行推进。

**自 RC.7 起：**[颜色、边框、连续绘制、真实尺寸、FLIP 与可定位场景](./web-visual)扩展此运行时。Web API 仍为实验性功能；完整对等由 [#236](https://github.com/rafaelaugustos/jolt/issues/236) 跟踪。

**0.1.0-rc.12 已发布。** 原生功能保留各自文档中说明的平台限制，正式版验收仍在进行。Web 入口仍为实验性功能；发布并不表示 Mavis 集成完成，也不保证所有原生/Web API 完全一致。

RC.6 包含[Web 连续动画](./web-dynamic)：数值、跟随弹簧及拖动/吸附，以及[数值映射、几何刷新和垂直滚动](./web-support)。Web API 仍为实验性功能。

RC.6 还新增原生[颜色/圆角绑定](./live-springs)、[可 seek 场景](./sequences)、[受限 Flexbox 尺寸动画](./size)和[物体间弹簧](./physics-attachments)。升级后请重新构建原生应用。

RC.5 新增[实验性 Web 播放](./web-runtime)、[可合成按压](./web-press)和 [Vue DOM 适配器](./web-vue)，修复后台恢复及 Android layer 移除问题，并提供[原生下拉刷新](./scroll-header#pull-to-refresh)与滚动/相册读屏焦点修复。Mavis 已完成初始 press/reveal 迁移及共享应用动画证明；RC.6 功能的采用由其[集成 issues](https://github.com/getcortexlabs/mavis-ui/issues/137) 跟踪。

RC.4 在原生节点上合成图层窗口，让 Android 的形状、渐变和模糊从暂停时刻继续播放，按宿主的安全区域内边距放置底部工作表，并只提供停靠点可执行的句柄操作。RC.3 新增了 iOS 上的 `interactiveModal()`、通过一次原生调用构建的 Android 数值关键帧、可在视图加载前创建的形状以及作为目标的组件引用。

[绑定与图层审计](./motion-values#binding-measurements)包含实体 iPhone 和 Android 上的准备/播放测量、自动输入响应起点，以及重复挂载/卸载的内存保留检查。组合窗口开销较高、近似分配计数器失败、Android 缺少温度状态遥测等限制均保留在证据中。结果为已测场景提供指导，不保证通用容量或实际呈现的帧率。 自 RC.4 起，窗口化合成在原生合成器上播放，不再有边界提交；剩余开销是大批关键帧的同步启动，已在同一审计中测量。

## RC.11 已提供的功能 {#available-in-rc-1}

- 实验性[有限 Web 播放](./web-runtime)、[按压](./web-press)和 [Vue DOM 生命周期](./web-vue)，支持可选框架/原生 peer 和安全 SSR 导入。
- [共享元素导航](./shared-navigation)、[共享手势](./shared-gestures)、[返回当前单元格](./return-targets)和[联动相册](./gallery)，支持文档列出的 Frame/ListView/静态图像组合。
- [原生手势组合](./gestures)：平移、双指缩放和旋转，以及支持的垂直 Core ScrollView 手势交接。[拖动约束](./drag)和[照片缩放](./photo-zoom)各有独立的交互约定。
- 使用 Core ListView 或[已挂载的 Core ScrollView 行](./scroll-header#retained-scrollview)的[滚动组合](./scroll-header)，以及驱动原生动画值的[旋转/重力传感器](./device-sensors)。
- [实际尺寸](./size)、[布局变化](./layout)、[动画值](./motion-values)、[可观察的播放进度](./playback)和[时间轴联合控制](./sequences)。
- 通过可选原生插件提供的[外部原生属性](./native-properties)，包括 [SceneKit 光照/材质](./scene-lighting)、[相机视野](./scene-camera)和[环境/着色器输入](./scene-shaders)。
- [重力](./gravity)、[带约束的圆形物理模拟](./physics-attachments)、[矢量绘制与变形](./shapes)、[模糊动画](./blur)和 [Liquid Glass](./glass)，具体平台支持及降级行为见各自文档。

## 当前限制 {#current-limits}

- Web API 仍为实验性功能。快照内容、坐标空间、硬件可用性及浏览器回退均有明确限制。[原生框架适配器](./frameworks)已随 RC.11 发布；稳定的可移植引用仍是独立工作。
- `animateSize()` 支持 StackLayout/GridLayout 以及不换行 row/column FlexboxLayout 的直接子元素，也可用于 ScrollView 内。主轴动画子元素要求 `flexGrow=0`、`flexShrink=0`；父布局分配与交叉轴 stretch 仍具有优先权。每帧通过 JavaScript 测量/布局。复用单元格与共享元素仍不在范围内。
- `drag()` 不提供通用的多指手势组合。平移、双指缩放和旋转请使用 [`gestures()`](./gestures)；[照片缩放](./photo-zoom)则提供专用的缩放、平移和关闭控制器。手势交接适配器支持垂直 Core ScrollView；其他列表/容器组合需要独立的适配器和原生验证。
- 外部属性适配器需要 `@rafaelaugusto/jolt-native`。内置的 SceneKit 相机、光照和材质适配器仅支持 iOS；未内置 Android 3D 渲染器适配器。MapKit 与 MapLibre 的相机单位不同。
- SceneKit 相机视野支持 iOS 上的自动透视投影。正交缩放、自定义投影矩阵和任意镜头控制不属于该适配器的支持范围。
- `seekableTimeline()` 可拖动有限声明式视图/数值场景的进度。回调、触觉、连续跟随器及任意一次性效果不属于该合同；命令式 timeline 保留参与者控制。
- 原生播放的[执行路径](./how-it-works)因 API 而异。原生属性写入不会将渲染器与主线程 JavaScript 隔离。布局、主动订阅、输入和生命周期处理仍有文档所述的 JavaScript 成本。

## 从 RC 到 0.1.0 {#from-rc-to-0-1-0}

下列尚未关闭的验收议题对应的 API 已经发布。正式版发布前，需在 iOS 和 Android 真机上验证所支持的组合：

- **相册（[#117](https://github.com/rafaelaugustos/jolt/issues/117)）：** 缩放/返回中断、复用或删除的目标、旋转、辅助功能，以及反复导航后不残留覆盖层。
- **滚动组合（[#116](https://github.com/rafaelaugustos/jolt/issues/116)）：** 使用已支持的 Core ListView 适配器验证反向滚动/惯性、延迟发生的布局变化、锚点保持和资源清理。
- 发布提交上的通用、iOS 和 Android 回归检查及其负向对照均须通过。验证匹配版本的软件包安装和干净的原生重编译，并在打正式版标签前解决阻碍发布的回归问题。

旋转/重力的初次真机验收见 [#114](https://github.com/rafaelaugustos/jolt/issues/114)及[传感器报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md)。加速度、线性加速度、陀螺仪与磁场来源已随 RC.11 发布；[模拟器验收](./device-sensors#vector-sources)不能证明真机精度或成本。

相册与滚动仍需完成剩余的真机帧间隔、输入响应、内存与辅助功能验证。详情见[相册](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md)与[滚动](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md)报告。模拟器录屏不能代替真机验收。

## 0.1.0 之后 {#after-0-1-0}

后续 RC 聚焦正确性、兼容性、辅助功能、生命周期和文档。未来工作包括任意视图着色器、更多物理关节类型以及更广泛的跨平台模态支持。文档中的原生框架适配器和向量传感器来源已包含在 RC.11 中。

[对比项目](https://github.com/rafaelaugustos/jolt/issues/65)与当前支持范围的发布相互独立。范围更大的[功能议题](https://github.com/rafaelaugustos/jolt/issues)不会扩大正式版支持的组合，也不会改变文档所列的平台降级行为和 JavaScript 成本。
