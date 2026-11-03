# 移动 Web 验证

本次交付按维护者要求仅使用模拟器。测试在真实 Safari 和 Chrome 浏览器中操作软件键盘，没有注入传感器事件。候选键盘修复尚未在 RC.10 发布。

<Clip name="web-mobile-ios" caption="Safari 26.2 · iPhone 17 模拟器，iOS 26.2。实际输入、旋转、权限请求、暂停/恢复及销毁。运动权限已授予，但未收到读数，因此两个源均报告不可用。触觉反馈不可用。英文界面，原速录像。" />

<Clip name="web-mobile-android" caption="Chrome 133 · Android API 36 模拟器。实际软件键盘、界面旋转、暂停/恢复及销毁。旋转和重力读数来自模拟器；发出振动请求不能证明物理振动。英文界面，原速录像。" />

## 键盘契约

VirtualKeyboard 对象存在但矩形为空，并不表示精确几何后端正在工作。除非应用启用 overlaysContent 或浏览器报告非空矩形，否则 Jolt 使用 VisualViewport。Jolt 不修改应用的 overlaysContent 设置。

浏览器同时缩小两个视口时，通过静止高度估计可见性，覆盖高度保持为零，避免重复上移。浏览器平移视口会改变底部覆盖范围，但不会把已打开的键盘误报为关闭。旋转会重置高度基线。聚焦输入框时调整桌面窗口尺寸仍可能影响估计。

## 复现与证据

[Protocol and raw reports](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/web-mobile).

```sh
node benchmarks/web-mobile/server.mjs
python3 benchmarks/web-mobile/android.py YOUR_EMULATOR /tmp/jolt-mobile-android
python3 benchmarks/docs-record-ios.py YOUR_SIMULATOR /tmp/jolt-mobile-ios testMobileBrowser
```

[Keyboard API](keyboard.md) · [Parity inventory](web-parity.md)
