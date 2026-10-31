---
layout: home
hero:
  text: 让 NativeScript<br>动起来。
  tagline: 预设、弹簧、关键帧和交错动画，一次调用即可驱动 NativeScript 视图。视图动画采用原生播放；内容需要重新排布时，使用实际布局变化。
  image:
    light: /logo.png
    dark: /logo-dark.png
    alt: Jolt
  actions:
    - theme: brand
      text: 开始使用
      link: /zh-Hans/guide/install
    - theme: alt
      text: 认识 Jolt
      link: /zh-Hans/guide/
    - theme: alt
      text: 动画预设
      link: /zh-Hans/guide/presets
homeVideos:
  title: '看看 Jolt 如何动起来。'
  description: '用一分钟认识项目，再观看原生应用的实际演示。'
  items:
    - name: jolt-nativescript-film
      label: '宣传片'
      title: 'This is NativeScript.'
      duration: '1:00'
      width: 1920
      height: 1080
      caption: '一分钟展示 Jolt 和 Motion Studio，使用真实 iOS 模拟器录屏，配以宣传片剪辑和音乐。SceneKit 场景仅适用于 iOS。'
    - name: jolt-tesla-demo-ios
      label: '应用示例'
      title: '灵感来自 Tesla。'
      duration: '2:04'
      width: 720
      height: 1566
      caption: 'iOS 模拟器录屏：灵感来自 Tesla 的示例应用，展示 3D 汽车、空调控制和接驾行程。保持原始播放速度；仅为演示界面，不连接真实车辆。'

features:
  - title: 一次调用
    details: "animate(card, 'fadeInUp')、animate(button, { scale: 1.1 }, 'bouncy')、animate(rows, 'fadeInUp', { stagger: 40 })。大多数界面只需要这些 API。"
  - title: 真实物理弹簧
    details: 可以按手感、弹跳程度和时长配置，也可以指定刚度、阻尼和质量。弹簧动画被中断时会保留速度。
  - title: 关键帧与分段缓动
    details: 为数值列表指定准确时间，为每段配置缓动、三次贝塞尔曲线或自定义函数。自定义缓动只计算一次，无需每帧执行。
  - title: 原生视图动画
    details: 常规视图轨道在 iOS 上通过 Core Animation、在 Android 上通过 ObjectAnimator 播放，无需逐帧运行 JavaScript。布局和交互 API 会分别说明各自的执行成本。
  - title: 序列、交错与按压
    details: 当前一步看起来已经结束时启动下一步；从开头、末尾或中央交错播放；滚动接管交互时，按压效果会自动释放。
  - title: 平滑中断
    details: 为正在变化的属性启动新动画时，会从屏幕上的当前值和速度继续。
  - title: 实时弹簧
    details: 目标变化时，原生跟随器仍保留位置和速度，并支持映射、分层以及按作用域清理。
    link: /zh-Hans/guide/live-springs
  - title: 原生手势
    details: 组合平移、双指缩放和旋转，与列表协调手势轴，并在面板和 ScrollView 之间交接拖动。
    link: /zh-Hans/guide/gestures
  - title: 实际尺寸
    details: 为 width、height 和 auto 添加动画。文字随尺寸重新排布，相邻控件同步移动。每帧使用 JavaScript 更新布局。
    link: /zh-Hans/guide/size
  - title: SceneKit 相机缩放
    details: 通过可选的原生插件，在 iOS 上协调透视视野、颜色、光照和相机姿态的动画。
    link: /zh-Hans/guide/scene-camera
---

## 0.1.0-rc.3：模态、形状与目标 {#release-candidate}

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
