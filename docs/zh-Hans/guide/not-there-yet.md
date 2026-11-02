# 发布状态与限制 {#not-there-yet}

**RC.6 之后的开发功能：**[颜色、边框、连续绘制、真实尺寸、FLIP 与可定位场景](./web-visual)扩展此运行时，尚未包含在已发布的 RC.6 包中。完整对等仍由 [#236](https://github.com/rafaelaugustos/jolt/issues/236) 跟踪。

**0.1.0-rc.6 已发布。** 原生功能保留各自文档中说明的平台限制，正式版验收仍在进行。Web 入口仍为实验性功能；发布并不表示 Mavis 集成完成，也不保证所有原生/Web API 完全一致。

RC.6 包含[Web 连续动画](./web-dynamic)：数值、跟随弹簧及拖动/吸附，以及[数值映射、几何刷新和垂直滚动](./web-support)。Web API 仍为实验性功能。

RC.6 还新增原生[颜色/圆角绑定](./live-springs)、[可 seek 场景](./sequences)、[受限 Flexbox 尺寸动画](./size)和[物体间弹簧](./physics-attachments)。升级后请重新构建原生应用。

RC.5 新增[实验性 Web 播放](./web-runtime)、[可合成按压](./web-press)和 [Vue DOM 适配器](./web-vue)，修复后台恢复及 Android layer 移除问题，并提供[原生下拉刷新](./scroll-header#pull-to-refresh)与滚动/相册读屏焦点修复。Mavis 已完成初始 press/reveal 迁移及共享应用动画证明；RC.6 功能的采用由其[集成 issues](https://github.com/getcortexlabs/mavis-ui/issues/137) 跟踪。

RC.4 在原生节点上合成图层窗口，让 Android 的形状、渐变和模糊从暂停时刻继续播放，按宿主的安全区域内边距放置底部工作表，并只提供停靠点可执行的句柄操作。RC.3 新增了 iOS 上的 `interactiveModal()`、通过一次原生调用构建的 Android 数值关键帧、可在视图加载前创建的形状以及作为目标的组件引用。

[绑定与图层审计](./motion-values#binding-measurements)包含实体 iPhone 和 Android 上的准备/播放测量、自动输入响应起点，以及重复挂载/卸载的内存保留检查。组合窗口开销较高、近似分配计数器失败、Android 缺少温度状态遥测等限制均保留在证据中。结果为已测场景提供指导，不保证通用容量或实际呈现的帧率。 自 RC.4 起，窗口化合成在原生合成器上播放，不再有边界提交；剩余开销是大批关键帧的同步启动，已在同一审计中测量。

## RC.6 已提供的功能 {#available-in-rc-1}

- 实验性[有限 Web 播放](./web-runtime)、[按压](./web-press)和 [Vue DOM 生命周期](./web-vue)，支持可选框架/原生 peer 和安全 SSR 导入。
- [共享元素导航](./shared-navigation)、[共享手势](./shared-gestures)、[返回当前单元格](./return-targets)和[联动相册](./gallery)，支持文档列出的 Frame/ListView/静态图像组合。
- [原生手势组合](./gestures)：平移、双指缩放和旋转，以及支持的垂直 Core ScrollView 手势交接。[拖动约束](./drag)和[照片缩放](./photo-zoom)各有独立的交互约定。
- 使用 Core ListView 适配器的[滚动组合](./scroll-header)，以及驱动原生动画值的[旋转/重力传感器](./device-sensors)。
- [实际尺寸](./size)、[布局变化](./layout)、[动画值](./motion-values)、[可观察的播放进度](./playback)和[时间轴联合控制](./sequences)。
- 通过可选原生插件提供的[外部原生属性](./native-properties)，包括 [SceneKit 光照/材质](./scene-lighting)、[相机视野](./scene-camera)和[环境/着色器输入](./scene-shaders)。
- [重力](./gravity)、[带约束的圆形物理模拟](./physics-attachments)、[矢量绘制与变形](./shapes)、[模糊动画](./blur)和 [Liquid Glass](./glass)，具体平台支持及降级行为见各自文档。

## 当前限制 {#current-limits}

- 实验性 Web 支持有限 2D 变换/透明度、数值/映射、连续弹簧、单指拖动/吸附、几何刷新与垂直滚动。Web 布局动画、双指缩放/嵌套滚动交接、其他框架适配器及稳定可移植引用仍不在范围内；参见[连续动画](./web-dynamic)及[滚动/几何限制](./web-support)。
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

旋转/重力的首轮真机验收已在 [#114](https://github.com/rafaelaugustos/jolt/issues/114) 完成。[传感器报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md)记录了测试范围及限制。加速度、陀螺仪和磁场输入作为独立工作由 [#256](https://github.com/rafaelaugustos/jolt/issues/256) 跟踪。

相册与滚动仍需完成剩余的真机帧间隔、输入响应、内存与辅助功能验证。详情见[相册](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md)与[滚动](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md)报告。模拟器录屏不能代替真机验收。

## 0.1.0 之后 {#after-0-1-0}

后续 RC 聚焦正确性、兼容性、辅助功能、生命周期清理和文档。新增能力安排在 0.1.0 之后，包括更多框架适配器、任意视图着色器、更多传感器类型、其他类型的物理关节和通用模态导航。

[对比项目](https://github.com/rafaelaugustos/jolt/issues/65)与当前支持范围的发布相互独立。范围更大的[功能议题](https://github.com/rafaelaugustos/jolt/issues)不会扩大正式版支持的组合，也不会改变文档所列的平台降级行为和 JavaScript 成本。
