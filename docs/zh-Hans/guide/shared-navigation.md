# 共享元素导航 {#shared-navigation}

`sharedNavigation(frame)` 在同一 NativeScript Frame 中跨两个页面连接 **一张静态图像或普通卡片**。单个原生叠加层带有其位置、大小和圆形剪辑；图像还会插入其显示的内容矩形，包括 `aspectFill` → `aspectFit`。卡片内容交叉淡入淡出，无需拉伸文本。

自 **0.1.0-rc.1** 起可用。安装此版本后重建原生应用程序。这是 [#24](https://github.com/rafaelaugustos/jolt/issues/24) 的首次交付：程序化前进/后退导航。对于 iOS 和 Android 14+ 上的原生交互式图像/卡片返回，请使用 [共享手势](./shared-gestures)。对于回收/屏幕外列表单元，添加 [返回目标解析器](./return-targets)。

<Clip name="shared-navigation-ios" caption="iOS 26.2模拟器：真实的XCTest点击打开一张照片和一张普通的日通卡，然后通过vue-router-ns返回。原生Jolt播放；原来的速度。不是真机性能证据。" />
<Clip name="shared-navigation-pt-ios" caption="iOS 26.2 模拟器：相同的葡萄牙语照片/卡片导航，使用真实的 XCTest 点按和原始速度。" />
<Clip name="shared-navigation-android" caption="Android模拟器：真实的ADB通过vue-router-ns从照片和卡片中点击打开并返回。原生Jolt播放；原来的速度。程序化返回，而不是交互式或预测性返回预览。" />

## 每个 Frame 一名所有者 {#one-owner-per-frame}

```ts
import { sharedNavigation } from '@rafaelaugusto/jolt/shared-navigation'

// Keep this owner for the lifetime of the Frame, not the source page component.
const motion = sharedNavigation(frame, {
  transition: 'smooth', // 'snappy', 'bouncy', or a finite Jolt spring/tween
  navigationTimeout: 3000,
  layoutTimeout: 500,
  maxSnapshotPixels: 8_000_000,
})
```

为源和目标指定相同的 **核心`sharedTransitionTag`**。标签的范围仅限于此 Frame 中的当前页面；嵌套框架被排除。丢失或重复的标签会跳过共享动画并保持路线正常运行。 `sharedTransitionIgnore` 排除视图。

```vue
<!-- Source page -->
<Image
  src="~/images/cove.png"
  sharedTransitionTag="place:42"
  stretch="aspectFill"
  width="170"
  height="210"
  borderRadius="24"
/>
<!-- Destination page: the same decoded local image, with different geometry. -->
<Image
  src="~/images/cove.png"
  sharedTransitionTag="place:42"
  stretch="aspectFit"
  width="320"
  height="440"
  borderRadius="10"
/>
```

在导航之前加载图像。图像模式需要NativeScript `Image`，两端相同的`src`或`ImageSource`，无色调，以及`aspectFill`/`aspectFit`。动画图像、填充失真、仍在加载的远程图像和 GPU 支持的视图都会回落。普通视图容器使用有界原生快照。祖先可以统一滚动或缩放；旋转、半透明、剪裁/离屏和跨窗口几何体不可用。

## 核心 Frame 和 vue-router-ns {#core-frame-and-vue-router-ns}

源捕获后，调用 **恰好一次** 回调。通过其`animated: false`选项：Frame/路由器拥有路由承诺、挂钩和历史记录； Jolt 拥有共享覆盖。请勿将此操作与同一路线上的第二个页面转换、Core `SharedTransition.custom()` 或 UIKit 缩放结合使用。

```ts
const opening = motion.navigate({
  tag: 'place:42',
  navigate: (options) => frame.navigate({ create: createDetailPage, ...options }),
})
const result = await opening.finished

// Return resolves the current source page's tag after layout; no cached view/rect.
await motion.navigate({
  tag: 'place:42',
  navigate: () => frame.goBack(), // entry was created without a page animation
}).finished
```

预览声明和练习**vue-router-ns 0.1.0-rc.2**：

```ts
await motion.navigate({
  tag: 'place:42',
  navigate: (options) => router.push('/places/42', options),
}).finished

await motion.navigate({
  tag: 'place:42',
  navigate: (options) => router.back(options),
}).finished
```

使用单个 Frame/窗口、正常推送/返回以及本次交付中已有的内容。嵌套/模态路由、选项卡、跨框架替换和自动列表项实现不在本合同范围内。演示此编程后端时禁用页面的交互式回扫；控制器外部的系统导航保持路由器的正常行为并取消任何活动的覆盖。

## 所有权和中断 {#ownership-and-interruption}

`state` 是 `idle`、`preparing`、`running` 或 `disposed`。活动时，另一个 `navigate()` 返回 `unavailable` / `busy` **不调用其回调**。禁用重复的导航控件或处理该结果；请求不排队。此阶段不提供连续的后拖重定向。

`finished` 始终满足调用的操作：`completed`、`unavailable`、`cancelled` 或 `failed`，加上 `navigated`、可选的 `reason` 和可选的抛出的 `error`。被拒绝的路由防护报告 `failed`；保持页面不变的已解析守卫报告 `unavailable`。缺失的目标、无效的布局和截止日期恢复了真实的视图。 `cancel()` 仅取消叠加。它永远不会回滚已提交的路由或中止路由器防护；守卫仍然可以稍后完成。

旋转、目的地移动/卸载、另一个导航、应用程序暂停、减少运动激活和 `dispose()` 安全结束叠加。减少的运动会跳过捕捉并执行相同的路线。原生覆盖层不包含在可访问性和触摸定位中；可访问性重点仍然是真实的路由页面。该库不会安装或替换导航控制器委托或操作系统识别器。

准备可以拨打JavaScript。播放时使用原生 `CADisplayLink` / Android `Choreographer` 上的采样 Jolt 轨道，每帧没有 JavaScript 回调或位图副本。这使用 Core 的标签和 Frame 导航边界，而不是 Core 的 `SharedTransition` 计时助手，其特定于平台的 spring/crop 行为无法一致地表达此契约。它是 **不** 围绕 iOS 18 UIKit 变焦的适配器，并且它没有声称不透明 UIKit 弹簧参数等于 Jolt 物理特性。

默认组合捕捉预算为 800 万像素（约 32 MB RGBA），上限为 3200 万像素。每次等待都是有限的；原生播放时长上限为 30 秒。废弃Frame时处置主人； Frame卸载自动处理。使用 [共享布局 API](./shared-layout) 进行一页内的更改。

对于稳定页面上与原生后退手势相关的图像/卡片运动，请使用 [共享手势](./shared-gestures)。
