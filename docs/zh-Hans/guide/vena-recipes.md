# Vena 动效配方

光点织成心脏。二十万个点构成会回应、会跳动的身体，邀你靠近。

Rafael Augusto 使用 NativeScript-Vue 与 Jolt RC.11 创作。SceneKit 绘制 16 万个躯干点与 4 万个心脏点，并增加心脏辉光层。Jolt 控制着色器参数、聚焦和界面动效。粒子场景仅支持 iOS。节奏为示例，不测量心率，也不连接 HealthKit。

[探索两个配方](/zh-Hans/recipes/?q=Vena) · [查看项目](https://github.com/rafaelaugustos/vena-ns)

<Clip name="vena-native-ios" :autoplay="false" poster="/media/vena-native-ios.jpg" :width="320" caption="Vena iOS 创作者录屏：英文界面、开场、粒子心跳、节奏收藏与心脏聚焦。原始速度，60 fps 导出，无音频；省略最初 3.25 秒的系统主屏幕与启动。录制设备未说明；非性能测试。BPM 数值仅为示意。" />

## 属于你的节奏。 {#opening}

[属于你的节奏。](/zh-Hans/recipes/vena-opening) · [GitHub](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/motion/entrance.ts)

opening 协调标题、说明、跳过按钮和矢量信号的 strokeEnd。revealInterface 通过一条时间线呈现页头、卡片、页脚与提示。WelcomeOverlay 等待视图加载，清理后忽略完成回调，并支持跳过。心脏成形由 App.vue 单独协调。录屏展示正常开场；减少动态与卸载行为依据源码说明。

需要 NativeScript-Vue 3 和 Jolt RC.11。向 opening 传入四个已加载的原生视图；title、caption、skip 初始 opacity 为 0。rule 承载 190×30 路径。WelcomeOverlay.vue 展示完成、跳过和清理保护。revealInterface 接收自有 MotionScope 及四个已挂载视图。卸载时清理 opening 返回对象和界面 scope。此文件只负责文字、路径与界面入场；粒子心脏需要 HeartScene 及其资源。保留减少动态处理。录屏平台为 iOS。

## 光点织成的心脏。 {#heart}

[光点织成的心脏。](/zh-Hans/recipes/vena-heart) · [GitHub](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/scene-view.ios.ts)

motionValue 以 60000 / bpm 毫秒周期从 0 到 1 循环，并绑定 beat 参数。独立的 ripple 与 heartTap 使点击波纹不打断自动心跳。弹簧驱动聚焦、指针位置和旋转。GPU 着色器变形点云，JavaScript 不逐帧更新每个点。录屏展示心跳与聚焦变化；挂起/恢复、减少动态及指针辅助设置依据源码评审，未在视频中作为独立用例验证。

仅限 iOS：NativeScript-Vue 3、Jolt RC.11、其原生配套包及 SceneKit。完整 HeartScene 类依赖 shaders.ts、anatomy.ts、cloud-data.ts、heart-space.ts、pointer.ios.ts、simulator-pointer.ios.ts 和 torso.bin/heart.bin。视图注册及 sceneReady 接线见固定提交的仓库。Jolt 控制 float/float2/float3 着色器参数，SceneKit 渲染点云。保留动态姿态命中检测、独立心跳与点击时钟、渲染开关、减少动态、挂起/恢复以及监听器、属性、scope 清理。模拟器悬停依赖仅开发时使用的 Swift 工具，并非手机触控。保留 BodyParts3D © DBCLS CC BY 4.0 署名与 MakeHuman CC0 来源。此配方不提供 Android 或 Web 渲染器。

## 源码与集成

- [src/App.vue](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/App.vue)
- [src/components/WelcomeOverlay.vue](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/components/WelcomeOverlay.vue)
- [src/scene/shaders.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/shaders.ts)
- [src/scene/anatomy.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/anatomy.ts)
- [src/scene/cloud-data.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/cloud-data.ts)
- [src/scene/heart-space.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/heart-space.ts)
- [src/scene/pointer.ios.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/pointer.ios.ts)
- [src/scene/simulator-pointer.ios.ts](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/scene/simulator-pointer.ios.ts)
- [src/assets/anatomy](https://github.com/rafaelaugustos/vena-ns/tree/9b4b41948d14ef5168f91ec7c9805df5a046daec/src/assets/anatomy)
- [README.md](https://github.com/rafaelaugustos/vena-ns/blob/9b4b41948d14ef5168f91ec7c9805df5a046daec/README.md)

## 署名 {#credits}

心脏：BodyParts3D © The Database Center for Life Science（DBCLS），采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，由 OrganUI 预处理。Vena 将外表面采样为 4 万个点，省略腔体，改变缩放、位置与颜色，并加入艺术化变形与光照。躯干：MakeHuman hm08，CC0；调整姿势、裁剪并采样为 16 万个点。本站仅裁剪、压缩录屏及截取静帧，不修改解剖模型。[完整署名、来源及修改说明](/media/vena-attribution.txt)。DBCLS 不为本演示背书。

## 网站动效

<Clip name="vena-site-chromium" :width="960" caption="macOS arm64 上的 Chromium：Vena 首页滚动动效、原生视频播放、展示页及两个配方页的代码与提示词复制。浏览器原速录屏；内嵌 iOS 视频由创作者提供，英文界面，设备未说明。社区列表在本地评审中使用空数据。" />
