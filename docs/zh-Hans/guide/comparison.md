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

## 测量基线

Android API 36 arm64 模拟器、release 应用。每阶段两次测量，每次预热五秒后采集30秒。数值为各次运行的中位数（最小–最大）。测量期间未录屏。

### 正常运动

| 技术栈              |   呈现间隔 p95 (ms) |       CPU 秒 / 30 s |       运行后 PSS (MiB) |
| ------------------- | ------------------: | ------------------: | ---------------------: |
| Jolt / NativeScript | 20.83 (18.15–23.51) |   9.75 (7.18–12.33) | 102.89 (102.10–103.68) |
| RN / Reanimated     | 18.44 (18.19–18.69) |    8.91 (7.98–9.84) |    92.20 (91.58–92.81) |
| Flutter             | 24.72 (18.24–31.20) | 15.80 (13.17–18.43) |    93.87 (93.04–94.70) |

### 故意阻塞300毫秒

| 阶段       | 技术栈              |      最大呈现间隔 (ms) | 输入确认 p95 (ms) |
| ---------- | ------------------- | ---------------------: | ----------------: |
| 应用运行时 | Jolt / NativeScript | 308.68 (300.55–316.82) |  0.17 (0.13–0.22) |
| 应用运行时 | RN / Reanimated     |    36.81 (36.59–37.03) |  0.66 (0.57–0.76) |
| 应用运行时 | Flutter             | 316.49 (316.26–316.72) |  0.38 (0.34–0.43) |
| 平台 UI    | Jolt / NativeScript | 302.48 (300.49–304.48) |  0.23 (0.12–0.33) |
| 平台 UI    | RN / Reanimated     | 301.39 (301.06–301.72) |  3.28 (3.14–3.42) |
| 平台 UI    | Flutter             | 317.05 (315.91–318.19) |  0.43 (0.40–0.45) |

这是模拟器上的探索性基线。采集期间修正了宿主负载规则，避免将被测模拟器自身负载判为外部干扰；此前接受的样本也满足最终规则。保留完整变更历史和排除记录。缓冲区呈现不是面板延迟，输入确认不是首个可见像素。NativeScript 的 JS 与 UI 共享线程，Reanimated 和 Flutter 的线程分工不同。

[逐次分布、Perfetto 原始轨迹、哈希、内存、CPU 和复现](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/results/comparison-2026-11-03).

Reanimated 的一次正常运行在脚本输入时间之外出现348毫秒呈现间隔，原因尚未隔离，样本仍保留。共享宿主上的两次运行不足以建立稳定的 CPU/帧性能排名。
