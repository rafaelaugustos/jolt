# 圆角、边框与阴影 {#corners-borders-and-shadows}

统一边框在 iOS 和 Android 上使用相同的 `animate()` API：

<Clip name="decorations" caption="圆角半径、边框和阴影一起变形。" />

```ts
card.borderRadius = 8
card.borderWidth = 2
card.borderColor = '#b6ee64'

animate(card, { borderRadius: 40, borderWidth: 6 }, { duration: 800 })
```

所有尺寸均为数字 DIPs。数组、`null`、每个属性的转换、弹簧、延迟、重复、交错、序列和选择性停止照常工作。装饰属性默认为 300 毫秒补间。弹簧可能会超调；渲染的半径、宽度和高度被限制为零，阴影不透明度为 0-1。这些范围之外的显式端点将被拒绝。

```ts
animate(card, { borderRadius: 0, rotate: 12 }, 'bouncy')
stop(card, ['borderRadius']) // rotation keeps playing
```

替换从可见值开始。停止会将该值提交给模型并使用 `false` 进行解析。卸载或从外部更改装饰会取消原生播放。 `relative: true` 在开始时将尺寸和阴影参数添加到它们的值中。

## 几何和布局 {#geometry-and-layout}

起始宽度、半径和边缘颜色必须统一。剪切路径和方圆角将被拒绝。不支持单独的角、单独的边缘宽度和任意形状变形。在 `animate()` 更改任何目标之前会检查这些限制。

`borderRadius` 动画背景轮廓；原生内容剪辑遵循 Core 的最终风格。在 iOS 上，半径上限为最短边的一半，并且阴影遵循相同的采样曲线。

`borderWidth` 为视觉笔画设置动画。 NativeScript 立即使用最终宽度布置文本和子项；它不会对填充进行动画处理或重新测量每帧的内容。对于固定内容放置，请在单独的装饰视图上对边框进行动画处理。

## iOS 阴影 {#ios-shadows}

配置一个外部 NativeScript `boxShadow`，然后为其参数设置动画：

```ts
card.boxShadow = '0 4 8 rgba(0, 0, 0, 0.2)'
animate(
  card,
  {
    borderRadius: 40,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffsetX: -8,
    shadowOffsetY: 20,
  },
  { duration: 1000 },
)
```

| 属性                             | 含义                                                              |
| -------------------------------- | ----------------------------------------------------------------- |
| `shadowOpacity`                  | Alpha，从 0 到 1                                                  |
| `shadowRadius`                   | DIPs 中的原生模糊半径； **一半** NativeScript 的 CSS `blurRadius` |
| `shadowOffsetX`, `shadowOffsetY` | DIPs 中的有符号偏移量                                             |

Jolt 对 Core 的阴影层而不是视图的剪裁根层进行动画处理。更改角半径还会为阴影路径及其内部切口设置动画。 Core 重绘后，零不透明度端点保持隐藏状态。阴影颜色和扩散保持不变。对阴影参数进行动画处理需要一个现有的外部阴影；阴影列表、插入阴影、扩散和阴影颜色不会被插值。

## Android 阴影 {#android-shadows}

Android 暴露基于高程的阴影：

```ts
animate(
  card,
  {
    borderRadius: 40,
    elevation: 24,
    translationZ: 8,
  },
  { duration: 1000 },
)
```

`elevation` 写入 NativeScript 的 `androidElevation`。 `translationZ`写入原生动态Z偏移；小部件状态更改可以在播放后替换它。两者均使用 DIPs。 Jolt 在拥有 Z 时暂停小部件的状态动画器，然后恢复它，因此按下状态动画不会与活动动画冲突。阴影外观取决于 Android 的照明、背景轮廓和父剪辑。

在 Android 上设置半径动画时使用高程阴影。核心缓存 CSS `boxShadow` 几何图形，因此带有 CSS 阴影的视图上的 `borderRadius` 会被拒绝。 iOS阴影参数投射到Android上； `elevation` 和 `translationZ` 套在 iOS 上。选择影子属性时在平台上分支。

当动画结束且半径和宽度都为零时，Jolt 会暂时保留一个 Core 可绘制对象用于播放，并恢复最终的纯背景。

半径和宽度重绘 Core 现有的背景可从原生 Java 绘制，保留其图像、渐变和颜色。没有 JavaScript 每帧运行，但 Android 的 UI 线程仍然绘制每一帧； [在该线程上阻塞 JavaScript](./android-performance) 会导致口吃。该帮助器取决于 Core 的可绘制字段：不受支持的原生版本会跳过 `false` 的播放并保留最终模型。安装或升级 Jolt 以包含帮助程序后，重新构建 Android。
