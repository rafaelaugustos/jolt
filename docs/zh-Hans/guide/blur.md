# 模糊动画 {#animated-blur}

让背景柔和，同时模式、标题或按钮保持清晰。 `@rafaelaugusto/jolt/blur` 控制拥有的原生效果，其过渡和播放概念与 Jolt 的其余部分相同。自 **0.1.0-rc.1** 起可用；重建两个原生应用程序以包含其编译的帮助程序。

<Clip name="blur-ios" caption="iOS 模拟器：真实的点击在清晰、柔和和完整的材质之间移动、中断动画、暂停/恢复往返并应用“减少运动”。英文界面；原始播放时序。" />
<Clip name="blur-android" caption="Android 12+ 模拟器：相同的控件使内容模糊，而兄弟控件保持清晰。英文UI和真实的ADB点按；原始播放时序，而不是真机性能测量。" />

## 保持前景清晰 {#keep-the-foreground-sharp}

在原生布局后在专用背景/内容视图上创建模糊。将模态内容和控件放置在其上方的同级中，而不是放在模糊视图内。

```ts
import { blur } from '@rafaelaugusto/jolt/blur'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const backdrop = scope.add(
  blur(backgroundView, { amount: 0, radius: 24, style: 'light' }),
)

const reveal = backdrop.animate(1, { duration: 700, ease: 'easeInOut' })
reveal.pause()
reveal.progress = 0.5
reveal.play()

// A new command starts at the currently displayed amount.
backdrop.animate(0, 'smooth')

// At permanent teardown:
scope.dispose()
```

| 选项     | 含义                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------- |
| `amount` | 初始强度0-1，默认0。零清晰。                                                                    |
| `radius` | Android DIPs 中的最大模糊半径，1–64，默认 24。应用的半径为 `amount × radius`。 iOS 忽略此选项。 |
| `style`  | iOS 材质：`system`（默认）、`light` 或 `dark`。 Android 忽略此选项。                            |

选项在句柄的生命周期内保持固定；处置/重新创建以更改它们。一个句柄拥有每个目标。在替换现有播放之前抛出无效的数量/选项/转换。

## 不同的原生材料 {#different-native-materials}

iOS 在目标内容上添加非交互式 `UIVisualEffectView`。暂停的 `UIViewPropertyAnimator` 定义了透明到材料的过渡；已编译的原生显示链接会擦除其 `fractionComplete`。效果遵循目标的边界和角半径。不使用私有模糊半径 API。材质色调、透明度可访问性设置和操作系统样式都会影响外观； 0.5 的量是材料转变的一半，而不是指定的高斯半径。 [苹果的视觉效果查看](https://developer.apple.com/documentation/uikit/uivisualeffectview) 和 [动画师的进展](https://developer.apple.com/documentation/uikit/uiviewanimating/fractioncomplete)。

Android 12 / API 31 及更高版本使用编译的 `ValueAnimator` 来替换视图渲染节点上的 `RenderEffect.createBlurEffect()`。这模糊了该视图及其后代；它对透明覆盖层后面的任意视图进行 **不** 采样。使用应该变得柔和的内容视图。边缘像素使用`CLAMP`。 [Android 渲染效果](https://developer.android.com/reference/android/graphics/RenderEffect)。

在较旧的 Android 版本上，或者没有硬件加速的情况下，回退会使内容保持不变。 `snapshot().backend` 为 `none`，`appliedAmount` 为 0，动画句柄立即完成。回退不会更改不透明度或阻止输入。

Android 句柄独占目标的 `RenderEffect` 插槽，并在处置时将其清除。请勿将其与同一视图上的现有/自定义效果组合：Android 不会公开以前的效果以进行恢复。使用专用包装器。对不同视图的影响可以共存。特定于平台的视频/相机表面不承诺参与视图的模糊。

模糊是一种视觉效果。它不会隐藏辅助功能元素或禁用与底层内容的交互。呈现模式时，应用程序仍然拥有焦点和输入。保持 iOS 效果视图及其祖先处于完全不透明状态，以便正确捕获背景；对材质量进行动画处理，而不是使效果视图褪色。

## 播放和生命周期 {#playback-and-lifecycle}

`animate(amount, transition?)` 接受目标和现有的补间/弹簧过渡、延迟和重复控件。返回的`PlaybackAnimation`支持`finished`、`pause()`、`play()`、`stop()`和有限的`progress`。无限循环支持暂停/恢复但拒绝进度。弹簧继承中断速度并且输出被钳位到 0-1。每个手柄有一个动画；不接受数组和命名附加层。

`set(amount)` 立即应用一个值。 `stop()` 保存显示值。两者都取消之前的句柄（`finished` 解析 `false`）。 `dispose()` 删除拥有的效果、原生播放和生命周期监听器；重复处置是安全的。背景视图的不透明度、变换和输入处理程序保持不变。

后台暂停当前工作。如果 NativeScript 在后台卸载视图，则表面将被释放，暂停的程序将在前台加载后恢复。普通卸载/原生替换会取消播放并重新附加其在加载时保留的数量。显式暂停的播放将保持暂停状态。运动范围可以拥有用于处置的效果或用于暂停的播放手柄。

减少运动立即应用新的目的地。在动画停止期间启用它会处理并应用其请求的目标。不受支持的后备句柄也会立即解决，包括永久重复的请求。

`snapshot()` 按需读取 `amount`、`appliedAmount`、`backend`、`attached`、`nativeAnimations`、`frames`、`width` 和 `height`。它不安装观察者。计数包括保留的暂停原生时钟；分离效果报告零应用量和零播放对象。

JavaScript 准备采样曲线并处理命令、生命周期和完成边界。原生代码更新每帧的效果。两个原生助手都使用 UI 线程；这并不是一个单独的线程、零分配或在 UI 线程被阻塞时不间断播放的承诺。模糊成本取决于视图大小、半径和设备。将效果限制在需要的区域。

四语言**柔焦/慢板**预览是第72个示例。参见 [原生验证和复制](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/blur.md)。
