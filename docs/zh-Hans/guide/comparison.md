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

## Android 真机复测

使用 ASUS ZenFone 3 真机、Android 8.0.0，每种配置进行五轮交替配对测试，每轮预热五秒后测量 30 秒。默认配置组与内存配置组按顺序采集，没有交错测试两种 Jolt 配置。以下中位数仅代表一台旧手机上的简单动画，不能用于框架总体排名。本次没有在真机上复测 Flutter。

| 配置                       | 每 30 秒的 CPU 时间（秒） | 测试后 PSS（MiB） | 各轮最大帧间隔的中位数（ms） |
| -------------------------- | ------------------------: | ----------------: | ---------------------------: |
| Jolt，默认配置             |                      6.79 |             88.27 |                        17.04 |
| Reanimated，默认配置对照组 |                     14.63 |             85.65 |                        17.25 |
| Jolt，显式 V8 内存配置     |                      7.37 |             79.16 |                        50.15 |
| Reanimated，内存配置对照组 |                     14.70 |             85.96 |                        17.06 |

可选的 `--optimize_for_size` 降低了测试后的 PSS，但相较默认 Jolt，CPU 时间和最大帧间隔增加。测量窗口开始前，该配置的 Jolt 仍占用 89.56 MiB，其 Reanimated 对照为 80.42 MiB。PSS 是采样值，不是内存峰值。这是应用运行时配置实验，未修改 Jolt 引擎或默认配置。不要仅为改善此表而启用该选项。

正常动画的帧间隔 p95 均接近 16.9 ms。默认 Jolt 的帧就绪→呈现间隔中位数为 32.43 ms，Reanimated 对照为 25.28 ms；内存配置组分别为 30.03 和 25.31 ms。这些真机 SurfaceFlinger 时间间隔不等于模拟器的入队→呈现指标、输入延迟或屏幕扫描时间。额外等待和主线程阻塞仍未解决。部分冷启动还出现 `EGL_NOT_INITIALIZED` 图形错误；失败记录已保留，根因尚未确定。

每个阻塞阶段另测两轮，使用内存配置的 Jolt APK 和同一 Reanimated 对照。阻塞应用 JavaScript 时，各轮最大帧间隔的中位数分别为 **309.13 和 17.06 ms**；阻塞 UI 线程时分别为 **300.85 和 300.79 ms**。较低的 PSS 没有消除 JavaScript 阻塞方面的差距。每轮包含三次主动触发的 300 ms 阻塞。

<Clip name="comparison-jolt-physical-android" caption="ASUS ZenFone 3 真机，Android 8.0.0，英文界面。Jolt 使用显式 V8 内存配置；真实点击展示重新开始、阻塞应用 JS、阻塞 UI 和停止。原速录制，独立于性能测量；录屏会增加负载。" />

<Clip name="comparison-reanimated-physical-android" caption="ASUS ZenFone 3 真机，Android 8.0.0，英文界面。通过真实点击展示 Reanimated 开始／重新开始、应用 JS 阻塞、UI 阻塞和停止。原速录制，与测量分开进行。" />

在独立的 JSON 分配测试中，两轮默认配置的批次耗时中位数为 421.61 和 417.33 ms，内存配置为 592.38 和 591.06 ms。进程 CPU 时间从 426/420 增至 743/742 ms，而测试后 PSS 从 120.57/121.15 降至 102.51/102.06 MiB。每个新进程均排除首个批次。这一代价进一步说明该选项应保持实验性质。

<Clip name="comparison-js-profile-physical-android" caption="ASUS ZenFone 3 真机，Android 8.0.0，英文界面。独立的 JavaScript 分配测试，使用默认运行时配置。展示真实批次进度和校验和验证完成；仅作视觉证据，不是计时样本或跨框架比较。" />

[完整范围、真机原始数据、失败记录、内存配置代价与复现步骤](https://github.com/rafaelaugustos/jolt/tree/main/benchmarks/results/android-followup-2026-11-03)。
