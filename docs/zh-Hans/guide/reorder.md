# 列表排序 {#reorder-a-list}

按住行手柄，将其移动到列表中，然后松开。当列表滚动到边缘附近时，邻居会腾出空间。即使其原始单元格离开回收的视口，提升的行仍保留在原生快照中。

自 **0.1.0-beta.17** 起在核心包中可用。安装 `@rafaelaugusto/jolt@0.1.0-rc.2` 并重建原生应用程序以包含输入和渲染类。不需要可选的原生属性插件。

<Clip name="reorder-ios" caption="iOS 模拟器，真实的 XCTest 输入：在不等高的行之间拖动，使用按钮移动，并按住底部边缘以继续浏览回收的单元格。原始速度；没有真机声明。" />

<Clip name="reorder-android" caption="Android 模拟器，真实操作系统触摸输入：重新排序 200 项 Core ListView 并将抬起的行保持在手指下方，同时边缘滚动回收其源单元。原始速度。" />

## 一项承诺的举措 {#one-committed-move}

从 `@rafaelaugusto/jolt/reorder` 导入。第一个适配器支持 **扁平垂直 NativeScript 核心 ListView，具有可变行高**。将列表作为 `ReorderSurface` 的唯一直接子代；在 Android 上，这保留了回收单元上方的指针流，而不替换 Core 的触摸监听器。在iOS上，表面是普通的GridLayout。

在Vue应用程序启动时注册一次`ReorderSurface`和`ReorderHandle`：

```ts
import { registerElement } from 'nativescript-vue'
import { ReorderSurface, ReorderHandle } from '@rafaelaugusto/jolt/reorder'

registerElement('ReorderSurface', () => ReorderSurface)
registerElement('ReorderHandle', () => ReorderHandle)
```

在组件中，将数组保持在应用程序状态：

```ts
import { ref, onUnmounted } from 'nativescript-vue'
import type { EventData, ListView } from '@nativescript/core'
import { reorder, type Reorder } from '@rafaelaugusto/jolt/reorder'

type Track = { id: string; title: string }
const tracks = ref<Track[]>(/* your tracks */ [])
let sorting: Reorder<string> | undefined

function loaded(event: EventData) {
  sorting?.dispose()
  sorting = reorder<Track, string>(event.object as ListView, {
    key: (track) => track.id,
    handle: 'dragHandle',
    onCommit({ key, beforeKey }) {
      const moved = tracks.value.find((track) => track.id === key)!
      const next = tracks.value.filter((track) => track.id !== key)
      const index =
        beforeKey === null
          ? next.length
          : next.findIndex((track) => track.id === beforeKey)
      next.splice(index, 0, moved)
      tracks.value = next
    },
  })
}
onUnmounted(() => sorting?.dispose())
```

```vue
<ReorderSurface>
  <ListView :items="tracks" @loaded="loaded">
    <template #default="{ item }">
      <GridLayout columns="*,44" padding="12">
        <Label :text="item.title" textWrap="true" />
        <ReorderHandle
          id="dragHandle"
          col="1"
          text="☷"
          :accessibilityLabel="`Reorder ${item.title}`"
        />
      </GridLayout>
    </template>
  </ListView>
</ReorderSurface>
```

对于每个项目的明确高度，请像演示一样调整内部容器的大小；当 `rowHeight` 自动时，Core 拥有行根并在 Android 上重置其高度。自然文本驱动的高度也有效。

键必须是唯一的字符串或有限的数字。它们识别数据，而不是回收的视图实例或当前数组位置。 `onCommit` 针对更改的子站运行一次并为 `{ key, beforeKey, fromIndex, toIndex }` 供电。 `beforeKey: null`表示追加；索引描述了原始位置和移除后的最终位置。 Jolt 在指针移动期间从不重新排列应用程序数组。同步应用移动以获得即时结果，或保留现有订单以拒绝它。

在提交的移动之后，核心适配器再次解析稳定键，如果需要的话通过原生滚动显示它（当在边缘剪切时以 iOS 为中心），并将焦点返回到其手柄。这种情况会在应用程序重新绑定后发生一次，包括估计的 iOS 行高发生变化时。

## 取消和变更 {#cancellation-and-changes}

替换 `list.items` 或发出 `change` 的可观察源，会在提交过时索引之前取消挂起的拖动。删除已解除的身份报告`removed`；过滤、替换、插入或内容更改报告`data-changed`。对于 **对普通数组的就地更改**，更新/刷新列表并调用 `sorting.refresh()`。当更改行几何形状而不更改项目时也可以调用它。在提交时再次检查身份。

```ts
sorting.cancel() // keep the application order
sorting.pause() // cancel and disable input
sorting.play() // enable input again
sorting.dispose() // restore cells and remove native input/actions
```

未更改的 drop 不会发出任何提交。 `onStart(key)` 和 `onCancel({ key, reason })` 是可选的生命周期回调。取消原因还包括 `cancelled`、`unchanged`、`unloaded`、`disposed`、`disabled` 和 `geometry-changed`。离开页面、将应用程序置于后台、更改视口大小或释放覆盖层和原生框架。控制器通过附加到新加载的原生列表来在卸载/重新加载中幸存下来； `dispose()` 是最终的。

