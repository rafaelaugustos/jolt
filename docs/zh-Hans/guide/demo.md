# 演示应用 {#demo-app}

[`demo/`](https://github.com/rafaelaugustos/jolt/tree/main/demo) 中的 NativeScript-Vue 应用程序使用本地 Jolt 构建。正常启动会打开 **Jolt 运动工作室**：动画品牌宣传片、移动之家以及按运动、触摸、视觉、类型、布局、状态和 SceneKit 分组的 73 个可搜索实验集合。

<Clip name="showcase-splash-ios" caption="真实iOS 26模拟器冷启动：系统启动屏幕引导进入原生动画品牌splash和Studio。在没有 XCTest 发射同步的情况下捕获；原始速度。不是真机性能证据。" />

<Clip name="showcase-ios" caption="真实iOS 26模拟器录屏：弹簧、原生手势、类别过滤、搜索、SceneKit播放和返回导航。实际XCTest输入；原始速度。冷重新启动和安装的图标也会在此剪辑之外进行检查。" />

[Vue 路由器 NS](https://vue-router-ns.rafaelaugusto.dev/guide/splash) 通过原生页面堆栈驱动主页、集合和示例页面。返回到现有的搜索/过滤状态。第一页安装在醒目的下方；启动画面永远不会进入导航历史记录。 Jolt 对其徽标、文字标记和退出进行动画处理，并跳过这些动画以进行缩减运动。 iOS 系统启动屏幕在 JavaScript 启动之前使用相同的纯色背景。

离开时主页动画停止。详细信息页面仅安装选定的实验并在离开时释放它。演示特定的时序控制在留下细节时重置，仅 SceneKit 的实验在 Android 上显示可用性消息。本演练在 iOS 上验证新 shell；它不是 Android 原生验证证据。

iOS 应用程序资源现在位于存储库中，包括 **Jolt** 显示名称和图标。从安装的图标启动无需特殊参数即可打开 Studio。该应用程序需要 Core 9.1.3+ 并为此预览安装 `vue-router-ns@0.1.0-rc.2`。

## 浅色、深色或您的设备 {#light-dark-or-your-device}

点击 Studio 标题中的 **◐** 以选择 **光**、**黑暗** 或 **系统**。该选择会立即更新启动画面、Studio、集合、搜索、语言页面和实验控件，并在关闭应用程序后保持保存状态。 **系统** 遵循设备的外观，包括应用程序打开时的变化。

在 iOS 上，圆形 Jolt 显示从所选控件中打开新主题，下面是以前的外观。系统更改从可见页面的中心显示。简化运动立即应用最终主题； Android 目前会立即切换，因为圆形显示仅限 iOS。

原生艺术作品和动画阶段保留了自己的调色板；更改界面主题不会重新启动正在运行的实验或更改其动画设置。

<Clip name="showcase-appearance-ios" caption="iOS 26.2模拟器：真实的XCTest点击显示所选控件的亮→暗，浏览和搜索集合，玩弹簧，返回光，然后跟踪实时系统外观变化。原始速度。其他原生检查可验证重新启动后的持久性和葡萄牙语标签。这不会建立 Android 或真机验证。" />

## 语言 {#language}

Studio默认遵循手机语言：葡萄牙语使用巴西葡萄牙语，西班牙语变体使用西班牙语，中文变体使用简体中文；不支持的语言使用英语。点击 Studio 顶部的 **语言** 以选择 **关注设备**、**英语**、**葡萄牙语**、**西班牙语** 或 **简体中文**。更改会立即应用，并且关闭应用程序后选择仍然存在。选择 **关注设备** 会删除覆盖；当应用程序恢复时，将再次读取首选语言。

启动画面、集合、所有 73 个实验演示、控件、状态消息和可访问性标签均已本地化。搜索接受翻译名称或英文名称，带或不带重音。滚动帐号使用所选语言的分隔符。 `popIn`等动画API标识符保持不变；孤立的技术游乐场保留了英国的固定装置。

<Clip name="showcase-language-ios" caption="iOS 26模拟器：真正的XCTest点击切换英语→葡萄牙语，搜索不带口音的相机，操作原生相机镜头，然后切换回英语。原始速度。单独的原生检查使用 iOS 首选语言启动设置来验证持久性和自动语言选择；这不会验证 Android 或真机。" />

<Clip name="showcase-portuguese-ios" caption="iOS 26 模拟器上所有 54 个巴西葡萄牙语集合条目，具有代表性的本地交互。以原始速度进行单独捕捉的蒙太奇，包括可选的当地汽车模型。并非所有技术控制都得到执行。" />

<Clip name="showcase-splash-pt-ios" caption="在 iOS 26 模拟器上以葡萄牙语进行真正的冷启动，包括动画启动和本地化 Studio。原始速度，与 XCTest 启动同步分开捕获。" />

## 运动工作室内饰 {#motion-studio-interiors}

现在，该集合将每个实验呈现为交互式组合：用于交错的播放列表、用于滚动数字的帐户、用于拖动值的记录播放器、用于压力反馈的触觉卡以及用于值绑定的协调信号。四个汽车参赛作品保留了他们的 SceneKit 工作室。展示柜有一组集中的控件；孤立的游乐场仍然暴露了详细的探测器和技术选项。

启动画面以扩展环、轨道口音、Jolt 标记和交错文字标记打开，然后显示 Studio。它遵守减速运动并等待初始路线。图库和手势卡中的图像是与应用程序捆绑在一起生成的编辑艺术作品；图像测试仍然使用原来的网格装置。这些是动作演示，而不是银行、音乐或旅游服务。

<div class="clips">
<Clip name="showcase-springs-ios" caption="iOS 26 模拟器：轻击中断弹簧并切换到另一个响应。原始速度。" />
<Clip name="showcase-presets-ios" caption="iOS 26 模拟器：原生海报上的爆裂、震动、弹跳和脉冲。真实的点按；原始速度。" />
<Clip name="showcase-colors-ios" caption="iOS 26 模拟器：背景、文字和边框通过三个调色板进行插值。原始速度。" />
<Clip name="showcase-forms-ios" caption="iOS 26 模拟器：角点、边框、旋转和阴影，包括中间过渡停止。原始速度。" />
</div>

以下蒙太奇在示例之间连接单独的原生捕获。所有交互均使用 iOS 26 模拟器上的真实 XCTest 输入；播放时间不变。它们不建立真机性能或 Android 行为。

<Clip name="showcase-motion-ios" caption="动量、交错、路径、时间线、播放、循环、暂停、有机计时、轨道缓动、缓动曲线和运动设置。设置示例明确选择半速和减速运动。" />
<Clip name="showcase-touch-ios" caption="按住反馈、活弹簧、可拖动的乐谱、触觉请求、照片手势、轮播/滚动切换、拖动/捕捉和键盘跟随作曲家。模拟器显示触觉请求，而不是物理振动。" />
<Clip name="showcase-visual-ios" caption="线性/径向/圆锥渐变、反应渐变情绪和值、闪光、粒子、加载器、显示、淡入淡出/溢出和光迹。 Reveal明确选择1600毫秒；光迹明确选择应用程序的慢动作模式。" />
<Clip name="showcase-type-ios" caption="动画字母和单词、滚动金额、数字计数和字体大小的变化以及原生 SF Symbol 效果。" />
<Clip name="showcase-layout-ios" caption="插入/重新排序/调整卡片大小、实际布局尺寸、重新安装、动画列表行以及链接到原生滚动的相册标题。" />
<Clip name="showcase-state-ios" caption="协调的工作表/背景、观察者、值层、分层运动、上传状态、每个目标转换、Vue 指令和弹簧比较。繁忙的 JavaScript 仅显示其 Android 可用性消息。" />
<Clip name="showcase-images-ios" caption="捆绑艺术品上的真实波纹和溶解效果，然后是原生照片缩放和重置。 iOS 26 simulator;原始速度。" />

### 汽车工作室·iOS {#automotive-studio-·-ios}

三个SceneKit实验共用一个反射工作室。当相机保持在原位时，**相机镜头** 会动画化视野。 **灯光和材料** 改变灯光和车身饰面。 **环境和着色器** 将动画值与环境强度、主光强度、玻璃阴影均匀度和前照灯颜色均匀度绑定。这些是原生 Jolt 适配器； JavaScript 选择目的地并轻按一下即可交换环境图像，而无需观察者每帧设置 SceneKit 属性。

<div class="clips">
<Clip name="showcase-atelier-ios" caption="iOS 26模拟器：镜头转换、中途寻找、恢复和改变主体光洁度。真正原生的SceneKit渲染和XCTest输入；局部详细模型；原始速度。" />
<Clip name="showcase-lighting-ios" caption="iOS 26模拟器：日光、温暖的工作室光、铜漆和夜间照明。局部详细模型；原始速度。" />
<Clip name="showcase-shaders-ios" caption="iOS 26 模拟器：由共享动画值驱动的环境和玻璃/前照灯着色器uniform 参数。局部详细模型；原始速度。这演示了阴影，而不是机舱内部或流体模拟。" />
</div>

**地图和 3D → 时间轴** 沿着一条弯曲的路线穿过所示的海滨。行程、目的地脉搏、进度和延迟的检查点共享时间线并一起暂停。原生地图选项卡仍然为真实地图适配器提供动画。

<Clip name="showcase-journey-ios" caption="iOS 26模拟器：重新设计的协调旅程、暂停/恢复、原生地图和返回汽车摄像头。真实XCTest输入；原始速度；该车选装国产车型。" />

**地图和 3D → 3D 相机** 在 Motion Studio 中使用相同的汽车工作室。其原生姿势适配器可在汽车的两个视图之间移动相机，并具有暂停、恢复、停止和重播功能。切换选项卡会重置显示的进度并在返回时重新创建场景绑定。

<Clip name="showcase-camera-orbit-ios" caption="iOS 26 模拟器：实际的地图和 3D 相机选项卡，在详细的汽车周围移动、暂停/恢复、重播、停止和从时间轴返回。真实XCTest输入；原始速度；可选本地型号。不是真机性能证据。" />

<Clip name="showcase-native-reentry-ios" caption="iOS 26 模拟器：在一个应用程序会话中打开和重新打开所有四个汽车条目。每次返回都会再次安装原生工作室，包括 3D 相机选项卡。真正的XCTest导航；局部详细模型；原始速度。" />

这些录屏中的详细汽车是来自单独的 `jolt-car` 项目的本地预览资产。它是 **未在此存储库中分发**，但其来源/再分发条款未记录。如果本地使用同材质布局的授权模型，则放置在`demo/App_Resources/iOS/preview-car.usdz`；否则演示将使用其程序汽车。工作室环境是用代码绘制的。这些模拟器片段并不是真机性能的证据。

## 辅助示例 {#assistant-example}

`--screen=home` (iOS) 或 `--es screen home` (Android) 仍可使用早期助手。它有三个屏幕：

<div class="clips">
<Clip name="assistant-flow" caption="助手在 iOS 模拟器上重放其流程。" />
<Clip name="assistant-flow-android" caption="Android 仿真器上的流程相同。" />
</div>

<div class="clips">
<Clip name="assistant-chat" caption="iOS 上的 rollTo() 倒计时的音频气泡。" />
<Clip name="assistant-chat-android" caption="Android 倒计时。" />
</div>

- **主页：** 一个字母一个字母的问候语、弹簧驱动的文件卡和一个脉冲搜索按钮。点击卡片或在风扇上滑动即可更改选择。搜索按钮可打开语音。
- **语音：** 一个浮动球体、交错转录和暂停/恢复控件。点击麦克风打开聊天。
- **聊天：** 消息和文件卡分阶段进入。打开文档预览，播放波形预览并观看其时间逐秒滚动，或发送消息。当您切换屏幕时，发送的消息会保留在内存中。

屏幕通过短暂的淡入淡出而变化，一个在下一个进入之前离开。打开主页上的问号按钮，然后打开**观看演示**，以重播语音→聊天→主页→语音。导航、滑动、发送消息或打开预览都会中断重播。

## 运行 {#run}

安装 [NativeScript CLI](https://docs.nativescript.org/setup/)，然后运行：

```sh
# Repository root, in one terminal
npm install
npm run dev

# In another terminal
cd demo
npm install
ns run ios
```

`ns run android` 打开集合。在助手示例中，图标来自 Material Icons 字体而不是 SF Symbols，系统调整键盘窗口而不是键盘观察器，球体保持呼吸运动而不会发生液体变形。

动画游乐场以 iOS 上的 `--playground` 和 Android 上的 `--es playground true` 开始。这保留了早期的单页图库，用于单独的录屏和探测；正常启动使用 Motion Studio。

在 Playground 中打开 **图像效果和照片变焦** 进行波纹、扭曲、溶解和原生照片查看器。在iOS上直接用`--image-lab=effects`或`--image-lab=zoom`启动；在 Android 上使用 `--es image-lab effects` 或 `--es image-lab zoom`。该灯具有一个彩色网格和一个透明的目标角，因此位移、裁剪和 Alpha 都是可见的。查看器包括缩放/重置/关闭按钮、取消和重复重新连接控件。

对于已安装的 iOS 模拟器版本，在启动时传递预览参数：

```sh
xcrun simctl launch booted org.nativescript.jolt --autoplay
xcrun simctl launch booted org.nativescript.jolt --screen=voice
xcrun simctl launch booted org.nativescript.jolt --screen=chat
xcrun simctl launch booted org.nativescript.jolt --playground
```

在 Android 上，相同的名称作为启动意图的字符串附加内容进入：

```sh
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es autoplay true
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es screen chat
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es playground true
```

在使用不同参数启动之前终止正在运行的应用程序。如果没有参数，应用程序将打开 Motion Studio。使用 `--screen=home` 作为助手。

另外两个参数可以帮助评论或录屏在不触摸屏幕的情况下达到一定程度。 `--tap=<text>[,<text>...]` 在两个演示中都适用：它触发第一个视图的点击，其文本或可访问性标签等于每个条目，使用点击处理程序爬到最近的祖先，每 `--every` 毫秒一次（默认情况下为 1200 毫秒）。 `--section=<heading>` 用于游乐场，滚动到标题以该文本开头的第一部分，忽略大小写：

```sh
xcrun simctl launch booted org.nativescript.jolt --playground --section=text --tap=Letters
xcrun simctl launch booted org.nativescript.jolt --playground --section=rolling "--tap=+ 1.10,Random" --every=2000
xcrun simctl launch booted org.nativescript.jolt --screen=home "--tap=Help,Watch demo" --every=2000
```

Android 形式添加 `playground`：

```sh
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es playground true --es section text --es tap Letters
adb shell am start -n org.nativescript.jolt/com.tns.NativeScriptActivity --es tap "Help,Watch demo"
```

## 议案 {#motion}

助手使用公共 Jolt API：`animate()` 用于变换和不透明度，`animateText()` 用于问候语和文字记录，[`rollTo()`](./rolling) 用于音频倒计时，[Vue 条目](./vue) 用于其余部分：每个按钮上的 `v-press`，以及`JoltTransition` 用于屏幕更改 (`mode="out-in"`) 和文档表，在 Vue 将其删除之前淡出。卡牌选择在释放时即刻发生；它不会将动画进度绑定到手势。

原生动画手柄和舞台计时器属于每个安装的屏幕。卸载或暂停应用程序会取消其工作。返回前台会重建当前屏幕。减少运动是 Jolt 通过默认 [`reducedMotion: 'user'`](./configure) 的工作：文本立即出现，变换跳跃和淡入淡出仍然播放。该演示仅在顶部添加内容决策，立即显示分阶段的聊天并跳过其装饰性循环；设置更改会刷新当前屏幕。

## 示例内容 {#sample-content}

这是一个本地 UI 演示。它不记录语音、搜索文件、播放音频或联系服务。模拟文档预览和37秒波形；键入的消息仅持续当前应用程序会话。

球体使用一张透明位图。在 iOS 上，[`liquid()`](./liquid) 通过原生重复扭曲来变形其纹理，而 `animate()` 控制其缩放、旋转、位置和不透明度；在 Android 上，仅播放 `animate()` 动作。暂停会冻结这两个动作。彩色的褶皱来自于艺术品；这是纹理变形而不是流体模拟。

iOS 图标是 SF Symbols。在 Android 上，`Icon.vue` 从与演示捆绑在一起的字体（Apache 许可证 2.0）中绘制具有相同含义的 Material Icons 字形。

操场顶部的调整部分设置了全局 [时间尺度和简化运动偏好](./configure)，因此下面的每个部分都可以慢动作观看，或者变换跳到最后。

游乐场还包括 [播放控制](./playback)：暂停一张卡，选择带有滑块的框架，然后继续，旁边有一个独立的脉冲运行。

随着主 ScrollView 的前进，[滚动链接标题](./scroll-linked) 移动并淡化大标题，露出固定的紧凑标题。向后滚动可将其恢复。

键盘部分显示了固定在操场底部的作曲家； [`followKeyboard()`](./keyboard) 使用软件键盘将其抬起，并在键盘隐藏时将其放回原处。

[时间线演示](./sequences) 将重叠入口、一次一个到达和固定开始时间与重播和停止控制进行比较。

[列表行演示](./lists) 滚动 60 行，这些行在出现时淡入，带有一个用于为每个项目设置一次动画的开关和一个用于交换新项目的按钮。

[小径游乐场](./paths) 遵循三次曲线或弧形轨道，具有方向、重播、暂停/恢复和停止控制。

<Clip name="reorder-pt-ios" caption="本次检查的新内容：第 55 个实验，列表重新排序，在 iOS 模拟器上以葡萄牙语进行。真实拖动、本地邻居移动和按钮替代。" />

[共享布局](./shared-layout) 是本次检查中的实验 56：在不同视图树之间移动选项卡指示器和专辑封面。

[互动回放](./interaction-replay) 是实验 57：记录弹簧或取消的阻力，接受冻结的引擎基线，通过原生探针重放并检测故意错误的检查点。

[曲线精度](./transitions#adaptive-keyframes) 是实验 58：比较自适应和固定速率原生播放、检查点计数并运行原生精度检查。

[运动检查器](./motion-inspector) 是实验 59：选择一个视图而不更改它，比较本地观察结果，识别财产所有者，调整/重播弹簧并复制 TypeScript。

[共享导航](./shared-navigation) 是实验 60：在另一条路线中打开照片或日通卡，然后以原生 Jolt 动作返回到当前来源。

[互动导航](./interactive-navigation) 是实验 61：通过边缘拖动回看，取消，然后在 iOS 上提交返回。

[预测返回](./predictive-back) 是实验 62：原生 Android 边缘进度、取消、守护返回和双语黄昏场景。

[共享手势](./shared-gestures) 是实验 63：图像和卡片遵循原生后退手势，具有取消和可访问按钮。

<Clip name="showcase-languages-ios" caption="iOS 26.2模拟器：真实触感选择西班牙语和简体中文，打开翻译集和原生卷轴合成，然后返回语言选择器。单独的检查涵盖保存的选择和设备语言选择。原速度；没有真机声明。" />
