# 尚未支持的功能 {#not-there-yet}

- [实际宽度/高度/自动转换](./size) 适用于 StackLayout/GridLayout，包括内部 ScrollView。他们每帧运行 JS 布局；弹性分配、回收单元和共享元素不在该 API 范围内。

- [布局更改](./layout)、[拖动约束](./drag)、[动画值](./motion-values)、[可观察回放](./playback) 和 [联合时间轴控件](./sequences) 可用。他们有不同的原生执行和生命周期契约；看看他们的指南。
- [共享导航](./shared-navigation)、[共享手势](./shared-gestures)、[当前单元格返回](./return-targets) 和 [连接画廊](./gallery) 可在其记录的 Frame/ListView/静态图像组合中的 rc.1 中找到。真机库接受情况仍在 [#117](https://github.com/rafaelaugustos/jolt/issues/117) 中进行跟踪。
- 通用多指手势合成仍然在`drag()`之外； [照片变焦](./photo-zoom) 提供自己的捏合、平移和消除控制器。
- [外部属性适配器](./native-properties) 需要可选的原生插件。相机姿态和[光照/纯色材质适配器](./scene-lighting)在iOS上使用SceneKit；没有捆绑的 Android 3D 渲染器适配器。 MapKit 和 MapLibre 相机单元是不同的。
- [SceneKit 相机视野](./scene-camera) 适用于 iOS 上的自动透视相机。正交比例和任意镜头控制保留在该适配器之外。
- 时间线暂停和恢复其参与者，但不提供回调或一次性效果的任意聚合清理。原生写入不会将渲染器与主线程 JavaScript 隔离。

[问题](https://github.com/rafaelaugustos/jolt/issues) 跟踪即将进行的工作和集成。

## 从RC到0.1.0 {#from-rc-to-0-1-0}

rc.1 文档所列的功能范围已冻结，将作为 0.1.0 的发布范围。后续候选版本聚焦正确性、兼容性、辅助功能、生命周期清理和文档。新增能力安排在 0.1.0 之后；范围更大的功能议题不会扩大正式版已承诺支持的组合。

稳定验收前：

- 验证物理 iOS 和 Android 上支持的图库流程：中断缩放/返回、回收或删除目标、旋转、可访问性和重复导航，无需保留覆盖层 ([#117](https://github.com/rafaelaugustos/jolt/issues/117))。
- 在真机上验证核心 ListView 滚动组合，包括反转/滑动、后期布局更改、锚点保存和清理 ([#116](https://github.com/rafaelaugustos/jolt/issues/116))。
- 验证物理 iPhone 和 Android 设备 ([#114](https://github.com/rafaelaugustos/jolt/issues/114)) 上的实时旋转/重力硬件、方向映射、采样成本和订阅清理。模拟器测试输入验证处理，而不是传感器硬件。
- 在发布提交上保持常规、iOS 和 Android 回归检查及其负面控制为绿色；验证匹配的软件包安装和干净的原生重建。在标记稳定之前记录并解决释放阻塞回归。

帧间隔稳定性、输入响应和保留内存仍需真机验证。[对比项目](https://github.com/rafaelaugustos/jolt/issues/65)与当前支持范围的发布相互独立。更多框架适配器、任意视图着色器、其他传感器类型、刚体间物理关节和通用模态导航均属于后续工作。各平台的降级行为和逐帧 JavaScript 成本仍以文档为准；RC 不会扩大这些保证。
