# 性能比较

第一个等价场景将 48×48 方块移动 240 个逻辑像素，同时不透明度从 1 变为 0.4。每个线性往返段持续一秒。Start 重置播放，Stop 保持当前位置。生产构建使用同一个专用 Android API 36 模拟器。

正常运动、应用运行时阻塞 300 毫秒和平台 UI 线程阻塞 300 毫秒分开测量。NativeScript JavaScript 与 Android UI 线程共享执行；Reanimated 的应用 JavaScript 不共享该线程。因此阻塞实验并不等同。

## Jolt / NativeScript

<Clip name="comparison-jolt-android" caption="真实原生应用，Android API 36 模拟器，英文界面。实际点击启动/重启、阻塞应用运行时、阻塞 UI 线程以及停止。原速录像，与计时采集分开。" />

## React Native / Reanimated

<Clip name="comparison-reanimated-android" caption="真实原生应用，Android API 36 模拟器，英文界面。实际点击启动/重启、阻塞应用运行时、阻塞 UI 线程以及停止。原速录像，与计时采集分开。" />

## Flutter

<Clip name="comparison-flutter-android" caption="真实原生应用，Android API 36 模拟器，英文界面。实际点击启动/重启、阻塞应用运行时、阻塞 UI 线程以及停止。原速录像，与计时采集分开。" />

## 测量与复现

[Protocol, pinned versions and source](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/comparison.md).
