# 动效精选

[Jolt 首页](/zh-Hans/)与[配方集合](/zh-Hans/recipes/)将互动 Web playground 和原生 Motion Studio 录屏结合起来。按名称搜索、按类别筛选，打开配方即可观看录屏、复制核心 API 示例、查看完整 NativeScript Vue 演示或复制适配提示词。

开场将大字排版与镀铬雕塑结合。雕塑跟随指针，支持点击或键盘旋转，水平拖动后保留惯性。小型 WebGL 渲染器属于网站本身；Jolt 提供运动值、弹簧、指针跟随和惯性拖动。WebGL 不可用或上下文丢失时，矢量雕塑仍可使用。离开视口或页面隐藏时停止渲染。Morrow 的两部手机随页面滚动，主按钮响应指针。Playground 使用现有的实验性 Jolt Web 运行时执行弹簧、交错入场和拖动吸附。作品展示使用同一运行时驱动滚动场景。参考文档加载一个小型 Jolt 交互，处理标题入场和阅读进度，并在导航时释放。

<Clip name="motion-site-chromium" :width="960" caption="macOS arm64 上的 Chromium：通过真实指针与键盘操作 Jolt 网站，展示镀铬雕塑与惯性拖动、随滚动移动的 Morrow 手机和视频播放、原生视频预览、弹簧打断、交错入场、拖动吸附、配方搜索和复制。浏览器原速录屏。配方视频来自 iOS 模拟器；Morrow 是创作者提供的 iOS 录屏，未指定录制设备。此次浏览器录屏并非原生性能测试。 包含 Morrow 和 Jolt Drive 动效展示、统一文档设计、阅读进度与浅色/深色主题。" />

开场会等待 WebGL 绘制首帧后再显示镀铬雕塑，避免 JavaScript 加载期间闪现绿色备用图形。WebGL 不可用或上下文丢失时仍显示矢量版本；禁用 JavaScript 时保留静态图形。

<Clip name="motion-hero-startup-chromium" :width="960" caption="macOS arm64 上的 Chromium：英文首页加载、重新加载、点击、惯性拖动与减少动态效果。故意将首页模块延迟两秒以展示初始化过程；原速播放，无音频。浏览器录屏，并非原生性能测试。" />

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

首页包含[真机探索性研究](./performance-study)，在同一面板展示 CPU、运行后 PSS 与呈现等待。三项指标均使用默认配置组；动画图表仅展示已存储的数据。精简页脚提供配方、作品、研究、安装及 API 链接，同时保留减少动态效果与返回顶部控件。

Jolt Drive 展示链接到[公开仓库](https://github.com/rafaelaugustos/jolt-drive)和[作品展示](./showcase#jolt-drive)。入场预览保留了原始每帧时间戳。早期 Jolt Car 演示仍可在首页项目卡下方观看，原始录屏保持不变。

<Clip name="jolt-drive-entrance-ios" :width="280" caption="Jolt Drive 的 iOS 车库入场：从项目发布的 GIF 转为 MP4，保留全部 113 帧及其时间戳。录制设备未说明；不用于衡量渲染性能。" />

## 把动效带入你的应用

来自真实项目的四个配方：联动控制台、弹簧驱动的氛围选择、背景模糊的充电面板，以及进入座舱的镜头。每个配方都有原生录屏、已核对的代码和适配提示词。

[探索 4 个配方](/zh-Hans/recipes/?q=Jolt%20Drive) · [阅读集成指南](./drive-recipes)

## Hexdrop

Hexdrop 展示将 Jolt Web 滚动动画与真实原生录屏相结合。[了解项目](./showcase#hexdrop)，或[适配其拖动配方](./hexdrop-recipes)。

<Clip name="hexdrop-creator-ios" :autoplay="false" poster="/media/hexdrop-creator-ios.jpg" :width="280" caption="Hexdrop iOS 创作者录屏：动画开场、拖动、酿制、文档选择与重播。原始速度，无音频；省略最初 3.8 秒的系统主屏幕与启动转场。录制设备未说明。本地演示，不上传文件。" />

## Auralis

[探索两个配方](/zh-Hans/recipes/?q=Auralis) · [Auralis 动效配方](./auralis-recipes)

用光塑造第一印象。悬浮玻璃卡片、虹彩文字，三个自然流转的场景。

<Clip name="auralis-native-ios" :width="320" caption="Auralis iOS 创作者录屏：动画开场、悬浮玻璃卡片、三个引导场景和页面控件。原始速度，无音频；省略最初 4.25 秒的系统主屏幕与启动转场。录制设备未说明；非性能测试。账户和服务均为示意。" />

## Vena

[探索两个配方](/zh-Hans/recipes/?q=Vena) · [查看项目](https://github.com/rafaelaugustos/vena-ns) · [Vena 动效配方](./vena-recipes)

光点织成心脏。二十万个点构成会回应、会跳动的身体，邀你靠近。

<Clip name="vena-native-ios" :autoplay="false" poster="/media/vena-native-ios.jpg" :width="320" caption="Vena iOS 创作者录屏：英文界面、开场、粒子心跳、节奏收藏与心脏聚焦。原始速度，60 fps 导出，无音频；省略最初 3.25 秒的系统主屏幕与启动。录制设备未说明；非性能测试。BPM 数值仅为示意。" />

[BodyParts3D © DBCLS · CC BY 4.0 / MakeHuman · CC0](./vena-recipes#credits)
