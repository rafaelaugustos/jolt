# 动效精选

[Jolt 首页](/zh-Hans/)与[配方集合](/zh-Hans/recipes/)将互动 Web playground 和原生 Motion Studio 录屏结合起来。按名称搜索、按类别筛选，打开配方即可观看录屏、复制核心 API 示例、查看完整 NativeScript Vue 演示或复制适配提示词。

开场将大字排版与镀铬雕塑结合。雕塑跟随指针，支持点击或键盘旋转，水平拖动后保留惯性。小型 WebGL 渲染器属于网站本身；Jolt 提供运动值、弹簧、指针跟随和惯性拖动。WebGL 不可用或上下文丢失时，矢量雕塑仍可使用。离开视口或页面隐藏时停止渲染。Morrow 的两部手机随页面滚动，主按钮响应指针。Playground 使用现有的实验性 Jolt Web 运行时执行弹簧、交错入场和拖动吸附。运行时随首页加载，离开页面时释放；普通参考文档不加载该运行时。

<Clip name="motion-site-chromium" :width="960" caption="macOS arm64 上的 Chromium：通过真实指针与键盘操作 Jolt 网站，展示镀铬雕塑与惯性拖动、随滚动移动的 Morrow 手机和视频播放、原生视频预览、弹簧打断、交错入场、拖动吸附、配方搜索和复制。浏览器原速录屏。配方视频来自 iOS 模拟器；Morrow 是创作者提供的 iOS 录屏，未指定录制设备。此次浏览器录屏并非原生性能测试。" />

网站遵循系统减少动态效果设置，页脚也提供持久保存的控制开关。预览在悬停或获得焦点时加载，离开卡片、视口或页面时暂停。减少动态效果时不自动播放预览。完整录屏提供标准播放控件。

## 原生录屏

配方使用经过检查的 Motion Studio 原生录屏片段。裁剪不改变播放时间，也不合成动画帧。仓库保留所有原始录屏。

<Clip name="showcase-springs-ios" caption="iOS 26 模拟器：真实 XCTest 点击打断并重新设定原生弹簧目标。原速播放，并非真机性能测试。" />
<Clip name="motion-recipe-drag-ios" caption="iOS 26 模拟器：通过真实 XCTest 拖动与松手，将卡片和面板移动到吸附位置。截取自 showcase-touch-ios 的连续原速片段，并非真机性能测试。" />
<Clip name="motion-recipe-gradients-ios" caption="iOS 26 模拟器：真实 XCTest 输入改变原生渐变。截取自 showcase-visual-ios 的连续原速片段，并非真机性能测试。" />

圆形揭示保留演示中选定的 1600 毫秒时长。彩纸配方展示原生粒子发射器和彩纸爆发。录屏无法传达物理触觉。影片和汽车示例保留原有说明。之前的版本说明及视频保存在[版本历史](./release-history)。

代码示例在构建时直接从版本化指南提取，展示核心 API；完整界面和生命周期实现见链接中的原生演示。提示词包含版本、已记录的导入路径、源码、平台限制、减少动态效果及资源清理要求。原生 API 与实验性 Web API 不可直接互换。配方支持四种语言，搜索与筛选保存在 URL 中，切换语言保留当前配方。

## 复现检查

运行 `npm run docs:check-media` 和 `npm run docs:build`，启动 `npm run docs:preview -- --port 5181`，然后运行 `npm run docs:test-site`。检查覆盖 Chromium、WebKit、真实交互、MP4 播放、复制、筛选、四种语言、桌面与手机宽度、减少动态效果以及导航和重新挂载。结果位于 `/tmp/jolt-motion-site-review`。视觉检查屏蔽分析请求，并使用空列表模拟社区接口，不测试生产环境中的社区服务。

`scripts/motion-recipe-captures.json` 记录来源与准确裁剪区间。使用 `node scripts/prepare-motion-recipe-media.mjs` 通过 FFmpeg 复现片段，使用 `node scripts/record-motion-site.mjs` 通过真实 Playwright 输入录制网站。此次网站改版使用已有 Web 能力，不修改 Mavis 应用代码。
