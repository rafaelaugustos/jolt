# 完整原生示例

这些可运行的 Core NativeScript 页面包括视图创建和资源清理，仅使用公开 API，不依赖框架。Vue 预览只负责挂载 Frame。以下代码直接来自演示应用编译的源文件。

使用 --recipe=gallery、--recipe=sheet 或 --recipe=lists 启动已编译演示。Android 使用对应的 recipe Intent 字符串。支持 Core ListView；其他路由和虚拟列表需要自己的目标解析器。录像不代表物理设备性能。

## 图库

使用稳定键，在返回时查找当前列表单元格。通过各视图的 src 加载图片；在回收单元格之间共享可变 ImageSource 包装对象可能清空其他视图的像素。Frame 返回回调应用 Jolt 提供的导航选项。查看器保持关闭姿态，直到导航接受或取消。

<Clip name="recipe-gallery-ios" caption="iPhone 17 模拟器 · iOS 26.2。实际 XCTest 点击和拖动，英文界面，原速录像。缩放、平移、取消关闭、将选中项目移至末尾、按键返回缩略图并再次拖动关闭。" />

<<< @/../demo/src/recipes/gallery.ts

## 底部面板

一个控制器管理面板、拖动手柄、嵌套 ScrollView、键盘跟随及焦点恢复。根视图卸载时释放控制器。

<Clip name="recipe-sheet-ios" caption="iPhone 17 模拟器 · iOS 26.2。实际 XCTest 点击和拖动，英文界面，原速录像。打开、调整大小、添加内容、使用实际软件键盘输入、关闭/重新打开及滚动。" />

<<< @/../demo/src/recipes/sheet.ts

## 列表

每个已加载列表只创建一个 animateItems 绑定，并在卸载时释放。itemLoading 根据当前数据更新回收标签，更换数据不创建新绑定。

<Clip name="recipe-list-ios" caption="iPhone 17 模拟器 · iOS 26.2。实际 XCTest 点击和拖动，英文界面，原速录像。滚动虚拟化 Core ListView，并两次替换数据。" />

在固定使用的 iOS Core 9.1.3 中，此示例关闭 UIKit 单元格预取，避免预取的单元格在显示前丢失内容。固定行高与匹配的估算值使布局可预测。该设置仅用于此示例，不会全局修改 ListView。

<<< @/../demo/src/recipes/lists.ts

## 共享 UI

<<< @/../demo/src/recipes/ui.ts
