# 底部面板 {#bottom-sheet}

`bottomSheet()` 在可选的页内配方中结合了原生拖动、滚动切换、弹簧、背景和键盘跟随。从`@rafaelaugusto/jolt/bottom-sheet`导入；它不会将工作表添加到核心入口点。

自 **0.1.0-beta.17** 起在核心包中可用。安装 `@rafaelaugusto/jolt@0.1.0-rc.2` 并重建原生应用程序以包含原生联系人回调。不需要可选的原生属性插件。

将 `GestureSurface` 直接放置在全尺寸单电池 `GridLayout` 内。在面板内部放置一个单独的手柄和一个垂直的NativeScript `ScrollView`。背景是它后面的兄弟姐妹。应用程序拥有这些视图及其外观。

```ts
import { bottomSheet } from '@rafaelaugusto/jolt/bottom-sheet'
import { motionScope } from '@rafaelaugusto/jolt'

const scope = motionScope()
const sheet = scope.add(
  bottomSheet(panel, {
    handle,
    scrollView: results,
    snap: ['content', '50%', '90%'],
    backdrop,
    returnFocus: openButton,
    keyboard: 'follow',
  }),
)

sheet.open('50%')
sheet.expand() // Next larger resolved stop
sheet.collapse() // Next smaller stop, then dismiss
sheet.dismiss()
// On component destruction:
scope.dispose()
```

句柄是一个单独的可访问视图，因此使其可操作不会将工作表的子级折叠到一个屏幕阅读器元素中。 `GestureSurface` 也从底部工作表入口点导出。

## 拖动、滚动和移动停止点 {#drag-scroll-and-moving-stops}

捕捉点是正 DIP 高度、最大 `100%` 或 `content` 的百分比。百分比使用安全区域和键盘重叠后主机的可用高度。 `content` 测量 `scrollView.content` 加上面板的非滚动区域。如果没有 ScrollView，请提供包含所需工作表内容的固有大小的 `content` 视图。

布局更改重新测量停靠点。增长内容、调整主机大小或旋转窗口会重新定位选定的逻辑停止点，而无需从新位置重新启动原生 spring。视口的大小适合最大的停靠点，因此在完全展开时，最后一行仍然可以访问。 `sheet.remeasure()` 还可用于应用程序驱动的更改。

在列表内向上拖动首先展开面板，然后在同一联系人中滚动其内容。向下拖动首先将列表返回到顶部，然后移动面板。触摸会立即中断滑动；在没有平移的情况下释放该触摸仍然会选择停止。原生手势协调器处理移动和滚动消耗。面板和背景使用原生动画值绑定。 JavaScript 处理布局/键盘事件并观察短暂关闭以在稳定后隐藏视图。

<Clip name="bottom-sheet-ios" caption="iOS 26 模拟器上的真实 XCTest 输入：内容增长、拖动滚动切换、软件键盘后的聚焦字段以及解除。这是模拟器记录，而不是真机或屏幕阅读器性能证据。" />

<Clip name="bottom-sheet-android" caption="Android 模拟器上的真实操作系统输入：滚动前展开、移动面板前将列表返回到顶部、内容增长、键盘跟随和后退。" />

## 键盘和解雇 {#keyboard-and-dismissal}

`keyboard: 'follow'` 是默认值。当键盘可见时，工作表会暂时填充其上方的可用空间，保持聚焦字段可见并保留所选的捕捉。当键盘隐藏时，将恢复选定的捕捉。如果Android已经调整了主机的大小，则不会再次减去其键盘空间。当应用程序自行管理时，请使用 `'none'`。

背景、向下释放、Android 返回和原生“关闭”辅助功能操作可以关闭工作表。设置`dismissible: false`以禁用这些用户解雇路径；显式的 `sheet.dismiss()` 仍然有效。中断的关闭不会调用 `onDismiss` 或过早恢复焦点。

安全区域插图来自主机。当周围布局已经考虑了这些插图时，`safeArea: { top, bottom }` 可以覆盖它们。将覆盖主机与面板和键盘保持在同一窗口中。

## 可访问性和所有权 {#accessibility-and-ownership}

句柄接收原生展开、折叠和关闭自定义操作。现有的自定义操作将被保留。使用 `accessibility: { label, expand, collapse, dismiss }` 本地化它们；原生返回仅在工作表打开并加载时被拦截。 `returnFocus` 在完成解雇后确定要关注的开场球员。如果没有它，配方就会抓住当前的本地焦点。减少运动遵循 Jolt 的配置和平台偏好。

控制器提供`isOpen`、`snapPoint`、`visibleHeight`、`paused`和`disposed`，以及`open`、`snapTo`、`expand`、`collapse`、 `dismiss`、`remeasure`、`pause`、`play` 和 `dispose`。 `onChange(point)` 报告选定的快照，或 `null` 报告关闭请求； `onDismiss()` 等待完成。

卸载释放原生手势会话、绑定和键盘订阅；重新加载会重新附加到相同的视图。对于内容快照，测量的内容与顶部对齐，因此短列表保留其固有高度。处置会恢复该对齐方式以及配方拥有的其他布局/可访问性属性。不要与其他所有者同时为其面板 Y 或背景不透明度设置动画。

第一个版本支持页内面板和核心垂直`ScrollView`。原生模式呈现、虚拟化列表插件和跨窗口滚动切换需要单独的适配器。原生检查执行自定义操作和焦点处理；真机上的完整 VoiceOver/TalkBack 导航审核与这些模拟器录屏是分开的。
