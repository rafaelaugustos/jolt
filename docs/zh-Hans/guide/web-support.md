# Web 映射、几何与滚动 {#web-support}

这些 `@rafaelaugusto/jolt/web` API 是 #302–#304 的**未发布实验候选版本**，不在已发布的 RC.5 中。原生 API 与框架适配器合同保持不变；Mavis 集成另行跟进。

<Clip name="web-support-chromium" caption="桌面 Chromium，英文界面、原速：真实滑块、键盘、按压及滚轮演示数值映射、改变标签大小而不重启动画、反向滚动与清理。这不是物理设备或合成器性能测量。" />

## 数值映射 {#mappings}

```ts
const motion = createWebRuntime(document)
const input = motion.motionValue(0)
const mapped = input.to([0, 100], [0, 200])
const follower = motion.springValue(mapped)
motion.bind(card, {
  x: follower,
  scale: input.to([0, 100], [1, 1.2]),
  opacity: input.to([0, 100], [0.4, 1]),
})
motion.press(card)
input.set(50) // 应用缩放为 1.1；默认按压再乘以 0.96。
```

`.to(input, output, { clamp: true })` 复制 2–1024 对有限数值。输入必须严格递增或递减，不允许重复点；输出可以改变方向。默认限制范围，`{ clamp: false }` 使用首尾线段外推。不支持颜色、回调变换、多输入图或循环。映射与跟随器链最多 32 层。

结果提供 `get()`、`getVelocity()`、`subscribe()`、`dispose()` 和 `.to()`，没有 `set()`。速度为源速度乘以线段斜率；启用 clamp 时端点及范围外速度为零。内部节点使用输入升序下的左导数。无效区间和溢出会报错。所有值必须属于同一个 runtime。

没有消费者的映射按需读取。活动依赖使用现有 scheduler，不创建独立帧循环，可继续输入弹簧或映射。销毁映射会结束后代及绑定，保留源与兄弟节点；销毁源则结束所有后代。销毁绑定保留最后值；`release()` 恢复最初受控的样式。

## 更新几何而不重启播放 {#geometry}

```ts
motion.set(card, { scale: 1.1 })
const geometry = motion.observeGeometry(card)
motion.refresh(card) // 同步改变大小或二维 transform-origin 后调用。
// geometry.dispose(); motion.release(card)
```

`refresh()` 接受新的盒子及计算后的二维原点。浏览器把新枢轴应用于原效果，不替换通道、不重建关键帧、不重启时钟，也不发送完成通知。逻辑位置/速度、暂停进度、有限轨迹、绑定及按压乘数保持不变。枢轴变化可能移动像素；这不是 FLIP、大小插值或视觉位置锁定。

`observeGeometry()` 为每个已声明表面共享一个 ResizeObserver，批量处理响应式布局、标签及字体度量导致的尺寸变化。只改原点而不 resize 时需显式 `refresh()`。释放/卸载会结束所有观察；旧 handle 不影响新表面。无效自动更新会释放表面并报告错误；显式刷新失败不替换 ownership。

静态 CSS 基线保持固定。更换 class、外部 transform/opacity 写入、独立 CSS transform、三维原点、transition 或 `display: none/contents/inline` 仍需 release/重建。目标必须已挂载并受控。拖动仍在 scroll/resize 时取消，不扩大坐标空间合同。

## 垂直滚动 {#scroll}

```ts
const linked = motion.scrollLinked(
  scroller,
  card,
  {
    y: [0, -60],
    scale: [1, 0.9],
    opacity: [1, 0.4],
  },
  { range: [0, 400] },
)
// linked.execution: 'scroll-timeline' | 'scheduler' | 'released'
// linked.refresh(); linked.dispose()
const scroll = motion.scrollValue(scroller) // 省略参数时使用 runtime 的 Document。
const progress = scroll.to([0, 400], [0, 1])
// scroll.refresh(); scroll.dispose()
```

源为已挂载 HTMLElement 或 runtime 的 Document。只读值使用垂直 CSS 像素，限制在可滚动范围内。速度来自采样，100 毫秒无变化后失效，不是浏览器解析轨迹。`range` 必须在 0–1e9 像素之间递增，前后均限制到端点，回滚会逆向播放。显式有限数值数组支持 x/y/rotate/scale/scaleX/scaleY/opacity。可选 `times` 严格从 0 递增到 1，长度匹配每个数组。不可滚动内容停在起点。

自动模式在支持时使用 [ScrollTimeline](https://www.w3.org/TR/scroll-animations-1/) 及像素动画范围；`{ execution: 'scheduler' }` 显式选择回退。单个 link 的通道加静态/暂停贡献可以使用 timeline。活动有限动画、按压过渡、通用绑定或独立 links 会让该表面暂时改用共享 scheduler；稳定后恢复符合条件的 timeline。ownership、范围语义及其他表面的执行路径不变。观察单独的滚动值不会迫使原生滚动视觉效果改用 JavaScript；绑定 progress 或跟随弹簧则使用 scheduler。

滚动、resize、文本与字体事件使几何缓存失效，无持续测量或空闲帧循环。观察源及直接子节点、内容/文本变更与字体加载完成。深层 overflow 改变却没有观察到 resize 时需 `refresh()`；`linked.refresh()` 同时验证目标几何。减少动态效果把空间通道固定在最后关键帧，opacity 继续滚动映射；关闭该偏好后恢复空间映射。隐藏回退恢复当前 offset，不补算隐藏期间滚动。

销毁/替换最后一个通道，或卸载源/目标，会释放 link 的监听器、值及观察器。部分替换保留其余通道，旧 handle 不能覆盖新动画。`scrollValue()` 有独立生命周期，需单独销毁。不包括水平/RTL 归一化、逆向流、竖排、ViewTimeline、pinning、虚拟列表 header 或嵌套滚动交接。它不是 `scrollHeader()` 的等价物，也不保证在主线程外执行。

## 原生参考与验证 {#verification}

以下已审核原生演示展示现有映射和滚动合成；原生实现未更改，不是 Web 后端或 Mavis 集成录像。

<Clip name="descending-values-ios" caption="现有 iOS 模拟器演示，原速：递减与链式映射跟随真实 sheet 手势。原生参考，不是真机录像。" />
<Clip name="scroll-values-android" caption="现有 Android 模拟器演示，原速：真实列表滚动控制 header 位移、缩放、透明度与进度。原生参考。" />

运行 `npm run web:support:typecheck` 和 `npm run web:support:test`：在 Chromium/Firefox/WebKit 检查真实 CSS、自动/回退、按压、几何、生命周期、空闲、键盘/滚轮及 Chromium 触摸注入。隐藏时间测试控制信号，不测真机后台。还验证实际 Web/Vue/SSR/原生包消费者及现有测试。[复现报告](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/web-support.md)。
