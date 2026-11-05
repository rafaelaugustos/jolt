# Auralis 动效配方

来自 [Auralis](https://github.com/rafaelaugustos/auralis) 的两个模式，核对版本为 `e533eae13cbf5a78d59dcadc4e61f45f28de88f2`，使用 NativeScript-Vue 3 和 Jolt **0.1.0-rc.11**。每个配方提供完整源文件与适配提示词。视频展示创作者的真实 iOS 应用，录制设备未说明。

<Clip name="auralis-native-ios" :width="320" caption="Auralis iOS 创作者录屏：动画开场、悬浮玻璃卡片、三个引导场景和页面控件。原始速度，无音频；省略最初 4.25 秒的系统主屏幕与启动转场。录制设备未说明；非性能测试。账户和服务均为示意。" />

## 跃入光中。 {#cards}

[探索此配方](/zh-Hans/recipes/auralis-cards) · [GitHub](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/choreography.ts)

离场卡片汇入更低的地平线后并淡出，接着新卡片升起。入场有轻微越界回弹和 42 毫秒交错，出场以 26 毫秒反向交错。这些函数只计算运动；AuroraView 负责遮罩、可见性、粒子、时间线和清理。

需要 NativeScript-Vue 3 和 Jolt RC.11。函数返回关键帧与选项，由 AuroraView 放入作用域时间线。提供 CardLayout、两个场景中更低的边界（较大的 y 值）以及卡片索引和总数。几何基于 402 点画布、中心 x=201，需按场景调整或缩放。card.view 负责转场，card.art 负责持续漂浮。保留渲染器的减少动态淡入淡出、生命周期保护和 scope 清理。函数本身不绘制玻璃、文字或粒子，请结合 aurora-view.ts 与 artwork.ts。录屏平台为 iOS。

## 一个时钟，联动场景。 {#clock}

[探索此配方](/zh-Hans/recipes/auralis-clock) · [GitHub](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/composables/useCarouselClock.ts)

一个 motion value 在 4000 毫秒内从 0 变为 1，填充当前指示器并在结束时调用 advance。useOnboarding 在切换前停止时钟，在新场景稳定后重启。toggle 暂停或恢复 scope，代次保护忽略已替换计时器的回调。

在 NativeScript-Vue setup 中调用 useCarouselClock，并传入异步 advance 回调。参照 PageIndicator.vue，将 progress 绑定到指示器的 scaleX，originX 设为 0。导航前调用 hold，场景稳定后调用 start；将 playing/toggle 接到有标签的控件。在 setup 时检测到减少动态效果或屏幕阅读器则默认暂停。保留代次保护、motion scope 和卸载清理。暂停保留当前计时，手动导航重置下次阅读间隔。此 hook 不提供视图、滑动导航或偏好变更监听；协调方式见 useOnboarding.ts。

录屏展示开场、转场、指示器进度和导航。后台恢复与无障碍模式依据已核对源码说明，本视频未展示这些模式。原生 API 与几何并非 Web 实现。

## 源码与集成

- [aurora-view.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/aurora-view.ts)
- [artwork.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/scene/artwork.ts)
- [useOnboarding.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/composables/useOnboarding.ts)
- [PageIndicator.vue](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/components/PageIndicator.vue)
- [onboarding.ts](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/src/onboarding.ts)
- [README.md](https://github.com/rafaelaugustos/auralis/blob/e533eae13cbf5a78d59dcadc4e61f45f28de88f2/README.md)

## 网站动态演示

<Clip name="auralis-site-chromium" :width="960" caption="macOS arm64 上的 Chromium：浏览器操作实录，展示 Auralis 首页、作品展示、原生视频和两个配方，包含代码与提示词复制。原始速度。内嵌视频来自创作者的 iOS 录屏，设备未说明。未改动的社区列表在本地审查中使用空响应。" />
