# 性能，公开实测

[首页性能面板](/zh-Hans/#performance)展示 [PR #395](https://github.com/rafaelaugustos/jolt/pull/395) 的固定研究快照；2026 年 11 月 3 日查看时，该 PR 尚未合并。数据固定于提交 `c15b7f0da59168bcf1baa187daa7a622e9e5c19b`。这是一项探索性研究，不是引擎优化或默认配置变更。Jolt Web 仅为已存储的数据制作柱状图动画，不会在浏览器运行基准测试。

## 测量范围

真机 ASUS ZenFone 3（ASUS_Z017DC），Android 8.0.0，arm64 release 应用。一个 48 × 48 逻辑像素方块移动 240 单位，透明度从 1 变为 0.4，每段线性动画一秒。每种配置交替测试五组，每次预热五秒、测量 30 秒，在第 5、15、25 秒重启动画。测量时不录屏。

首页三项指标均来自**默认配置组**：

| 指标                           | NativeScript + Jolt | React Native + Reanimated |
| ------------------------------ | ------------------: | ------------------------: |
| 进程 CPU 秒数 / 每次 30 秒运行 |                6.79 |                     14.63 |
| 运行结束后 PSS，MiB            |               88.27 |                     85.65 |
| 帧就绪 → 呈现 p50，ms          |               32.43 |                     25.28 |

数值为五次运行的中位数。CPU 包含应用全部线程并归一化为 30 秒，范围分别为 6.74–7.27 s 与 14.53–14.68 s。53.6% 由两个 CPU 中位数计算，不代表动画速度、节电效果或隔离后的库开销。PSS 是运行后快照，不是峰值内存。呈现等待是各次运行 p50 的中位数，不是触控延迟或屏幕扫描时间。

## 取舍与未完成的结论

此场景中默认 Jolt 的运行后 PSS 多 2.62 MiB，帧就绪到呈现等待多 7.15 ms。研究不能确定完整应用、列表、手势、其他手机或整个 Android 平台的排名。

独立的**显式 V8 size 配置组** CPU 为 7.37 对 14.70 秒，运行后 PSS 为 79.16 对 85.96 MiB。最大帧间隔的中位数为 50.15 对 17.06 ms。Jolt 测量前的 PSS 仍较高，为 89.56 对 80.42 MiB。较低的运行后内存伴随较高 CPU 和更长间隔，独立 JSON 负载也更慢。默认与 size 配置组按顺序采集，没有交错随机化。这是可选的应用运行时实验，不是 Jolt 默认设置。

阻塞阶段另测每种情况两次，使用 Jolt size APK，每次人为阻塞三次、每次 300 ms。阻塞应用 JS 后，最大呈现间隔的中位数为 **Jolt 309.13 ms、Reanimated 17.06 ms**。NativeScript 的应用 JS 与 UI 共用线程，Reanimated 的应用 JS 则不是。阻塞 UI 线程得到 300.85 对 300.79 ms。不同实验走不同线程路径，不能混为一谈。

Jolt 有四次冷启动出现 `EGL_NOT_INITIALIZED`，另一次未完成尝试被上次错误对话框遮挡。失败记录保留在成功计时样本之外，原因尚不清楚，也不能确定一般崩溃率。设备观察器与温度条件同样限制结论。

[样本、范围、失败记录与构建身份](https://github.com/rafaelaugustos/jolt/blob/c15b7f0da59168bcf1baa187daa7a622e9e5c19b/benchmarks/results/android-followup-2026-11-03/README.md) · [协议与复现方法](https://github.com/rafaelaugustos/jolt/blob/c15b7f0da59168bcf1baa187daa7a622e9e5c19b/benchmarks/comparison.md)。模拟器测量单独保存，不混入首页面板。

## 真实原生录屏

以下为固定 PR 中已审查的英文录屏，复制时未修改帧或时间。它们展示控件与阻塞操作，**不是主要计时样本**。Jolt 录屏使用 size 配置，首页面板则使用默认配置组。

<Clip name="comparison-jolt-physical-android" caption="ASUS ZenFone 3 真机 / Android 8.0.0，英文：Jolt 使用显式 V8 size 配置，真实开始/重启、JS 阻塞、UI 阻塞和停止操作。原速录屏，与测量分开进行；不是首页图表中的默认配置运行。" />

<Clip name="comparison-reanimated-physical-android" caption="ASUS ZenFone 3 真机 / Android 8.0.0，英文：React Native + Reanimated 的真实开始/重启、JS 阻塞、UI 阻塞和停止操作。原速录屏，与测量分开进行。视频本身不能确定 CPU、内存或计时结果。" />

## 网站操作演示

<Clip name="motion-site-chromium" :width="960" caption="macOS arm64 上的 Chromium：真实指针与键盘操作、切换测量指标和新版页脚。动画图表展示已存储的真机测量数据。浏览器录屏不是原生性能证据；网站中的原生视频另有明确说明。" />
