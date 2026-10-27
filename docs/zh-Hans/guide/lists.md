# 列表行 {#list-rows}

在每行设置一个入口 `ListView` 当它滚动到视图中时：

<Clip name="lists-android" caption="Android 上的行随着列表滚动而淡入。" />

```ts
import { animateItems } from '@rafaelaugusto/jolt'

const unlink = animateItems(listView, 'fadeInUp')
```

列表中的每一行都会播放动画，具有与 [`animate()`](./animating) 相同的关键帧、预设和过渡。不在屏幕上的行会立即获取其第一个关键帧，并在列表布局后播放，因此首先不会以完全不透明的方式闪烁。

```ts
animateItems(listView, { opacity: [0, 1], x: [-16, 0] }, { duration: 250 })
animateItems(listView, 'popIn', 'bouncy')
```

每行出现时都会自行动画，因此 `stagger` 没有任何空间可以分隔并被拒绝。

## Recycled rows {#recycled-rows}

列表在滚动时重用一些行视图。当一行被另一个项目重复使用时，Jolt 会停止仍在播放的任何内容，并从第一个关键帧再次开始入口。由您自己的代码启动的行动画的其余部分将保持不变。

对于 `once`，每个数据项仅在第一次出现时才会显示动画。已显示的项目重复使用的行将在最终值处结算：

```ts
animateItems(listView, 'fadeInUp', { once: true })
```

项目通过标识进行跟踪：当您保持相同的引用时，对象将被视为相同的项目，并且原始项目通过其索引来记住。用新对象替换这些项目会再次使它们具有动画效果。

## 其中列出 {#which-lists}

目标是核心`ListView`，或者任何用行的`index`和`view`通知`itemLoading`并通过`eachChildView`列出其实现的行的任何东西，这也是社区CollectionView的契约。分段列表报告带有索引的部分。包装目标（例如 NativeScript-Vue 模板引用）的工作方式与 `animate()` 相同。

## 清理 {#cleanup}

返回值是幂等清理函数：

```ts
unlink() // stop listening and settle every row at its end values
```

卸载列表也会消除该影响，因此缓存的页面在返回时需要新的调用。行在它们显示的值处停止，然后移动到动画将达到的最终值，因此没有行保持半淡入淡出。取决于视图的最终值（例如 `null` 关键帧、相对动画和运动路径）保留在它们停止的位置。
