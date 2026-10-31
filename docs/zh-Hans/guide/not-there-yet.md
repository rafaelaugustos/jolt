# 发布状态与限制 {#not-there-yet}

**0.1.0-rc.4 已发布。** 各项功能已支持对应指南中列出的组合。0.1.0 的功能范围已冻结，正式版的验收工作仍在进行。

RC.4 在原生节点上合成图层窗口，让 Android 的形状、渐变和模糊从暂停时刻继续播放，按宿主的安全区域内边距放置底部工作表，并只提供停靠点可执行的句柄操作。RC.3 新增了 iOS 上的 `interactiveModal()`、通过一次原生调用构建的 Android 数值关键帧、可在视图加载前创建的形状以及作为目标的组件引用。

[绑定与图层审计](./motion-values#binding-measurements)包含实体 iPhone 和 Android 上的准备/播放测量、自动输入响应起点，以及重复挂载/卸载的内存保留检查。组合窗口开销较高、近似分配计数器失败、Android 缺少温度状态遥测等限制均保留在证据中。结果为已测场景提供指导，不保证通用容量或实际呈现的帧率。 自 RC.4 起，窗口化合成在原生合成器上播放，不再有边界提交；剩余开销是大批关键帧的同步启动，已在同一审计中测量。

## RC.4 已提供的功能 {#available-in-rc-1}

- [共享元素导航](./shared-navigation)、[共享手势](./shared-gestures)、[返回当前单元格](./return-targets)和[联动相册](./gallery)，支持文档列出的 Frame/ListView/静态图像组合。
- [原生手势组合](./gestures)：平移、双指缩放和旋转，以及支持的垂直 Core ScrollView 手势交接。[拖动约束](./drag)和[照片缩放](./photo-zoom)各有独立的交互约定。
- 使用 Core ListView 适配器的[滚动组合](./scroll-header)，以及驱动原生动画值的[旋转/重力传感器](./device-sensors)。
- [实际尺寸](./size)、[布局变化](./layout)、[动画值](./motion-values)、[可观察的播放进度](./playback)和[时间轴联合控制](./sequences)。
- 通过可选原生插件提供的[外部原生属性](./native-properties)，包括 [SceneKit 光照/材质](./scene-lighting)、[相机视野](./scene-camera)和[环境/着色器输入](./scene-shaders)。
- [重力](./gravity)、[带约束的圆形物理模拟](./physics-attachments)、[矢量绘制与变形](./shapes)、[模糊动画](./blur)和 [Liquid Glass](./glass)，具体平台支持及降级行为见各自文档。

## 当前限制 {#current-limits}

- `animateSize()` 支持 StackLayout/GridLayout，也可用于 ScrollView 内部，但每帧需要通过 JavaScript 测量并更新布局。弹性空间分配、复用单元格和共享元素不属于该 API 的支持范围。
- `drag()` 不提供通用的多指手势组合。平移、双指缩放和旋转请使用 [`gestures()`](./gestures)；[照片缩放](./photo-zoom)则提供专用的缩放、平移和关闭控制器。手势交接适配器支持垂直 Core ScrollView；其他列表/容器组合需要独立的适配器和原生验证。
- 外部属性适配器需要 `@rafaelaugusto/jolt-native`。内置的 SceneKit 相机、光照和材质适配器仅支持 iOS；未内置 Android 3D 渲染器适配器。MapKit 与 MapLibre 的相机单位不同。
- SceneKit 相机视野支持 iOS 上的自动透视投影。正交缩放、自定义投影矩阵和任意镜头控制不属于该适配器的支持范围。
- 时间轴可统一暂停和恢复其参与者，但不能任意调整回调或一次性效果的整体进度。
- 原生播放的[执行路径](./how-it-works)因 API 而异。原生属性写入不会将渲染器与主线程 JavaScript 隔离。布局、主动订阅、输入和生命周期处理仍有文档所述的 JavaScript 成本。

## 从 RC 到 0.1.0 {#from-rc-to-0-1-0}

下列尚未关闭的验收议题对应的 API 已经发布。正式版发布前，需在 iOS 和 Android 真机上验证所支持的组合：

- **相册（[#117](https://github.com/rafaelaugustos/jolt/issues/117)）：** 缩放/返回中断、复用或删除的目标、旋转、辅助功能，以及反复导航后不残留覆盖层。
- **滚动组合（[#116](https://github.com/rafaelaugustos/jolt/issues/116)）：** 使用已支持的 Core ListView 适配器验证反向滚动/惯性、延迟发生的布局变化、锚点保持和资源清理。
- **传感器（[#114](https://github.com/rafaelaugustos/jolt/issues/114)）：** 实时旋转/重力硬件、方向映射、采样成本和订阅清理。模拟器输入只能验证处理流程，不能验证真实传感器的数据采集。
- 发布提交上的通用、iOS 和 Android 回归检查及其负向对照均须通过。验证匹配版本的软件包安装和干净的原生重编译，并在打正式版标签前解决阻碍发布的回归问题。

帧间隔稳定性、输入响应和保留内存仍需真机证据。已收集的证据与剩余检查见[相册](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md)、[滚动](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md)和[传感器](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md)验证报告。模拟器录屏不能代替真机验收。

## 0.1.0 之后 {#after-0-1-0}

后续 RC 聚焦正确性、兼容性、辅助功能、生命周期清理和文档。新增能力安排在 0.1.0 之后，包括更多框架适配器、任意视图着色器、更多传感器类型、刚体间物理关节和通用模态导航。

[对比项目](https://github.com/rafaelaugustos/jolt/issues/65)与当前支持范围的发布相互独立。范围更大的[功能议题](https://github.com/rafaelaugustos/jolt/issues)不会扩大正式版支持的组合，也不会改变文档所列的平台降级行为和 JavaScript 成本。
