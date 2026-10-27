# Liquid Glass {#liquid-glass}

将控件移近，让 iOS 融合它们的表面。`@rafaelaugusto/jolt/glass` 提供 `GlassContainer` 和 `GlassView`，这两个 NativeScript 布局容器可直接配合现有的 `animate()` API 使用。从 **0.1.0-rc.1** 开始提供。

<Clip name="glass-ios" caption="iOS 26.2 模拟器：真实的点按合并和分离三个原生玻璃表面、更改材料、中断运动、暂停/恢复和应用“减少运动”。英文界面；原始速度。" />
<Clip name="glass-android" caption="Android API 36 模拟器：与明确样式的经典卡片相同的布局、移动和触摸交互。 Android 没有 Liquid Glass 或融合。英文UI和真实的ADB点按；原始速度。" />

<Clip name="glass-legacy-ios" caption="iOS 18.6 模拟器：普通圆形模糊表面保留内容、输入和运动，无需 Liquid Glass 融合。英文界面，真实触感；原始速度。" />

## 共享表面 {#a-shared-surface}

使用 NativeScript-Vue 时注册一次布局：

```ts
import { registerElement } from 'nativescript-vue'
import { GlassContainer, GlassView } from '@rafaelaugusto/jolt/glass'

registerElement('GlassContainer', () => GlassContainer)
registerElement('GlassView', () => GlassView)
```

```vue
<GlassContainer height="160" glassSpacing="26">
  <GlassView id="left" width="72" height="72" translateX="-104"
    glassInteractive="true">
    <Label text="✦" textAlignment="center" verticalAlignment="center" />
  </GlassView>
  <GlassView id="right" width="72" height="72" translateX="104"
    glassInteractive="true">
    <Label text="＋" textAlignment="center" verticalAlignment="center" />
  </GlassView>
</GlassContainer>
```

加载视图后，将原生 **NativeScript 查看实例** 传递给 Jolt：

```ts
import { animate, motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
scope.add(animate(left, { x: -36 }, 'smooth'))
scope.add(animate(right, { x: 36 }, 'smooth'))

// In your application suspend/resume handlers:
// scope.suspend()
// scope.resume()

// At permanent component teardown:
// scope.dispose()
```

在 NativeScript Core 中，直接构造这些类并正常调用 `addChild()` 即可。`GlassView` 是一个 `GridLayout`，可包含标签、图标和控件。玻璃元素应直接放在同一个 `GlassContainer` 中。布局会将子视图放入各原生效果的 `contentView`，同时保留 NativeScript 对视图、布局和输入的管理。

在 iOS 26+ 上，容器使用 `UIGlassContainerEffect`，每个表面使用 `UIGlassEffect`。将元素移得更近会改变它们共享材料的形状。 UIKit 根据几何形状和间距决定混合； Jolt 对视图进行动画处理。请参见 [苹果的玻璃容器](https://developer.apple.com/documentation/uikit/uiglasscontainereffect) 和 [自定义 Liquid Glass 视图](https://developer.apple.com/videos/play/wwdc2025/284/)。

## 属性 {#properties}

| 属性                   | 默认        | 含义                                                              |
| ---------------------- | ----------- | ----------------------------------------------------------------- |
| 集装箱`glassSpacing`   | `16`        | DIPs 中附近玻璃混合的距离，0–200。                                |
| 查看`glassStyle`       | `'regular'` | `'regular'` 或 `'clear'`、iOS 26+。                               |
| 查看`glassRadius`      | `'capsule'` | DIPs 中的胶囊或圆角半径，0–1000。适用于 iOS。                     |
| 查看`glassTint`        | `undefined` | Jolt `ColorValue`; `null`/`undefined` 清除色调。 iOS 26+。        |
| 查看`glassInteractive` | `false`     | 对触摸的原生响应，iOS 26+。不安装点按处理程序。                   |
| 查看`glassFallback`    | `'blur'`    | `'blur'` 或 `'none'` 在 iOS 之前 26. Android 始终不使用任何效果。 |

数值属性接受数字，也接受声明式标记中的数字字符串。`glassInteractive` 还接受 `'true'` 和 `'false'`。无效值会在替换材质前抛出错误。属性变更会立即配置原生材质，并非独立的动画通道。原生玻璃圆角应使用 `glassRadius`，避免与 CSS 裁剪或遮罩冲突。

`supportsLiquidGlass()` 检查操作系统和可用的 NativeScript 元数据。只读 `glassBackend` 报告所选功能：容器 `'liquid-glass'`/`'none'`，视图 `'liquid-glass'`/`'blur'`/`'none'`。它描述配置，而不是描述卸载的视图当前是否正在渲染。

## 平台和生命周期 {#platforms-and-lifecycle}

使用 Xcode 和 NativeScript iOS 元数据构建，支持 UIKit 26 以使用 Liquid Glass。在较旧的 iOS 运行时上，每个表面都使用普通的 `UIBlurEffect`，除非 `glassFallback="none"`；容器没有任何影响，表面也不会融合。在 Android 上，两个类别都保持正常的 `GridLayout`：内容和交互仍然可用，没有模糊或融合。与预览一样，为 Android 设置显式背景和 `borderRadius`。回退也在 iOS 18.6 模拟器上运行。

保持玻璃及其祖先的不透明度为 1，并避免剪切容器的混合区域。不支持淡化效果视图来淡化其材质。 UIKit操作系统无障碍外观；检查与实际背景的对比度。 [Apple 的效果视图指南](https://developer.apple.com/documentation/uikit/uivisualeffectview)。

使用现有的变换播放机制即可支持中断、弹簧、延迟、重复、暂停、进度调整和减少动态效果。将返回的动画交给动画作用域管理；若需要跨越应用进入后台的过程继续保留动画，请接入作用域的挂起和恢复方法。效果在视图卸载或释放时清除，在重新加载时按最新配置恢复；普通动画的卸载沿用 Jolt 现有的取消行为。

JavaScript 配置材质并准备动画曲线。 UIKit 渲染玻璃；现有的原生变换播放可增强运动效果。没有新的 JavaScript 框架循环、原生帮助程序或依赖项。这不是任意的 SVG 路径变形、模糊半径动画 API 或真机性能测量。对于这些不同的操作，请参见 [形状](./shapes)、[动画模糊](./blur) 和 [液体图像变形](./liquid)。

四语言 **更好/仍然** 预览是示例 73.[本地检查和复制](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/glass.md)。