## 键盘和辅助功能 {#keyboard-and-accessibility}

句柄接收原生 **上移** 和 **下移** 辅助功能操作。通过 `accessibility: { moveUp, moveDown }` 提供翻译后的标签。专注的`ReorderHandle`支持**选项/Alt + ↑/↓**。该控制器还公开了 `moveUp(key)`、`moveDown(key)` 和 `move(key, beforeKey)`，因此应用程序可以提供普通的键盘可聚焦按钮，而无需拖动输入。这些遵循相同的提交合同，并针对未更改或丢失的项目返回 `false`。

相邻弹簧和下降过渡遵循 Jolt 的简化运动设置。直接手指跟踪和边缘滚动仍然可用。使用 `longPress`（150–2000 毫秒，默认 350）和 `edge: { size, speed }`（默认 72 DIPs 和 640 DIPs/秒）配置激活和边缘行为。

## 原生边界和支持的内容 {#native-boundary-and-supported-content}

手势跟踪、快照、弹簧位移和边缘滚动在编译的 UIKit/Android 代码中运行。生命周期决策、数据更改、可访问性/键盘移动和正常的核心单元创建/绑定使用 JavaScript。没有 Jolt 指针/帧订阅到 JavaScript；这确实使 **不** 使 UI 免受 JavaScript 阻塞其主线程的影响。

初始路径支持静态文本、图像和普通行容器。快照是静态图像：请勿使用实时相机/视频/金属表面作为拖动预览。 Jolt拥有运行过程中实现的行容器的平移和不透明度；将不相关的动画放在内部视图上。内置部分、粘性标题和搜索均被拒绝。网格、水平列表、跨列表拖动和第三方 CollectionView 插件不在此适配器支持范围内。

`ReorderAdapter<T>`是另一个列表实现的扩展合约：提供`view`、`items()`、`subscribe(changed)`和`attach(config)`。它的驱动程序拥有原生输入、测量的几何形状、快照生命周期、回收单元恢复和滚动，并且仅发出启动/提交/取消生命周期事件。发布适配器需要验证该列表的回收和可访问行为；接受任意观点并不等于支持它。

## ScrollView 中的已挂载行 {#retained-rows}

**自 0.1.0-rc.10 起可用。**传入已有纵向 Core `ScrollView` 内的已挂载 `LayoutBase` 集合。`items()` 返回稳定键、行视图及可选的后代手柄。若最近的 ScrollView 祖先就是目标滚动源，可省略 `scroll`。此重载不需要 `ReorderSurface`。回收式集合继续使用 ListView 适配器。

最多支持 100 个不同的、按顺序排列且互不重叠的可变高度行。原生快照总量限于 1600 万源像素；超限时拒绝拾取。行保持挂载。若预览应不透明，请设置行背景；实时视频/原生 Surface 捕获不在支持范围。应用独立变换保持不变；适配器仅拥有快照和临时透明度。

```ts
import { reorder } from '@rafaelaugusto/jolt/reorder'
const sorting = reorder(contentLayout, {
  scroll: scrollView,
  items: () =>
    tracks.map((track) => ({
      key: track.id,
      target: rowViews.get(track.id)!,
      handle: handleViews.get(track.id),
    })),
  onCommit({ key, beforeKey }) {
    const item = tracks.find((track) => track.id === key)!
    const next = tracks.filter((track) => track.id !== key)
    next.splice(
      beforeKey === null
        ? next.length
        : next.findIndex((track) => track.id === beforeKey),
      0,
      item,
    )
    tracks = next
  },
})
sorting.move('track-3', 'track-1')
// sorting.moveUp(key); sorting.moveDown(key); sorting.cancel(); sorting.dispose()
```

宿主将每次提交应用于自己的带键数据。外部数据变化后，等待渲染器布局并调用 `refresh()`；待更新的原生目标在宿主协调后解析。长按、抬起预览、相邻行弹簧、放下及边缘滚动均由原生代码运行，无逐帧 JS 回调。暂停、取消、数据/几何变化和卸载会释放预览。`ReorderHandle` 提供 Alt/Option + ↑/↓；每个手柄附带本地化的原生上移/下移操作。布局后焦点回到被移动的键。读屏语音和任意变换组合仍需由消费者验证；视频证明模拟器交互正确性，不代表实体设备性能。

<Clip name="retained-scroll-ios" caption="iPhone 17 模拟器，iOS 26，英文 Vue 演示：通过真实 XCTest 操作展示滚动、不同高度行的带键插入、原生手柄拖放及带提交保护的下拉刷新。原速播放；仅验证模拟器正确性。" />

<Clip name="retained-scroll-android" caption="Android 16 / API 36 模拟器，英文 Vue 演示：真实系统触摸展示折叠、保持锚点的插入、已挂载行排序和原生下拉刷新。Debug 应用使用生产版 JavaScript，原速播放；不代表实体设备性能。" />
