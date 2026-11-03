# Hexdrop 动效配方

[Hexdrop](https://github.com/rafaelaugustos/hexdrop) 将文件卡片变为原生魔药的原料。配方保留提交 `ebdc02a2652051c982779ea43ba3d76cf99bb538` 中完整的 `useIngredientDrag.ts`，使用 NativeScript-Vue 3 和 Jolt **0.1.0-rc.11**。

## 拖动，抵达目标 {#ingredient-drag}

[获取拖动配方](/zh-Hans/recipes/hexdrop-drag) · [GitHub](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/composables/useIngredientDrag.ts)

Jolt 的 `drag()` 跟踪卡片，投放被拒绝时由 `snap: [0]` 将其弹回。应用把卡片缩放为 0.86，随水平移动倾斜，并在窗口坐标系中比较变换后的矩形与瓶子边界。投放成功后，暂停手势控制器，在 200 毫秒内吸收卡片，然后调用 `onDrop`。

<Clip name="hexdrop-native-ios" :width="320" caption="Hexdrop · iPhone 17 Pro 模拟器，iOS 26.2。真实 idb 拖动：弹回、成功投放、点火、填充和瓶塞摆动。英文界面，原始速度，无声录屏。仅为本地交互演示，不上传文件。非真机性能测试。" />

在组件 setup 中调用 `useIngredientDrag`，将 `loaded` 和 `tap` 连接到原生卡片。提供 `disabled`、返回窗口坐标边界的 `target()`，以及 `onStart`、`onHover`、`onDrop` 回调。从固定版本的几何模块复制 `transformedRect`、`intersects` 和 `Rect` 类型；完整集成见面板组件。Jolt 提供拖动机制，应用定义投放规则。

将手势控制器与动画 scope 分开，重置视觉反馈不能移除输入。保留吸收阶段的代次保护、松手位置检查、拖动后的 tap 抑制，以及后台和卸载清理。取消或销毁后的投放不能延迟触发酿制。点击卡片和 Brew potion 按钮提供拖动之外的操作方式，适配时应保留。

复制的 hook 不绘制魔药，也不上传文件。完整原生场景在 `potion-view.ts` 中：540 毫秒点火、由 motion value 驱动的 8.4 秒填充、液体路径形变、粒子和转移到瓶塞轴心的小蜘蛛。场景自身负责生命周期和减少动态效果。请运行完整项目查看这些图形。录屏仅验证 iOS 模拟器，未展示 Android 或 Web。

## 共享时钟的开场 {#launch}

[开场的小魔法。](/zh-Hans/recipes/hexdrop-launch) · [GitHub](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/launch/launch-animation.ts)

1550 毫秒时间线叠加悬浮图案、径向光晕、六边形描边、粒子和标题字幕入场。reveal 挂载真实内容后，320 毫秒淡出移除遮罩。减少动态效果开启时，跳过特效，仅短暂停留后淡出。请结合下方组件结构和资源复制完整源码。

<Clip name="hexdrop-launch-ios" :width="320" caption="Hexdrop iOS 开场：创作者录屏中 3.8 至 7.0 秒的片段。悬浮图案、印记描边、粒子、光波与应用揭示。英文界面，原始速度，无音频。录制设备未说明；非性能测试。" />

需要 NativeScript-Vue 3 和 Jolt RC.11。提供挂载并测量后的原生 GridLayout、LaunchScreen.vue 的子视图 ID、样式和 hexdrop-mark.png。绘图表面保持固定边界，变换其容器。reveal 回调挂载内容并等待 nextTick 后淡出遮罩。保留返回句柄，等待 finished，永久卸载时调用 dispose；保留减少动态效果和故障回退分支。系统启动屏是静态的；NativeScript 就绪后才播放此时间线。仅验证 iOS 模拟器。

[LaunchScreen.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/components/LaunchScreen.vue) · [App.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/App.vue) · [hexdrop-mark.png](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/assets/hexdrop-mark.png)

## 源码与集成

- [useIngredientDrag.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/composables/useIngredientDrag.ts)
- [geometry.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/potion/geometry.ts)
- [IngredientPanel.vue](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/components/IngredientPanel.vue)
- [potion-view.ts](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/potion/potion-view.ts)
- [README](https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/README.md)

## 网站动态演示

<Clip name="hexdrop-site-chromium" :width="960" caption="macOS arm64 上的 Chromium。真实指针与键盘操作 Hexdrop 首页展示、作品展示和配方，包括复制代码与提示词。原始速度。内嵌视频包括创作者的 iOS 录屏（设备未说明）及 iPhone 17 Pro 模拟器的拖动配方；并非 Web 移植。未改动的社区列表在本地测试中使用隔离的空响应。" />

<Clip name="hexdrop-creator-ios" :width="320" caption="Hexdrop iOS 创作者录屏：动画开场、拖动、酿制、文档选择与重播。原始速度，无音频；省略最初 3.8 秒的系统主屏幕与启动转场。录制设备未说明。本地演示，不上传文件。" />
